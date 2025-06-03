'use client'

/**
 * Theme Provider Component
 * 
 * Provides theme context and functionality for the Diabot application:
 * - Wraps the application with next-themes provider for theme management
 * - Enables light/dark mode switching throughout the application
 * - Persists user theme preferences in local storage
 * - Used in the root layout to provide theme context to all pages
 */

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
