'use client'

/**
 * SettingsDialog — modal window with application settings.
 *
 * Sections:
 *   1. General            — language selector, theme toggle
 *   2. Audio format       — MP3 320 kbps / WAV 16-bit 44100 Hz
 *   3. Search mode        — Extended / Simple
 *   4. Search parameters  — tunable algorithm params (only relevant in Extended mode)
 *   5. Cookies            — status + button to open the cookies sub-dialog
 */

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/components/settings-provider'
import { useAuth } from '@/components/auth-provider'
import { LOCALES, type Locale, type AudioFormat } from '@/lib/i18n'
import QRCode from 'qrcode'
import {
  Settings as SettingsIcon,
  Globe,
  Moon,
  Sun,
  Music,
  Cookie,
  Check,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
  Zap,
  Download,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
} from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AUDIO_FORMATS: { id: AudioFormat; key: 'mp3-320' | 'wav-16-44100' }[] = [
  { id: 'mp3-320', key: 'mp3-320' },
  { id: 'wav-16-44100', key: 'wav-16-44100' },
]

export function SettingsDialog({
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const {
    t,
    locale,
    setLocale,
    audioFormat,
    setAudioFormat,
    theme,
    setTheme,
    losslessCoreAvailable,
  } = useSettings()

  const { user, token, setup2FA, enable2FA, disable2FA, changePassword } = useAuth()

  const [cookiesAvailable, setCookiesAvailable] = React.useState(false)
  const [cookieMsg, setCookieMsg] = React.useState("")

  const [isSettingUp2FA, setIsSettingUp2FA] = React.useState(false)
  const [twoFaSecret, setTwoFaSecret] = React.useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState('')
  const [verificationCode, setVerificationCode] = React.useState('')
  const [twoFaMsg, setTwoFaMsg] = React.useState('')
  const [twoFaError, setTwoFaError] = React.useState('')
  const [loading2FA, setLoading2FA] = React.useState(false)

  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [passwordMsg, setPasswordMsg] = React.useState('')
  const [passwordError, setPasswordError] = React.useState('')
  const [loadingPassword, setLoadingPassword] = React.useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordMsg('')

    if (newPassword !== confirmPassword) {
      setPasswordError(t.passwordsDoNotMatch)
      return
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      setPasswordError(t.passwordTooShort)
      return
    }

    setLoadingPassword(true)
    const res = await changePassword(currentPassword, newPassword)
    setLoadingPassword(false)

    if (res.ok) {
      setPasswordMsg(t.passwordChangedSuccess)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setPasswordError(res.error || 'Failed to change password')
    }
  }

  const handleStartSetup2FA = async () => {
    setLoading2FA(true)
    setTwoFaError('')
    setQrCodeDataUrl('')
    const res = await setup2FA()
    setLoading2FA(false)
    if (res.ok && res.secret) {
      setTwoFaSecret(res.secret)
      if (res.uri) {
        try {
          const url = await QRCode.toDataURL(res.uri, { margin: 2, width: 200 })
          setQrCodeDataUrl(url)
        } catch (err) {
          console.error('Failed to generate QR code:', err)
        }
      }
      setIsSettingUp2FA(true)
    } else {
      setTwoFaError(res.error || 'Failed to setup 2FA')
    }
  }

  const handleVerifyAndEnable2FA = async () => {
    setLoading2FA(true)
    setTwoFaError('')
    const res = await enable2FA(verificationCode)
    setLoading2FA(false)
    if (res.ok) {
      setIsSettingUp2FA(false)
      setVerificationCode('')
      setTwoFaMsg('2FA Enabled!')
    } else {
      setTwoFaError(res.error || 'Invalid code')
    }
  }

  const handleDisable2FA = async () => {
    setLoading2FA(true)
    setTwoFaError('')
    const res = await disable2FA()
    setLoading2FA(false)
    if (res.ok) {
      setTwoFaMsg('2FA Disabled')
    } else {
      setTwoFaError(res.error || 'Failed to disable 2FA')
    }
  }

  React.useEffect(() => {
    if (open) {
      fetch('/api/spotify/cookies', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.json())
        .then(d => setCookiesAvailable(Boolean(d.available)))
        .catch(() => {})
    }
  }, [open, token])

  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const ta = form.elements.namedItem('cookies') as HTMLTextAreaElement
    const res = await fetch('/api/spotify/cookies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content: ta.value })
    })
    const data = await res.json()
    if (res.ok) {
      setCookiesAvailable(true)
      setCookieMsg("Saved!")
      ta.value = ''
    } else {
      setCookieMsg(data.error || "Error saving cookies")
    }
  }


  const audioFormatLabels: Record<AudioFormat, { title: string; desc: string }> = {
    'mp3-320': {
      title: t.mp3Title,
      desc: t.mp3Desc,
    },
    'wav-16-44100': {
      title: t.wavTitle,
      desc: t.wavDesc,
    },
  }

    return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-emerald-500" />
            {t.settings}
          </DialogTitle>
          <DialogDescription>{t.settingsDescription}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-5 py-1">
            {/* ===== General ===== */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <SettingsIcon className="size-3.5" /> {t.sectionGeneral}
              </h3>

              {/* Language */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="size-4 text-muted-foreground" />
                  {t.language}
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLocale(l.code as Locale)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md border text-left text-sm transition-colors ${
                        locale === l.code
                          ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                          : 'border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="text-base">{l.flag}</span>
                      <span className="flex-1">{l.nativeName}</span>
                      {locale === l.code && <Check className="size-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  {theme === 'dark' ? <Moon className="size-4 text-muted-foreground" /> : <Sun className="size-4 text-muted-foreground" />}
                  {t.theme}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                      theme === 'dark'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border hover:bg-accent/50 text-muted-foreground'
                    }`}
                  >
                    <Moon className="size-4" />
                    <span className="flex-1 text-left">{t.themeDark}</span>
                    {theme === 'dark' && <Check className="size-4 text-emerald-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                      theme === 'light'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border hover:bg-accent/50 text-muted-foreground'
                    }`}
                  >
                    <Sun className="size-4" />
                    <span className="flex-1 text-left">{t.themeLight}</span>
                    {theme === 'light' && <Check className="size-4 text-emerald-500" />}
                  </button>
                </div>
              </div>
            </section>

            {/* ===== 2FA ===== */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> {t.section2FA}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t.twoFactorDescription}</p>

              {user?.totpEnabled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-500/40 bg-emerald-500/5">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-500 flex-1">
                      {t.twoFactorEnabled}
                    </span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={loading2FA}
                      onClick={handleDisable2FA}
                      className="h-8 text-xs"
                    >
                      {loading2FA ? <Loader2 className="size-3.5 animate-spin" /> : t.disable2FA}
                    </Button>
                  </div>
                  {twoFaMsg && <p className="text-xs text-emerald-500">{twoFaMsg}</p>}
                  {twoFaError && <p className="text-xs text-red-500">{twoFaError}</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-3 py-2 rounded-md border border-border">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {t.twoFactorDisabled}
                      </span>
                    </div>
                    {!isSettingUp2FA && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading2FA}
                        onClick={handleStartSetup2FA}
                        className="h-8 text-xs border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        {loading2FA ? <Loader2 className="size-3.5 animate-spin" /> : t.enable2FA}
                      </Button>
                    )}
                  </div>

                  {isSettingUp2FA && (
                    <div className="p-4 rounded-md border border-border bg-card space-y-4">
                      <p className="text-xs font-medium text-muted-foreground text-center">
                        {t.twoFactorSecretLabel}
                      </p>

                      {qrCodeDataUrl ? (
                        <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border w-fit mx-auto shadow-sm">
                          <img src={qrCodeDataUrl} alt="2FA QR Code" className="size-44" />
                        </div>
                      ) : null}

                      {twoFaSecret && (
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase text-muted-foreground text-center tracking-wider">
                            Secret Key
                          </p>
                          <div className="p-2 rounded bg-muted font-mono text-xs text-center tracking-widest select-all border">
                            {twoFaSecret}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-1">
                        <Input
                          type="text"
                          maxLength={6}
                          placeholder={t.twoFactorCodePlaceholder}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="text-center font-mono tracking-widest text-base h-10"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSettingUp2FA(false)}
                            className="h-8 text-xs"
                          >
                            {t.cancel}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={loading2FA || verificationCode.length < 6}
                            onClick={handleVerifyAndEnable2FA}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            {loading2FA ? <Loader2 className="size-3.5 animate-spin" /> : t.verifyAndEnable}
                          </Button>
                        </div>
                      </div>

                      {twoFaError && <p className="text-xs text-red-500 text-center">{twoFaError}</p>}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ===== Change Password ===== */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <KeyRound className="size-3.5" /> {t.sectionPassword}
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">{t.currentPassword}</label>
                  <Input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">{t.newPassword}</label>
                    <Input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-9 text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">{t.confirmPassword}</label>
                    <Input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-9 text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {passwordMsg && <p className="text-xs text-emerald-500 font-medium">{passwordMsg}</p>}
                {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loadingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {loadingPassword ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                    {t.changePasswordButton}
                  </Button>
                </div>
              </form>
            </section>

            {/* ===== Audio format ===== */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Music className="size-3.5" /> {t.sectionAudio}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t.audioFormatDescription}</p>
              <div className="space-y-2">
                {AUDIO_FORMATS.map((af) => {
                  const meta = audioFormatLabels[af.id]
                  const isSelected = audioFormat === af.id
                  return (
                    <button
                      key={af.id}
                      type="button"
                      onClick={() => setAudioFormat(af.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-border hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{meta.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
                      </div>
                      {isSelected && <Check className="size-4 text-emerald-500 mt-0.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </section>

            
            {/* ===== Cookies ===== */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Cookie className="size-3.5" /> yt-dlp Cookies
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t.cookiesSectionDescription}</p>
              
              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${cookiesAvailable ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'}`}>
                  <div className={`size-2 rounded-full ${cookiesAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-xs font-medium">
                    {cookiesAvailable ? "Cookies loaded" : "No cookies found"}
                  </span>
                </div>
                
                <form onSubmit={handleSaveCookies} className="space-y-2">
                  <textarea
                    name="cookies"
                    rows={4}
                    className="w-full text-xs rounded-md border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-muted-foreground"
                    placeholder="# Netscape HTTP Cookie File..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-500">{cookieMsg}</span>
                    <Button type="submit" size="sm" className="h-8">Save Cookies</Button>
                  </div>
                </form>
              </div>
            </section>

            {/* ===== Lossless-Core ===== */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Music className="size-3.5" /> {t.sectionLosslessCore}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t.losslessCoreDescription}</p>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${losslessCoreAvailable ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'}`}>
                <div className={`size-2 rounded-full ${losslessCoreAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                <span className="text-xs font-medium">
                  {losslessCoreAvailable ? t.losslessCoreAvailable : t.losslessCoreNotConfigured}
                </span>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="pt-2 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

