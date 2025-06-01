"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavigationBar from "@/components/NavigationBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, Bell, Shield, Moon, Sun, LogOut, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null; // Don't render anything while checking authentication
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <NavigationBar />
      
      {/* Main Content */}
      <div className="w-full overflow-hidden flex flex-col pt-20">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Profile Header */}
            <div className="mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                <AvatarImage src={user.avatar || ""} alt={user.username} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-blue-500 text-white text-2xl">
                  {user.username?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center sm:text-left">
                <h1 className="text-3xl font-bold text-gray-800">{user.username}</h1>
                <p className="text-gray-500">{user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Button variant="outline" size="sm" className="gap-1">
                    <User className="h-4 w-4" />
                    Edit Profile
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1" onClick={() => {
                    router.push('/home');
                    setTimeout(() => logout(), 100);
                  }}>
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Settings Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-gray-200 sticky top-0 bg-white/90 backdrop-blur-sm z-10 pb-0">
                <TabsList className="bg-gray-100 p-1 rounded-lg mb-4">
                  <TabsTrigger 
                    value="account" 
                    className={cn(
                      "rounded-md transition-all duration-200",
                      activeTab === "account" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                    )}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Account
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notifications" 
                    className={cn(
                      "rounded-md transition-all duration-200",
                      activeTab === "notifications" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                    )}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </TabsTrigger>
                  <TabsTrigger 
                    value="appearance" 
                    className={cn(
                      "rounded-md transition-all duration-200",
                      activeTab === "appearance" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                    )}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger 
                    value="security" 
                    className={cn(
                      "rounded-md transition-all duration-200",
                      activeTab === "security" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                    )}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Security
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {/* Account Settings */}
              <TabsContent value="account" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Update your personal details and profile information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" defaultValue={user.username} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" defaultValue={user.email} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" defaultValue={user.firstName || ""} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" defaultValue={user.lastName || ""} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <textarea 
                        id="bio" 
                        className="w-full min-h-[100px] rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        defaultValue={user.bio || ""}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white">
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Notification Settings */}
              <TabsContent value="notifications" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                      Manage how and when you receive notifications from Diabot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Email Notifications</Label>
                        <p className="text-sm text-gray-500">Receive email updates about your account and conversations.</p>
                      </div>
                      <Switch 
                        checked={emailNotifications} 
                        onCheckedChange={setEmailNotifications} 
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Push Notifications</Label>
                        <p className="text-sm text-gray-500">Get notified in your browser about new messages and updates.</p>
                      </div>
                      <Switch 
                        checked={pushNotifications} 
                        onCheckedChange={setPushNotifications} 
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white">
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Appearance Settings */}
              <TabsContent value="appearance" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Appearance Settings</CardTitle>
                    <CardDescription>
                      Customize how Diabot looks and feels for you.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Dark Mode</Label>
                        <p className="text-sm text-gray-500">Switch between light and dark themes.</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Sun className={`h-5 w-5 ${!darkMode ? 'text-amber-500' : 'text-gray-400'}`} />
                        <Switch 
                          checked={darkMode} 
                          onCheckedChange={setDarkMode} 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Moon className={`h-5 w-5 ${darkMode ? 'text-blue-500' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white">
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Security Settings */}
              <TabsContent value="security" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>
                      Manage your account security and authentication methods.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Two-Factor Authentication</Label>
                        <p className="text-sm text-gray-500">Add an extra layer of security to your account.</p>
                      </div>
                      <Switch 
                        checked={twoFactorAuth} 
                        onCheckedChange={setTwoFactorAuth} 
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" type="password" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white">
                      <Save className="h-4 w-4 mr-2" />
                      Update Password
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
