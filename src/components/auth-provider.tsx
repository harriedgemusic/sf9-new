'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface AuthUser {
  id: string
  username: string
  totpEnabled: boolean
  isAdmin?: boolean
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ ok: boolean; requires2FA?: boolean; partialToken?: string; error?: string }>
  verify2FA: (partialToken: string, code: string) => Promise<{ ok: boolean; error?: string }>
  register: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  setup2FA: () => Promise<{ ok: boolean; secret?: string; uri?: string; error?: string }>
  enable2FA: (code: string) => Promise<{ ok: boolean; error?: string }>
  disable2FA: () => Promise<{ ok: boolean; error?: string }>
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>
  saveSettings: (settings: Record<string, unknown>) => Promise<void>
  loadSettings: () => Promise<Record<string, unknown> | null>
}

const AuthContext = createContext<AuthState | null>(null)

const TOKEN_KEY = 'sf9-auth-token'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function storeToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: try to restore session from stored token
  useEffect(() => {
    const stored = getStoredToken()
    if (stored) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setUser(data.user)
            setToken(stored)
          } else {
            storeToken(null)
          }
        })
        .catch(() => storeToken(null))
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()

    if (data.ok && !data.requires2FA) {
      setToken(data.token)
      setUser(data.user)
      storeToken(data.token)
    }

    return data
  }, [])

  const verify2FA = useCallback(async (partialToken: string, code: string) => {
    const r = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partialToken, code }),
    })
    const data = await r.json()

    if (data.ok) {
      setToken(data.token)
      setUser(data.user)
      storeToken(data.token)
    }

    return data
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()

    if (data.ok) {
      setToken(data.token)
      setUser(data.user)
      storeToken(data.token)
    }

    return data
  }, [])

  const logout = useCallback(async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    setUser(null)
    setToken(null)
    storeToken(null)
  }, [token])

  const setup2FA = useCallback(async () => {
    const r = await fetch('/api/auth/2fa/setup', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return r.json()
  }, [token])

  const enable2FA = useCallback(async (code: string) => {
    const r = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup: true, token, code }),
    })
    const data = await r.json()
    if (data.ok) {
      setUser((prev) => prev ? { ...prev, totpEnabled: true } : prev)
    }
    return data
  }, [token])

  const disable2FA = useCallback(async () => {
    const r = await fetch('/api/auth/2fa/setup', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await r.json()
    if (data.ok) {
      setUser((prev) => prev ? { ...prev, totpEnabled: false } : prev)
    }
    return data
  }, [token])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    return r.json()
  }, [token])

  const saveSettings = useCallback(async (settings: Record<string, unknown>) => {
    await fetch('/api/user/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ settings }),
    })
  }, [token])

  const loadSettings = useCallback(async (): Promise<Record<string, unknown> | null> => {
    const r = await fetch('/api/user/settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await r.json()
    return data.ok ? data.settings : null
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        verify2FA,
        register,
        logout,
        setup2FA,
        enable2FA,
        disable2FA,
        changePassword,
        saveSettings,
        loadSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}