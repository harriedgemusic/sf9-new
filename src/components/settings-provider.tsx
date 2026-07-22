'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import {
  getDict,
  type Locale,
  type AudioFormat,
  type Dict,
} from '@/lib/i18n'
import { useAuth } from '@/components/auth-provider'

const STORAGE_KEY = 'sf9-settings'

interface PersistedSettings {
  locale: Locale
  audioFormat: AudioFormat
  downloadSource: 'auto' | 'youtube'
}

const DEFAULTS: PersistedSettings = {
  locale: 'ru',
  audioFormat: 'mp3-320',
  downloadSource: 'auto',
}

function readLocal(): PersistedSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveLocal(s: PersistedSettings): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export interface SettingsContextValue {
  mounted: boolean
  locale: Locale
  setLocale: (next: Locale) => void
  audioFormat: AudioFormat
  setAudioFormat: (format: AudioFormat) => void
  downloadSource: 'auto' | 'youtube'
  setDownloadSource: (source: 'auto' | 'youtube') => void
  theme: 'light' | 'dark'
  setTheme: (next: 'light' | 'dark') => void
  t: Dict
  losslessCoreAvailable: boolean
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const auth = useAuth()
  const { user } = auth

  const [settings, setSettings] = React.useState<PersistedSettings>({ ...DEFAULTS })
  const [mounted, setMounted] = React.useState(false)
  const [dbSynced, setDbSynced] = React.useState(false)

  // On mount: load from localStorage, then sync from server if logged in
  React.useEffect(() => {
    setSettings(readLocal())
    setMounted(true)
  }, [])

  // Once user is available, load settings from the DB
  React.useEffect(() => {
    if (!user || !mounted) return

    auth.loadSettings().then((remote) => {
      if (remote && typeof remote === 'object') {
        const merged: PersistedSettings = { ...DEFAULTS, ...remote }
        setSettings((prev) => {
          // Server settings take precedence, but we merge
          const result = { ...prev, ...merged }
          saveLocal(result)
          return result
        })
      }
      setDbSynced(true)
    }).catch(() => setDbSynced(true))
  }, [user, mounted])

  // Persist to local + server whenever settings change
  React.useEffect(() => {
    if (!mounted) return
    saveLocal(settings)
    if (user && dbSynced) {
      auth.saveSettings(settings as unknown as Record<string, unknown>)
    }
  }, [settings, mounted, user, dbSynced])

  React.useEffect(() => {
    if (!mounted) return
    document.documentElement.lang = settings.locale
  }, [settings.locale, mounted])

  const setLocale = React.useCallback((next: Locale) => {
    setSettings((prev) => ({ ...prev, locale: next }))
  }, [])

  const setAudioFormat = React.useCallback((next: AudioFormat) => {
    setSettings((prev) => ({ ...prev, audioFormat: next }))
  }, [])

  const setDownloadSource = React.useCallback((next: 'auto' | 'youtube') => {
    setSettings((prev) => ({ ...prev, downloadSource: next }))
  }, [])

  const t = React.useMemo(() => getDict(settings.locale), [settings.locale])

  const value = React.useMemo<SettingsContextValue>(() => ({
    mounted,
    locale: mounted ? settings.locale : DEFAULTS.locale,
    setLocale,
    audioFormat: mounted ? settings.audioFormat : DEFAULTS.audioFormat,
    setAudioFormat,
    theme: mounted ? (theme === 'light' ? 'light' : 'dark') : 'dark',
    setTheme: (next: 'light' | 'dark') => setTheme(next),
    t,
    downloadSource: mounted ? settings.downloadSource : DEFAULTS.downloadSource,
    setDownloadSource,
    losslessCoreAvailable: true,
  }), [mounted, settings, setLocale, setAudioFormat, setDownloadSource, theme, setTheme, t])

  return React.createElement(SettingsContext.Provider, { value }, children)
}

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used inside <SettingsProvider>')
  }
  return ctx
}