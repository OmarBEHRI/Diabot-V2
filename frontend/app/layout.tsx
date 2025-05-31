import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { ChatProvider } from "@/context/ChatContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Diabot - Medical AI Assistant",
  description: "AI-powered medical consultation platform for diabetes management",
  generator: 'Next.js',
  icons: {
    icon: '/Diabot-Logo.png', // Use the robot logo as favicon
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ChatProvider>{children}</ChatProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
