'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@/hooks/use-toast'
import {
  Shield,
  Users,
  User,
  BarChart3,
  FileText,
  UserPlus,
  KeyRound,
  Trash2,
  HardDrive,
  Download,
  RefreshCw,
  Zap,
  Check,
  X,
  Clock,
  Music,
} from 'lucide-react'

interface AdminSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UserItem {
  id: string
  username: string
  isAdmin: boolean
  totpEnabled: boolean
  createdAt: string
}

interface DownloadLogItem {
  id: string
  trackTitle: string
  trackArtist: string
  searchMode: 'extended' | 'simple' | string
  format?: string
  status: string
  createdAt: string
}

interface UserStats {
  totalDownloaded: number
  extendedCount: number
  simpleCount: number
  storageSizeBytes: number
}

interface LogFileInfo {
  name: string
  path: string
  size: number
  mtime: string
}

export function AdminSettingsDialog({ open, onOpenChange }: AdminSettingsDialogProps) {
  const { token } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'logs'>('users')

  // Users tab state
  const [users, setUsers] = useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)

  // Change password modal state
  const [changePasswordUser, setChangePasswordUser] = useState<UserItem | null>(null)
  const [targetNewPassword, setTargetNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Delete user modal state
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserItem | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  // Stats tab state
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userLogs, setUserLogs] = useState<DownloadLogItem[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [clearingStorage, setClearingStorage] = useState(false)

  // Logs tab state
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([])
  const [loadingLogFiles, setLoadingLogFiles] = useState(false)

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token])

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    if (!token) return
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/users', { headers: authHeader() })
      const data = await res.json()
      if (data.ok) {
        setUsers(data.users || [])
        if (!selectedUserId && data.users?.length > 0) {
          setSelectedUserId(data.users[0].id)
        }
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить список пользователей', variant: 'destructive' })
    } finally {
      setLoadingUsers(false)
    }
  }, [token, authHeader, selectedUserId, toast])

  // Fetch user stats
  const fetchUserStats = useCallback(
    async (userId: string) => {
      if (!token || !userId) return
      setLoadingStats(true)
      try {
        const res = await fetch(`/api/admin/users/${userId}/stats`, { headers: authHeader() })
        const data = await res.json()
        if (data.ok) {
          setUserStats(data.stats)
          setUserLogs(data.logs || [])
        } else {
          toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
        }
      } catch {
        toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику пользователя', variant: 'destructive' })
      } finally {
        setLoadingStats(false)
      }
    },
    [token, authHeader, toast]
  )

  // Fetch log files
  const fetchLogFiles = useCallback(async () => {
    if (!token) return
    setLoadingLogFiles(true)
    try {
      const res = await fetch('/api/admin/logs', { headers: authHeader() })
      const data = await res.json()
      if (data.ok) {
        setLogFiles(data.logs || [])
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить список файлов логов', variant: 'destructive' })
    } finally {
      setLoadingLogFiles(false)
    }
  }, [token, authHeader, toast])

  useEffect(() => {
    if (open) {
      fetchUsers()
      fetchLogFiles()
    }
  }, [open, fetchUsers, fetchLogFiles])

  useEffect(() => {
    if (open && activeTab === 'stats' && selectedUserId) {
      fetchUserStats(selectedUserId)
    }
  }, [open, activeTab, selectedUserId, fetchUserStats])

  // Handle user creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername || !newPassword) return
    setCreatingUser(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          isAdmin: newIsAdmin,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: 'Успешно', description: `Пользователь "${newUsername}" создан` })
        setCreateUserOpen(false)
        setNewUsername('')
        setNewPassword('')
        setNewIsAdmin(false)
        fetchUsers()
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось создать пользователя', variant: 'destructive' })
    } finally {
      setCreatingUser(false)
    }
  }

  // Handle password update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changePasswordUser || !targetNewPassword) return
    setUpdatingPassword(true)
    try {
      const res = await fetch(`/api/admin/users/${changePasswordUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ newPassword: targetNewPassword }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: 'Успешно', description: `Пароль пользователя "${changePasswordUser.username}" обновлен` })
        setChangePasswordUser(null)
        setTargetNewPassword('')
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось обновить пароль', variant: 'destructive' })
    } finally {
      setUpdatingPassword(false)
    }
  }

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return
    setDeletingUser(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteTargetUser.id}`, {
        method: 'DELETE',
        headers: authHeader(),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: 'Успешно', description: `Пользователь "${deleteTargetUser.username}" удален` })
        setDeleteTargetUser(null)
        fetchUsers()
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить пользователя', variant: 'destructive' })
    } finally {
      setDeletingUser(false)
    }
  }

  // Handle storage cleanup
  const handleClearStorage = async () => {
    if (!selectedUserId) return
    setClearingStorage(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/stats`, {
        method: 'POST',
        headers: authHeader(),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: 'Успешно', description: data.message || 'Папка загрузок очищена' })
        fetchUserStats(selectedUserId)
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось очистить папку загрузок', variant: 'destructive' })
    } finally {
      setClearingStorage(false)
    }
  }

  // Handle log file download
  const handleDownloadLogFile = (filename: string) => {
    if (!token) return
    const downloadUrl = `/api/admin/logs?file=${encodeURIComponent(filename)}&token=${token}`
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl md:max-w-6xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="size-6 text-emerald-500" />
            Панель администратора
          </DialogTitle>
          <DialogDescription>
            Управление пользователями, просмотр статистики загрузок и скачивание логов работы приложения.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 my-3 border-b border-border pb-2">
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('users')}
            className="gap-2"
          >
            <Users className="size-4" />
            Пользователи ({users.length})
          </Button>
          <Button
            variant={activeTab === 'stats' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('stats')}
            className="gap-2"
          >
            <BarChart3 className="size-4" />
            Статистика
          </Button>
          <Button
            variant={activeTab === 'logs' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('logs')}
            className="gap-2"
          >
            <FileText className="size-4" />
            Логи работы ({logFiles.length})
          </Button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Список пользователей
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchUsers}
                    disabled={loadingUsers}
                    title="Обновить"
                  >
                    <RefreshCw className={`size-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setCreateUserOpen(true)}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <UserPlus className="size-4" />
                    Создать пользователя
                  </Button>
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-2.5">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 border border-border rounded-lg bg-card/60 hover:bg-card transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                        <User className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <span className="text-sm font-semibold">{u.username}</span>
                          {u.isAdmin ? (
                            <Badge variant="default" className="bg-amber-600 text-[10px] py-0 px-1.5 font-bold">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                              Пользователь
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                          <span>2FA: {u.totpEnabled ? 'Включено' : 'Выключено'}</span>
                          <span>•</span>
                          <span>Создан: {new Date(u.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChangePasswordUser(u)}
                        title="Сменить пароль пользователя"
                        className="h-8 px-3 text-xs gap-1.5 border-border hover:bg-muted font-medium"
                      >
                        <KeyRound className="size-3.5 text-amber-500" />
                        <span>Сменить пароль</span>
                      </Button>

                      {!u.isAdmin ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTargetUser(u)}
                          title="Удалить пользователя"
                          className="h-8 px-3 text-xs gap-1.5 bg-destructive/90 hover:bg-destructive font-medium"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Удалить</span>
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground px-2 py-1 border-muted">
                          Главный admin
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: USER STATISTICS */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Выберите пользователя:</Label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.isAdmin ? '(Admin)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchUserStats(selectedUserId)}
                    disabled={loadingStats}
                    title="Обновить статистику"
                  >
                    <RefreshCw className={`size-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearStorage}
                    disabled={clearingStorage || !selectedUserId}
                    className="gap-1.5"
                  >
                    <HardDrive className="size-4" />
                    Очистить папку загрузок
                  </Button>
                </div>
              </div>

              {/* Stats Overview Grid */}
              {userStats ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/30 border border-border rounded-lg flex flex-col">
                    <span className="text-xs text-muted-foreground">Всего скачано</span>
                    <span className="text-2xl font-bold mt-1 text-foreground">
                      {userStats.totalDownloaded}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex flex-col">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <Zap className="size-3" /> Расширенный режим
                    </span>
                    <span className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                      {userStats.extendedCount}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex flex-col">
                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                      <Download className="size-3" /> Простой режим
                    </span>
                    <span className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                      {userStats.simpleCount}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg flex flex-col">
                    <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium">
                      <HardDrive className="size-3" /> Размер папки
                    </span>
                    <span className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                      {formatBytes(userStats.storageSizeBytes)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Загрузка статистики...
                </div>
              )}

              {/* Download History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  История загрузок треков
                </h4>
                <div className="border border-border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  {userLogs.length > 0 ? (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground uppercase sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Трек</th>
                          <th className="px-3 py-2">Режим скачивания</th>
                          <th className="px-3 py-2">Статус</th>
                          <th className="px-3 py-2 text-right">Время</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium flex items-center gap-1.5">
                              <Music className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[280px]">
                                {log.trackArtist} - {log.trackTitle}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {log.searchMode === 'extended' ? (
                                <Badge variant="default" className="bg-emerald-600 text-[10px] py-0">
                                  <Zap className="size-2.5 mr-1" /> Расширенный
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] py-0">
                                  <Download className="size-2.5 mr-1" /> Простой
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className="capitalize">{log.status}</span>
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString('ru-RU')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Нет записей о загрузках для выбранного пользователя
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROJECT LOG FILES */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Файлы логов системы
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLogFiles}
                  disabled={loadingLogFiles}
                  title="Обновить список логов"
                >
                  <RefreshCw className={`size-3.5 ${loadingLogFiles ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {logFiles.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {logFiles.map((lf) => (
                    <div
                      key={lf.name}
                      className="p-4 border border-border rounded-lg bg-card hover:border-emerald-500/50 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-500">
                          <FileText className="size-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{lf.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                            <span>Размер: {formatBytes(lf.size)}</span>
                            <span>
                              Изменен: {new Date(lf.mtime).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownloadLogFile(lf.name)}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                      >
                        <Download className="size-4" />
                        Загрузить файл
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  Файлы логов не обнаружены на сервере.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* CREATE USER MODAL */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать нового пользователя</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-username">Логин</Label>
              <Input
                id="create-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="имя_пользователя"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-password">Пароль</Label>
              <Input
                id="create-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="******"
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="create-isadmin"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                className="rounded border-input text-emerald-600 focus:ring-emerald-500"
              />
              <Label htmlFor="create-isadmin" className="cursor-pointer text-sm font-normal">
                Права администратора (Admin)
              </Label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={creatingUser} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {creatingUser ? 'Создание...' : 'Создать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CHANGE PASSWORD MODAL */}
      <Dialog open={Boolean(changePasswordUser)} onOpenChange={(open) => !open && setChangePasswordUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Сменить пароль ({changePasswordUser?.username})</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="change-password">Новый пароль</Label>
              <Input
                id="change-password"
                type="password"
                value={targetNewPassword}
                onChange={(e) => setTargetNewPassword(e.target.value)}
                placeholder="Новый пароль"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setChangePasswordUser(null)}>
                Отмена
              </Button>
              <Button type="submit" disabled={updatingPassword} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {updatingPassword ? 'Сохранение...' : 'Обновить пароль'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE USER CONFIRMATION MODAL */}
      <Dialog open={Boolean(deleteTargetUser)} onOpenChange={(open) => !open && setDeleteTargetUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Удаление пользователя
            </DialogTitle>
            <DialogDescription className="pt-2">
              Вы уверены, что хотите удалить пользователя <strong>{deleteTargetUser?.username}</strong>? Это действие нельзя отменить. Все данные и файлы загрузок пользователя будут удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteTargetUser(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deletingUser}>
              {deletingUser ? 'Удаление...' : 'Да, удалить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
