'use client'

/**
 * ThemeProvider — thin wrapper around next-themes that activates class-based
 * dark / light mode. Default theme is dark (matches the app's terminal-style
 * log panel).
 */

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
