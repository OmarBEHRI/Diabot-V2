"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import NavigationBar from "@/components/NavigationBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { User, LogOut, Save, Trash2, Database, RefreshCw, Sliders, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { models, loadModels, isLoadingModels } = useChat();
  const [isLoading, setIsLoading] = useState(true); // Start true to load settings
  const [isSaving, setIsSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ragSourceCount, setRagSourceCount] = useState<number>(10);
  const [defaultModelId, setDefaultModelId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState(""); // For password mismatch
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [isDeletingContext, setIsDeletingContext] = useState(false);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090/api";

  // Load user settings on component mount
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    loadUserSettings();
    if (models.length === 0 && !isLoadingModels) {
      loadModels();
    }
  }, [user, router, models.length, isLoadingModels, loadModels]); // Added dependencies

  const loadUserSettings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const settings = response.data;
      if (settings && typeof settings.username !== 'undefined') {
        setUsername(settings.username || user?.username || "");
        setRagSourceCount(settings.rag_source_count || 10);
        setDefaultModelId(settings.default_model ? settings.default_model.id.toString() : undefined);
      } else {
        console.error("Error loading user settings: Invalid data structure received", settings);
        toast.error("Failed to load settings: Invalid data received from server.");
        if (user) {
          setUsername(user.username || ""); // Fallback to existing user data
        }
      }
    } catch (error: any) {
      console.error("Error loading user settings: Full error object:", JSON.stringify(error, null, 2));
      let errorMessage = "Failed to load user settings.";
      if (error.response) {
        errorMessage = `Failed to load settings: ${error.response.data?.error || error.response.statusText || 'Server error'}`;
        console.error(`Server responded with ${error.response.status}:`, error.response.data);
      } else if (error.request) {
        errorMessage = "Failed to load settings: No response from server.";
        console.error("No response received:", error.request);
      } else {
        errorMessage = `Failed to load settings: ${error.message}`;
        console.error("Error setting up request:", error.message);
      }
      toast.error(errorMessage);
      if (user) {
        setUsername(user.username || "");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage("New passwords don't match. Please re-enter.");
      toast.error("New passwords don't match.");
      return;
    }
    setErrorMessage(""); // Clear error message

    setIsSaving(true);

    try {
      const updateData: any = { username };
      
      if (newPassword && currentPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      } else if (newPassword && !currentPassword) {
        toast.error("Please enter your current password to set a new password.");
        setIsSaving(false);
        return;
      }
      
      await axios.put(`${API_URL}/settings`, updateData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      toast.success("Profile updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (user && user.username !== username) { // If username changed, update context (optional, depends on useAuth implementation)
        // Potentially call a method from useAuth to update user context if username is part of it
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefaultModelChange = async (modelId: string) => {
    if (!modelId) return;
    setDefaultModelId(modelId);
    try {
      await axios.put(`${API_URL}/settings/default-model`, 
        { model_id: parseInt(modelId) },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
      );
      toast.success("Default model updated");
    } catch (error) {
      console.error("Error setting default model:", error);
      toast.error("Failed to update default model");
    }
  };

  const handleRagSourcesSliderChange = (value: number[]) => {
    setRagSourceCount(value[0]);
  };

  const handleRagSourcesCommit = async (value: number[]) => {
    const count = value[0];
    try {
      await axios.put(`${API_URL}/settings/rag-sources`, 
        { count },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
      );
      toast.success("RAG sources count updated");
    } catch (error) {
      console.error("Error setting RAG sources count:", error);
      toast.error("Failed to update RAG sources count");
    }
  };

  const handleDeleteChatHistory = async () => {
    if (window.confirm("Are you sure you want to delete all your chat history? This action cannot be undone.")) {
      setIsDeletingHistory(true);
      try {
        const response = await axios.delete(`${API_URL}/settings/chat-history`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success(`Deleted ${response.data.count} chat sessions`);
      } catch (error) {
        console.error("Error deleting chat history:", error);
        toast.error("Failed to delete chat history");
      } finally {
        setIsDeletingHistory(false);
      }
    }
  };

  const handleClearChromaDB = async () => {
    if (window.confirm("Are you sure you want to clear the ChromaDB context? This will remove all vectorized knowledge and may affect the model's responses.")) {
      setIsDeletingContext(true);
      try {
        await axios.delete(`${API_URL}/settings/chromadb`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success("ChromaDB context cleared successfully");
      } catch (error) {
        console.error("Error clearing ChromaDB:", error);
        toast.error("Failed to clear ChromaDB context");
      } finally {
        setIsDeletingContext(false);
      }
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (user && username === "") {
        setUsername(user.username || "");
    }
  }, [user, username]);

  if (!user) {
    // router.push('/login') is handled in the first useEffect
    // To prevent flash of content or errors, return a loader or null
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
    ); 
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <NavigationBar />
      <div className="w-full flex flex-col pt-16 md:pt-20">
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Profile Header Card */}
            <Card className="overflow-hidden shadow-lg">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-emerald-500 shadow-md flex-shrink-0">
                  <AvatarImage src={user.avatar || "/Diabot-Logo.png"} alt={user.username || "User"} />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-blue-500 text-white text-3xl font-semibold">
                    {username?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left flex-grow">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 break-all">{isLoading ? "Loading..." : username}</h1>
                  <p className="text-gray-600 break-all">{user.email}</p>
                </div>
                <Button variant="outline" size="lg" className="gap-2 self-center sm:self-auto mt-4 sm:mt-0 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-150" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>

            {/* Account Information Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-700">Account Information</CardTitle>
                <CardDescription>Update your username and password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading || isSaving} className="text-base" />
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-1">Change Password</h3>
                  <p className="text-sm text-gray-500 mb-3">Leave fields blank if you don't want to change your password.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isLoading || isSaving} placeholder="Required to change password" className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading || isSaving} placeholder="Enter new password" className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading || isSaving} placeholder="Confirm new password" className="text-base" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isLoading || isSaving} className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </CardFooter>
            </Card>

            {/* Chat Settings Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-700">Chat Settings</CardTitle>
                <CardDescription>Configure your default chat preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="defaultModel">Default Chat Model</Label>
                  {isLoadingModels ? (
                     <div className="flex items-center space-x-2 text-gray-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading models...</span>
                    </div>
                  ) : models.length > 0 ? (
                    <Select value={defaultModelId} onValueChange={handleDefaultModelChange} disabled={isLoading}>
                      <SelectTrigger id="defaultModel" className="w-full text-base">
                        <SelectValue placeholder="Select a default model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id.toString()} className="text-base">
                            {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-gray-500">No models available. Please load models.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ragSources" className="flex items-center">RAG Context Sources: <span className="ml-1 font-semibold text-emerald-600">{ragSourceCount}</span></Label>
                  <Slider
                    id="ragSources"
                    min={1}
                    max={20}
                    step={1}
                    value={[ragSourceCount]}
                    onValueChange={handleRagSourcesSliderChange}
                    onValueCommit={handleRagSourcesCommit}
                    disabled={isLoading}
                    className="[&>span:first-child]:h-1 [&>span:first-child]:bg-emerald-500 [&_.thumb]:bg-emerald-600"
                  />
                   <p className="text-xs text-gray-500">Number of document chunks to retrieve for context.</p>
                </div>
              </CardContent>
            </Card>

            {/* Data Management Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-700">Data Management</CardTitle>
                <CardDescription>Manage your application data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-gray-700">Chat History</h4>
                    <p className="text-sm text-gray-500">Delete all your past chat conversations.</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteChatHistory} 
                    disabled={isLoading || isDeletingHistory}
                    className="gap-2 w-full sm:w-auto"
                  >
                    {isDeletingHistory ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {isDeletingHistory ? "Deleting..." : "Delete Chat History"}
                  </Button>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-gray-700">ChromaDB Knowledge Context</h4>
                    <p className="text-sm text-gray-500">Clear all vectorized documents from ChromaDB.</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleClearChromaDB} 
                    disabled={isLoading || isDeletingContext}
                    className="gap-2 w-full sm:w-auto"
                  >
                    {isDeletingContext ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    {isDeletingContext ? "Clearing..." : "Clear ChromaDB Context"}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}
