// growi-frontend/components/dashboard/parametres/AlertesForm.tsx
'use client'

import { useState } from 'react'
import {
  Thermometer, Sun, CloudRain, Wind,
  Droplets, Flower2, Scissors,
  Sprout, Apple,
  Loader2, Check,
} from 'lucide-react'

import { AlertToggleCard } from './AlertToggleCard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

import type { UserProfile, AlertConfig, NotificationChannel, AlertFrequency } from '@/lib/user-types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface AlertesFormProps {
  profile: UserProfile
  isLoading: boolean
  updateAlerts: (updates: Partial<AlertConfig>) => Promise<{ error?: string }>
  resetAlerts: () => Promise<{ error?: string }>
}

export function AlertesForm({ profile, isLoading, updateAlerts, resetAlerts }: AlertesFormProps) {
  const { toast } = useToast()
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const ac = profile.alertConfig

  async function handleSave() {
    setSaveState('saving')
    // Persist the entire current config in a single PATCH so the user's
    // edits via the toggles are saved as a whole rather than relying on
    // each toggle having round-tripped individually.
    const result = await updateAlerts(ac)
    if (result.error) {
      setSaveState('error')
      toast(result.error)
      setTimeout(() => setSaveState('idle'), 2500)
      return
    }
    setSaveState('saved')
    toast('Tes préférences d\u2019alertes ont été sauvegardées 🔔')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  async function handleReset() {
    const result = await resetAlerts()
    if (result.error) {
      toast(result.error)
      return
    }
    toast('Alertes réinitialisées aux paramètres par défaut.')
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Alertes météo ─────────────────────────────────────────── */}
      <section aria-labelledby="section-meteo">
        <h2
          id="section-meteo"
          className="font-poppins font-semibold text-forest mb-3 flex items-center gap-2"
        >
          Alertes météo
          <span className="text-xs font-raleway font-normal bg-lime/20 text-forest px-2 py-0.5 rounded-full">
            Météo
          </span>
        </h2>
        <div className="space-y-3">
          <AlertToggleCard
            icon={<Thermometer size={18} />}
            title="Risque de gel"
            description={`Je t\u2019alerte quand le thermomètre risque de tomber sous ${ac.frostThreshold}°C.`}
            enabled={ac.frostAlert}
            onToggle={(v) => updateAlerts({ frostAlert: v })}
            switchAriaLabel="Activer les alertes de gel"
          >
            <div className="space-y-2">
              <Label htmlFor="frost-slider">Seuil de température</Label>
              <div className="flex items-center gap-3">
                <Slider
                  id="frost-slider"
                  min={-5}
                  max={5}
                  step={1}
                  value={[ac.frostThreshold]}
                  onValueChange={([v]) => updateAlerts({ frostThreshold: v })}
                  className="flex-1"
                  aria-label="Seuil de gel"
                  aria-valuemin={-5}
                  aria-valuemax={5}
                  aria-valuenow={ac.frostThreshold}
                  aria-valuetext={`${ac.frostThreshold}°C`}
                />
                <span className="w-14 text-center font-semibold text-forest font-poppins">
                  {ac.frostThreshold}°C
                </span>
              </div>
            </div>
          </AlertToggleCard>

          <AlertToggleCard
            icon={<Sun size={18} />}
            title="Alerte canicule"
            description="Je t\u2019alerte quand les températures dépassent 35°C."
            enabled={ac.heatAlert}
            onToggle={(v) => updateAlerts({ heatAlert: v })}
            switchAriaLabel="Activer les alertes canicule"
          />

          <AlertToggleCard
            icon={<CloudRain size={18} />}
            title="Pluie forte"
            description="Je t\u2019alerte en cas de précipitations supérieures à 20mm dans la journée."
            enabled={ac.rainAlert}
            onToggle={(v) => updateAlerts({ rainAlert: v })}
            switchAriaLabel="Activer les alertes pluie forte"
          />

          <AlertToggleCard
            icon={<Wind size={18} />}
            title="Vent violent"
            description="Je t\u2019alerte si les vents dépassent 50 km/h."
            enabled={ac.windAlert}
            onToggle={(v) => updateAlerts({ windAlert: v })}
            switchAriaLabel="Activer les alertes vent violent"
          />
        </div>
      </section>

      {/* ── Entretien & plantes ───────────────────────────────────── */}
      <section aria-labelledby="section-plantes">
        <h2
          id="section-plantes"
          className="font-poppins font-semibold text-forest mb-3 flex items-center gap-2"
        >
          Entretien &amp; plantes
          <span className="text-xs font-raleway font-normal bg-sun/20 text-forest px-2 py-0.5 rounded-full">
            Plantes
          </span>
        </h2>
        <div className="space-y-3">
          <AlertToggleCard
            icon={<Droplets size={18} />}
            title="Rappels d\u2019arrosage"
            description="Je te rappelle d\u2019arroser tes plantes selon leur besoin."
            enabled={ac.wateringReminder}
            onToggle={(v) => updateAlerts({ wateringReminder: v })}
            switchAriaLabel="Activer les rappels d'arrosage"
          >
            <div className="space-y-2">
              <Label>Fréquence des rappels</Label>
              <RadioGroup
                value={String(ac.wateringFrequencyDays)}
                onValueChange={(v) => updateAlerts({ wateringFrequencyDays: Number(v) })}
                className="space-y-1"
              >
                {[
                  { value: '1', label: 'Tous les jours' },
                  { value: '2', label: 'Tous les 2 jours' },
                  { value: '3', label: 'Tous les 3 jours' },
                  { value: '7', label: 'Une fois par semaine' },
                ].map(({ value, label }) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={value}
                      id={`watering-${value}`}
                      aria-label={label}
                    />
                    <Label htmlFor={`watering-${value}`} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </AlertToggleCard>

          <AlertToggleCard
            icon={<Flower2 size={18} />}
            title="Rempotage saisonnier"
            description="Je t\u2019avertis quand c\u2019est le bon moment pour rempoter."
            enabled={ac.repottingReminder}
            onToggle={(v) => updateAlerts({ repottingReminder: v })}
            switchAriaLabel="Activer les rappels de rempotage"
          />

          <AlertToggleCard
            icon={<Scissors size={18} />}
            title="Rappels de taille"
            description="Je te préviens des périodes de taille idéales pour tes plantes."
            enabled={ac.pruningReminder}
            onToggle={(v) => updateAlerts({ pruningReminder: v })}
            switchAriaLabel="Activer les rappels de taille"
          />
        </div>
      </section>

      {/* ── Calendrier jardin ─────────────────────────────────────── */}
      <section aria-labelledby="section-calendrier">
        <h2
          id="section-calendrier"
          className="font-poppins font-semibold text-forest mb-3 flex items-center gap-2"
        >
          Calendrier jardin
          <span className="text-xs font-raleway font-normal bg-forest/10 text-forest px-2 py-0.5 rounded-full">
            Calendrier
          </span>
        </h2>
        <div className="space-y-3">
          <AlertToggleCard
            icon={<Sprout size={18} />}
            title="Périodes de semis"
            description="Je t\u2019alerte quand c\u2019est le bon moment pour semer selon ta zone climatique."
            enabled={ac.seedingAlerts}
            onToggle={(v) => updateAlerts({ seedingAlerts: v })}
            switchAriaLabel="Activer les alertes de semis"
          />

          <AlertToggleCard
            icon={<Apple size={18} />}
            title="Récoltes imminentes"
            description="Je te préviens quand tes cultures approchent de la maturité."
            enabled={ac.harvestAlerts}
            onToggle={(v) => updateAlerts({ harvestAlerts: v })}
            switchAriaLabel="Activer les alertes de récolte"
          />
        </div>
      </section>

      {/* ── Comment te contacter ──────────────────────────────────── */}
      <section aria-labelledby="section-livraison">
        <h2
          id="section-livraison"
          className="font-poppins font-semibold text-forest mb-4"
        >
          Comment te contacter
        </h2>
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-5">
          {/* Canal */}
          <div className="space-y-2">
            <Label htmlFor="channel">Canal de notification</Label>
            <Select
              value={ac.channel}
              onValueChange={(v) => updateAlerts({ channel: v as NotificationChannel })}
            >
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push">📱 Notifications push uniquement</SelectItem>
                <SelectItem value="email">📧 Email uniquement</SelectItem>
                <SelectItem value="both">📱📧 Push et email</SelectItem>
                <SelectItem value="none">🔕 Désactiver toutes les notifications</SelectItem>
              </SelectContent>
            </Select>
            {ac.channel === 'none' && (
              <div
                role="alert"
                className="bg-sun/20 rounded-xl p-3 font-raleway text-sm text-forest mt-2"
              >
                Tu ne recevras aucune alerte. Ton jardin risque de souffrir sans toi ! 🌵
              </div>
            )}
          </div>

          {/* Fréquence */}
          <div className="space-y-2">
            <Label>Fréquence d&apos;envoi</Label>
            <RadioGroup
              value={ac.frequency}
              onValueChange={(v) => updateAlerts({ frequency: v as AlertFrequency })}
              className="space-y-1"
            >
              {[
                { value: 'immediate', label: '⚡ Alertes immédiates' },
                { value: 'daily_digest', label: '☀️ Résumé quotidien (8h du matin)' },
                { value: 'weekly_digest', label: '📋 Résumé hebdomadaire (lundi matin)' },
              ].map(({ value, label }) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`freq-${value}`} />
                  <Label htmlFor={`freq-${value}`} className="font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Heures silencieuses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quiet-hours-switch">Heures silencieuses</Label>
              <Switch
                id="quiet-hours-switch"
                checked={ac.quietHoursEnabled}
                onCheckedChange={(v) => updateAlerts({ quietHoursEnabled: v })}
                aria-checked={ac.quietHoursEnabled}
                aria-label="Activer les heures silencieuses"
              />
            </div>
            {ac.quietHoursEnabled && (
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label htmlFor="quiet-start">De</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={ac.quietHoursStart}
                    onChange={(e) => updateAlerts({ quietHoursStart: e.target.value })}
                    className="w-32"
                  />
                </div>
                <span className="text-forest/50 mt-5">→</span>
                <div className="space-y-1">
                  <Label htmlFor="quiet-end">À</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={ac.quietHoursEnd}
                    onChange={(e) => updateAlerts({ quietHoursEnd: e.target.value })}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Action buttons ───────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost">Réinitialiser</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Réinitialiser les alertes ?</AlertDialogTitle>
              <AlertDialogDescription>
                Toutes tes préférences reviendront aux paramètres par défaut.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-red-500 hover:bg-red-600">
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          onClick={handleSave}
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
          {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré !' : 'Enregistrer mes alertes'}
        </Button>
      </div>
    </div>
  )
}
