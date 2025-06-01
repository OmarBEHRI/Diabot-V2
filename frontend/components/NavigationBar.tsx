"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Home, MessageSquare, Database, BarChart3, User, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
}

export default function NavigationBar() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [activePath, setActivePath] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname
    }
    return ""
  })
  
  // Update activePath when the component mounts and when the URL changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      setActivePath(window.location.pathname)
      
      // Listen for route changes
      const handleRouteChange = () => {
        setActivePath(window.location.pathname)
      }
      
      window.addEventListener('popstate', handleRouteChange)
      return () => window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  const navItems: NavItem[] = [
    { icon: <MessageSquare className="h-4 w-4" />, label: "Chat", href: "/chat" },
    { icon: <Database className="h-4 w-4" />, label: "Knowledge", href: "/knowledge" },
    { icon: <BarChart3 className="h-4 w-4" />, label: "Benchmarks", href: "/benchmarks" },
  ]

  const handleNavigation = (href: string) => {
    setActivePath(href)
    router.push(href)
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center">
      <div className="bg-white/90 backdrop-blur-md shadow-md rounded-full px-2 py-1 border border-gray-200">
        <div className="flex items-center space-x-1">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation(item.href)}
              className={cn(
                "rounded-full px-4 transition-all duration-200",
                activePath === item.href || 
                (item.href === "/chat" && activePath === "") ||
                (activePath.startsWith(item.href) && item.href !== "/home")
                  ? "bg-gradient-to-r from-emerald-50 to-blue-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <div className="flex items-center space-x-2">
                <span className={cn(
                  activePath === item.href || 
                  (item.href === "/chat" && activePath === "") ||
                  (activePath.startsWith(item.href) && item.href !== "/home")
                    ? "text-emerald-600"
                    : "text-gray-500"
                )}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            </Button>
          ))}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigation('/profile')}
            className={cn(
              "rounded-full px-4 transition-all duration-200",
              activePath === "/profile" || activePath.startsWith("/profile")
                ? "bg-gradient-to-r from-emerald-50 to-blue-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center space-x-2">
              <span className={cn(
                activePath === "/profile" || activePath.startsWith("/profile")
                  ? "text-emerald-600"
                  : "text-gray-500"
              )}>
                <User className="h-4 w-4" />
              </span>
              <span>Profile</span>
            </div>
          </Button>
          

        </div>
      </div>
    </div>
  )
}
