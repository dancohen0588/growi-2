// growi-frontend/components/dashboard/compte/ProfilForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Check, AlertTriangle, Loader2 } from 'lucide-react'

import { AvatarEditor } from './AvatarEditor'
import { AddressAutocompleteField } from './AddressAutocompleteField'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'

import { profilSchema, changePasswordSchema } from '@/lib/schemas/profil-schema'
import type { ProfilInput, ChangePasswordInput } from '@/lib/schemas/profil-schema'
import type { UserProfile } from '@/lib/user-types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak'
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  if (hasUpper && hasDigit) return 'strong'
  if (hasUpper || hasDigit) return 'medium'
  return 'weak'
}

const strengthLabel = { weak: 'Faible', medium: 'Moyen', strong: 'Fort' }
const strengthColor = {
  weak: 'bg-red-400',
  medium: 'bg-sun',
  strong: 'bg-lime',
}

interface ProfilFormProps {
  profile: UserProfile
  isLoading: boolean
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>
}

export function ProfilForm({ profile, isLoading, updateProfile }: ProfilFormProps) {
  const { toast } = useToast()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor ?? '#B4DD7F')
  const [addressCoords, setAddressCoords] = useState<{ lat: number | null; lon: number | null }>({
    lat: profile.latitude ?? null,
    lon: profile.longitude ?? null,
  })
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwSaveState, setPwSaveState] = useState<SaveState>('idle')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfilInput>({
    resolver: zodResolver(profilSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      address: profile.address ?? '',
      gardenType: profile.gardenType,
    },
  })

  // Sync form when profile loads
  useEffect(() => {
    reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      address: profile.address ?? '',
      gardenType: profile.gardenType,
    })
    setAvatarColor(profile.avatarColor ?? '#B4DD7F')
    setAddressCoords({
      lat: profile.latitude ?? null,
      lon: profile.longitude ?? null,
    })
  }, [profile, reset])

  const firstNameVal = watch('firstName') ?? ''
  const lastNameVal = watch('lastName') ?? ''
  const initials = (
    (firstNameVal[0] ?? '') + (lastNameVal[0] ?? '')
  ).toUpperCase() || profile.email.slice(0, 2).toUpperCase()

  async function onSubmit(data: ProfilInput) {
    setSaveState('saving')
    const result = await updateProfile({
      ...data,
      avatarColor,
      latitude: addressCoords.lat,
      longitude: addressCoords.lon,
    })
    if (result.error) {
      setSaveState('error')
      toast(result.error)
      setTimeout(() => setSaveState('idle'), 2500)
      return
    }
    setSaveState('saved')
    toast('Tes informations ont bien été enregistrées 🌱')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    watch: watchPw,
    formState: { errors: pwErrors },
    reset: resetPw,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  const newPasswordVal = watchPw('newPassword') ?? ''
  const strength = getPasswordStrength(newPasswordVal)

  async function onPasswordSubmit(data: ChangePasswordInput) {
    setPwSaveState('saving')
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPwSaveState('error')
        toast(json?.error ?? 'Erreur lors du changement de mot de passe.')
        setTimeout(() => setPwSaveState('idle'), 2500)
        return
      }
      setPwSaveState('saved')
      toast('Mot de passe mis à jour 🔐')
      setTimeout(() => {
        setPwSaveState('idle')
        setPasswordOpen(false)
        resetPw()
      }, 1500)
    } catch (err) {
      console.error('[onPasswordSubmit]', err)
      setPwSaveState('error')
      toast('Erreur réseau, réessaie.')
      setTimeout(() => setPwSaveState('idle'), 2500)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex gap-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-2xl shadow-card p-6 md:p-8 space-y-6"
        aria-label="Formulaire informations personnelles"
      >
        {/* Avatar + fields */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <AvatarEditor
            initials={initials}
            color={avatarColor}
            onChange={setAvatarColor}
          />

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prénom */}
            <div className="space-y-1">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p id="firstName-error" role="alert" className="text-xs text-red-500">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            {/* Nom */}
            <div className="space-y-1">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                {...register('lastName')}
              />
              {errors.lastName && (
                <p id="lastName-error" role="alert" className="text-xs text-red-500">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-xs text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Adresse */}
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="address">Adresse / Ville</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Information sur l'adresse"
                      className="text-forest/40 hover:text-forest transition-colors"
                    >
                      <span className="text-xs leading-none">ⓘ</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Cette adresse est aussi utilisée pour ta météo personnalisée 🌤️</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <AddressAutocompleteField
                id="address"
                value={watch('address') ?? ''}
                onChange={(label, lat, lon) => {
                  setValue('address', label)
                  setAddressCoords({ lat, lon })
                }}
                disabled={saveState === 'saving'}
              />
            </div>

            {/* Type de jardin */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="gardenType">Type de jardin</Label>
              <Select
                defaultValue={profile.gardenType}
                onValueChange={(val) =>
                  setValue('gardenType', val as ProfilInput['gardenType'])
                }
              >
                <SelectTrigger id="gardenType">
                  <SelectValue placeholder="Choisis ton type de jardin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="potager">🍅 Potager</SelectItem>
                  <SelectItem value="ornement">🌸 Ornemental</SelectItem>
                  <SelectItem value="mixte">🌿 Mixte</SelectItem>
                  <SelectItem value="interieur">🪴 Intérieur</SelectItem>
                  <SelectItem value="balcon">🌺 Balcon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset()}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={saveState === 'saving' || saveState === 'saved'}
            aria-busy={saveState === 'saving'}
            className={
              saveState === 'saved'
                ? 'bg-lime text-forest hover:bg-lime'
                : saveState === 'error'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : ''
            }
          >
            {saveState === 'saving' && <Loader2 size={15} className="mr-2 animate-spin" />}
            {saveState === 'saved' && <Check size={15} className="mr-2" />}
            {saveState === 'error' && <AlertTriangle size={15} className="mr-2" />}
            {saveState === 'idle' && 'Enregistrer mes infos'}
            {saveState === 'saving' && 'Enregistrement…'}
            {saveState === 'saved' && 'Enregistré !'}
            {saveState === 'error' && 'Erreur — réessaie'}
          </Button>
        </div>

        {/* Security section */}
        <Separator />
        <div className="space-y-3">
          <h2 className="font-poppins font-semibold text-forest">Sécurité</h2>
          <p className="font-raleway text-sm text-forest/60">
            Email de connexion :{' '}
            <span className="text-forest font-medium">{profile.email}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPasswordOpen(true)}
          >
            Changer mon mot de passe
          </Button>
        </div>
      </form>

      {/* Password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent aria-labelledby="pw-dialog-title">
          <DialogHeader>
            <DialogTitle id="pw-dialog-title">Changer mon mot de passe</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handlePwSubmit(onPasswordSubmit)}
            className="space-y-4 py-2"
          >
            {/* Current password */}
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  aria-describedby={pwErrors.currentPassword ? 'cur-pw-error' : undefined}
                  {...regPw('currentPassword')}
                />
                <button
                  type="button"
                  aria-label={showCurrent ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 hover:text-forest"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwErrors.currentPassword && (
                <p id="cur-pw-error" role="alert" className="text-xs text-red-500">
                  {pwErrors.currentPassword.message}
                </p>
              )}
            </div>

            {/* New password */}
            <div className="space-y-1">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  aria-describedby="new-pw-strength"
                  {...regPw('newPassword')}
                />
                <button
                  type="button"
                  aria-label={showNew ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 hover:text-forest"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPasswordVal.length > 0 && (
                <div id="new-pw-strength" className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1 flex-1">
                    {(['weak', 'medium', 'strong'] as const).map((level, i) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          ['weak', 'medium', 'strong'].indexOf(strength) >= i
                            ? strengthColor[strength]
                            : 'bg-forest/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-forest/60">{strengthLabel[strength]}</span>
                </div>
              )}
              {pwErrors.newPassword && (
                <p role="alert" className="text-xs text-red-500">
                  {pwErrors.newPassword.message}
                </p>
              )}
            </div>

            {/* Confirm */}
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirmation</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  aria-describedby={pwErrors.confirm ? 'confirm-error' : undefined}
                  {...regPw('confirm')}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 hover:text-forest"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwErrors.confirm && (
                <p id="confirm-error" role="alert" className="text-xs text-red-500">
                  {pwErrors.confirm.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setPasswordOpen(false); resetPw() }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={pwSaveState === 'saving' || pwSaveState === 'saved'}
                aria-busy={pwSaveState === 'saving'}
              >
                {pwSaveState === 'saving' && (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                )}
                {pwSaveState === 'saving' ? 'Mise à jour…' : 'Mettre à jour'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
