"use client"

/**
 * Login Page Route
 * 
 * Renders the authentication page for user login and registration.
 * This is a simple wrapper that imports and renders the AuthPage component,
 * which provides the tabbed interface for both login and registration forms.
 */

import AuthPage from "@/components/AuthPage"

export default function LoginPage() {
  return <AuthPage />
}
