'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

const PUBLIC_PATHS = ['/login', '/register']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (isLoading) return

    if (!user && !isPublic) {
      router.replace('/login')
    }

    if (user && isPublic) {
      router.replace('/')
    }
  }, [user, isLoading, isPublic, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user && !isPublic) return null

  return <>{children}</>
}