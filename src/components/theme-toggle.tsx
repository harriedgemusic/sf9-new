'use client'

/**
 * ThemeToggle — button that switches between light and dark theme.
 *
 * Uses next-themes' useTheme hook. Renders a compact icon-only button.
 * The title/aria-label come from the caller-supplied translations via
 * the `t` prop because this component itself doesn't depend on useSettings
 * (avoids circular imports).
 */

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  darkLabel?: string
  lightLabel?: string
  ariaLabel?: string
}

export function ThemeToggle({
  darkLabel = 'Switch to light theme',
  lightLabel = 'Switch to dark theme',
  ariaLabel = 'Toggle theme',
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  // Initialize mounted via lazy initializer so we don't trigger a
  // setState-in-effect on mount.
  const [mounted] = React.useState<boolean>(() => typeof window !== 'undefined')

  const isDark = mounted ? theme === 'dark' : true

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? darkLabel : lightLabel}
      aria-label={ariaLabel}
    >
      {mounted ? (
        isDark ? <Sun className="size-4" /> : <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </Button>
  )
}
