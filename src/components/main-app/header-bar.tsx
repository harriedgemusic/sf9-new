'use client'

import { useSettings } from '@/components/settings-provider'
import type { SearchMode } from '@/lib/spotify-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Settings,
  ShieldAlert,
  LogOut,
  Sparkles,
  StopCircle,
  Search,
  CheckCircle2,
  Music,
} from 'lucide-react'

interface HeaderBarProps {
  url: string
  setUrl: (val: string) => void
  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void
  onFetch: () => void
  isFetching: boolean
  isDownloading: boolean
  onStop: () => void
  onOpenSettings: () => void
  onOpenAdminSettings?: () => void
  isAdmin?: boolean
  username?: string
  onLogout?: () => void
}

export function HeaderBar({
  url,
  setUrl,
  searchMode,
  setSearchMode,
  onFetch,
  isFetching,
  isDownloading,
  onStop,
  onOpenSettings,
  onOpenAdminSettings,
  isAdmin,
  username,
  onLogout,
}: HeaderBarProps) {
  const { t } = useSettings()

  return (
    <header className="space-y-4 border-b border-border/40 pb-5">
      {/* Upper Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/20">
            <Music className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {t.appTitle || 'Beatspotto'}
              <Badge variant="outline" className="text-[10px] font-medium tracking-normal border-primary/30 text-primary bg-primary/5">
                v2.0
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              {t.appSubtitle || 'Spotify Extended Mix & Original Downloader'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {username && (
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-normal">
              {username}
            </Badge>
          )}

          {isAdmin && onOpenAdminSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAdminSettings}
              className="gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
            >
              <ShieldAlert className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t.settings || 'Settings'}</span>
          </Button>

          <ThemeToggle />

          {onLogout && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onLogout}
              title="Logout"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* URL Input & Controls Row */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            type="url"
            placeholder={t.urlPlaceholder || 'https://open.spotify.com/playlist/...'}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isFetching) onFetch()
            }}
            disabled={isFetching || isDownloading}
            className="h-10 pr-9 text-sm shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex h-10 items-center rounded-lg border border-input bg-background p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setSearchMode('extended')}
              disabled={isFetching || isDownloading}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                searchMode === 'extended'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.modeToggleExtended || 'Extended'}
            </button>

            <button
              type="button"
              onClick={() => setSearchMode('simple')}
              disabled={isFetching || isDownloading}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                searchMode === 'simple'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t.modeToggleSimple || 'Simple'}
            </button>
          </div>

          {/* Action Buttons */}
          {isDownloading || isFetching ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStop}
              className="h-10 gap-1.5 px-4 font-medium"
            >
              <StopCircle className="h-4 w-4" />
              {t.stop || 'Stop'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onFetch}
              disabled={!url.trim()}
              className="h-10 gap-1.5 px-4 font-medium shadow-sm"
            >
              <Search className="h-4 w-4" />
              {t.findTracks || 'Find Tracks'}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
