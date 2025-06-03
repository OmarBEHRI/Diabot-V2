/**
 * Utility Functions
 * 
 * Provides shared utility functions for the Diabot frontend:
 * - Combines Tailwind CSS classes with proper precedence using clsx and tailwind-merge
 * - Used throughout the application for consistent class name handling
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
