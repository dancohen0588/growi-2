'use client'

import { useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import type { GardenAction } from '@/lib/mock-actions'
import type { PlantAlert } from '@/lib/recommendation/types'
import {
  SECRET_RULE_IDS,
  groupActionsByHorizon,
  type LunarDay,
  type SecretVerdict,
} from '@growi/shared'
import { CalendarViewToggle, type ActiveView } from '@/components/dashboard/calendrier/CalendarViewToggle'
import { TodoView } from '@/components/dashboard/calendrier/views/TodoView'
import { CalendarView } from '@/components/dashboard/calendrier/views/CalendarView'
import { WeatherAlertBanner } from '@/components/dashboard/calendrier/WeatherAlertBanner'
import { LunarBanner } from '@/components/dashboard/calendrier/LunarBanner'
import { SecretCard, type GrimoireProgress } from '@/components/dashboard/secrets/SecretCard'
import { SecretDetailDialog } from '@/components/dashboard/secrets/SecretDetailDialog'
import {
  clearPlanningTodayAction,
  markActionDoneAction,
  markActionsDoneAction,
  undoActionAction,
} from '@/app/actions/advice.actions'
import {
  dismissSecretAction,
  revealSecretAction,
  secretFeedbackAction,
  setLunarCalendarAction,
} from '@/app/actions/secrets'
import { splitSecretActions, triedMessage, type SecretAction } from '@/lib/secrets/display'
import { useToast } from '@/components/ui/toast'
import { fadeIn } from '@/lib/animations'

interface CalendrierPageInnerProps {
  initialActions: GardenAction[]
  /** Les gestes déjà notés aujourd'hui, avec de quoi les annuler. */
  initialDoneToday: GardenAction[]
  alerts: PlantAlert[]
  /** Jardin d'origine de chaque action : le calendrier les réunit tous. */
  actionGardenIds: Record<string, string>
  /** Jardin à acquitter pour une action dont l'origine s'est perdue. */
  fallbackGardenId: string
  /** Tous les jardins de l'utilisateur — « ignorer » s'applique à chacun. */
  gardenIds: string[]
  /** Au moins un jardin est en pause pour aujourd'hui. */
  clearedToday: boolean
  /** Le jour lunaire — `null` tant que l'option n'est pas activée (défaut). */
  lunar: LunarDay | null
  /** L'avancement du grimoire, pour « Mon grimoire · 3 / 24 » — `null` s'il n'a pas pu être lu. */
  grimoire?: GrimoireProgress | null
}

function CalendrierContent({
  initialActions,
  initialDoneToday,
  alerts,
  actionGardenIds,
  fallbackGardenId,
  gardenIds,
  clearedToday,
  lunar,
  grimoire = null,
}: CalendrierPageInnerProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeView = (searchParams.get('vue') as ActiveView) ?? 'todo'
  const { toast } = useToast()
  const prefersReduced = useReducedMotion()

  const [actions, setActions] = useState<GardenAction[]>(initialActions)
  const [doneToday, setDoneToday] = useState<GardenAction[]>(initialDoneToday)
  const [cleared, setCleared] = useState(clearedToday)
  const [lunarShown, setLunarShown] = useState(lunar !== null)
  const [lunarPending, setLunarPending] = useState(false)

  // Les secrets ont leur carte en tête : ils sortent de **toutes** les listes
  // ordinaires — horizons, grille du mois, « Tout marquer fait », tournée
  // d'arrosage. Cochés par un geste de masse, ils partiraient sans `tipSlug`
  // et leur essai ne serait jamais suivi.
  const { secrets, ordinary } = useMemo(() => splitSecretActions(actions), [actions])
  const [secretDetail, setSecretDetail] = useState<SecretAction | null>(null)
  /** Secret sur lequel un geste est en cours — ses boutons attendent. */
  const [secretPending, setSecretPending] = useState<string | null>(null)
  /** Dévoilés pendant cette visite : `revealSecret` est idempotent, inutile de le rappeler. */
  const revealed = useRef(new Set<string>())

  const gardenOf = useCallback(
    (action: GardenAction) => actionGardenIds[action.id] ?? fallbackGardenId,
    [actionGardenIds, fallbackGardenId],
  )

  /** Retire les actions cochées et les fait passer dans « Fait aujourd'hui ». */
  const settle = useCallback((done: GardenAction[], careLogIds: (string | null)[]) => {
    const ids = new Set(done.map((a) => a.id))
    setActions((prev) => prev.filter((a) => !ids.has(a.id)))
    setDoneToday((prev) => [
      ...done.map((action, index) => ({
        ...action,
        done: true,
        doneAt: new Date().toISOString(),
        careLogId: careLogIds[index] ?? undefined,
      })),
      ...prev,
    ])
  }, [])

  const handleDone = useCallback(
    (id: string) => {
      const action = actions.find((a) => a.id === id)
      if (!action) return

      // L'affichage suit tout de suite ; l'échec recharge la page serveur, qui
      // fait autorité — plutôt que de rejouer à la main un état qu'on a deviné.
      setActions((prev) => prev.filter((a) => a.id !== id))

      // `taskId` n'est renseigné que pour une tâche planifiée : il l'acquitte
      // nommément, là où le moteur se contente du geste au journal.
      markActionDoneAction(
        id,
        gardenOf(action),
        action.type,
        action.plantId,
        action.taskId,
        action.ruleId,
      )
        .then(({ careLogId }) => {
          settle([action], [careLogId])
          toast('✓ Action notée comme faite ! Ton jardin te remercie 🌱')
        })
        .catch(() => {
          setActions((prev) => [action, ...prev])
          toast('Erreur lors de la sauvegarde. Réessaie.')
        })
    },
    [actions, gardenOf, settle, toast],
  )

  /**
   * « Tout arrosé », « Tout marquer comme fait » — un appel, pas N.
   *
   * Les actions sont groupées par jardin : le calendrier les réunit tous, et
   * l'endpoint groupé n'en accepte qu'un par appel.
   */
  const handleDoneMany = useCallback(
    (chosen: GardenAction[]) => {
      if (chosen.length === 0) return

      const ids = new Set(chosen.map((a) => a.id))
      setActions((prev) => prev.filter((a) => !ids.has(a.id)))

      const byGarden = new Map<string, GardenAction[]>()
      for (const action of chosen) {
        const gardenId = gardenOf(action)
        byGarden.set(gardenId, [...(byGarden.get(gardenId) ?? []), action])
      }

      Promise.all(
        [...byGarden.entries()].map(([gardenId, group]) =>
          markActionsDoneAction({
            gardenId,
            items: group.map((action) => ({
              actionType: action.type,
              plantId: action.plantId,
              taskId: action.taskId,
              ruleId: action.ruleId,
            })),
          }).then((result) => ({ group, result })),
        ),
      )
        .then((results) => {
          let skipped = 0
          for (const { group, result } of results) {
            settle(group, result.careLogIds)
            skipped += result.skipped
          }

          const done = chosen.length - skipped
          toast(
            skipped > 0
              ? `${done} geste${done > 1 ? 's' : ''} noté${done > 1 ? 's' : ''}, ${skipped} ignoré${skipped > 1 ? 's' : ''}.`
              : `✓ ${done} geste${done > 1 ? 's' : ''} noté${done > 1 ? 's' : ''} · à retrouver dans « Fait aujourd'hui »`,
          )
        })
        .catch(() => {
          setActions((prev) => [...chosen, ...prev])
          toast('Erreur lors de la sauvegarde. Réessaie.')
        })
    },
    [gardenOf, settle, toast],
  )

  /** Annuler pour de bon : le geste quitte le journal et l'action revient. */
  const handleUndo = useCallback(
    (action: GardenAction) => {
      if (!action.careLogId) return

      setDoneToday((prev) => prev.filter((a) => a.id !== action.id))

      undoActionAction({
        gardenId: gardenOf(action),
        careLogId: action.careLogId,
        taskId: action.taskId,
      })
        .then(() => {
          toast('Geste annulé.')
          // Le moteur décide de ce qui revient, et à quelle date : on le lui
          // redemande plutôt que de réinventer l'action ici.
          router.refresh()
        })
        .catch(() => {
          setDoneToday((prev) => [action, ...prev])
          toast("L'annulation a échoué. Réessaie.")
        })
    },
    [gardenOf, router, toast],
  )

  /** « Ignorer pour aujourd'hui », et son « Rétablir ». */
  const handleClear = useCallback(
    (undo: boolean) => {
      setCleared(!undo)

      Promise.all(gardenIds.map((gardenId) => clearPlanningTodayAction({ gardenId, undo })))
        .then(() => {
          toast(
            undo
              ? 'Actions rétablies.'
              : "Actions du jour ignorées. Rien n'a été inscrit au journal.",
          )
          router.refresh()
        })
        .catch(() => {
          setCleared(undo)
          toast('Impossible de mettre le planning en pause. Réessaie.')
        })
    },
    [gardenIds, router, toast],
  )

  // ─── Secrets de jardinier ────────────────────────────────────────────────

  /** Ouvrir la popin d'un secret à découvrir, c'est le dévoiler. */
  const openSecret = useCallback((action: SecretAction) => {
    setSecretDetail(action)
    const { slug, stage } = action.secret
    if (stage !== 'discover' || revealed.current.has(slug)) return
    revealed.current.add(slug)
    // Un dévoilement non enregistré ne coûte qu'une entrée de grimoire : il
    // ne doit pas fermer la popin ni inquiéter l'utilisateur.
    void revealSecretAction(slug)
      .then((result) => {
        if (!result.ok) revealed.current.delete(slug)
      })
      .catch(() => revealed.current.delete(slug))
  }, [])

  /**
   * Retire un secret de l'écran pendant le geste, et le remet si le geste
   * échoue. `run` rend `true` si le serveur a enregistré ; il ne lève pas.
   */
  const withSecret = useCallback(async (action: SecretAction, run: () => Promise<boolean>) => {
    setSecretPending(action.id)
    setSecretDetail(null)
    setActions((prev) => prev.filter((a) => a.id !== action.id))
    const ok = await run()
    if (!ok) setActions((prev) => (prev.some((a) => a.id === action.id) ? prev : [action, ...prev]))
    setSecretPending(null)
  }, [])

  /**
   * « Je tente » et « C'est fait » d'une préparation prête : deux gestes du
   * planning, écrits au journal avec leur règle et le secret. C'est ce
   * `tipSlug` qui fera venir « c'est prêt », puis « Ça a marché ? ».
   */
  const markSecretDone = useCallback(
    (action: SecretAction, success: string) =>
      withSecret(action, async () => {
        try {
          const { careLogId } = await markActionDoneAction(
            action.id,
            gardenOf(action),
            action.type,
            action.plantId,
            undefined,
            SECRET_RULE_IDS[action.secret.stage],
            action.secret.slug,
          )
          // Dans « Fait aujourd'hui », c'est un geste comme un autre : on lui
          // retire son secret, qu'un rendu ultérieur prendrait pour une carte.
          settle([{ ...action, secret: undefined }], [careLogId])
          toast(success)
          return true
        } catch {
          toast('Erreur lors de la sauvegarde. Réessaie.')
          return false
        }
      }),
    [gardenOf, settle, toast, withSecret],
  )

  const handleSecretTry = useCallback(
    (action: SecretAction) => void markSecretDone(action, triedMessage(action.secret.prepDays)),
    [markSecretDone],
  )

  const handleSecretReadyDone = useCallback(
    (action: SecretAction) =>
      void markSecretDone(action, 'Bien joué ! Dans une semaine, on te demandera si ça a marché.'),
    [markSecretDone],
  )

  /** Les Server Actions des secrets rendent un résultat ; une panne réseau, elle, lève. */
  const runSecretAction = useCallback(
    async (call: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => {
      try {
        const result = await call()
        toast(result.ok ? success : result.error)
        return result.ok
      } catch {
        toast('Erreur lors de la sauvegarde. Réessaie.')
        return false
      }
    },
    [toast],
  )

  const handleSecretDismiss = useCallback(
    (action: SecretAction) =>
      void withSecret(action, () =>
        runSecretAction(
          () => dismissSecretAction(action.secret.slug),
          'Compris, on ne te le proposera plus. Tu peux changer d’avis depuis ton grimoire.',
        ),
      ),
    [runSecretAction, withSecret],
  )

  const handleSecretFeedback = useCallback(
    (action: SecretAction, verdict: SecretVerdict) => {
      const careLogId = action.secret.trialCareLogId
      if (!careLogId) return
      void withSecret(action, () =>
        runSecretAction(
          () => secretFeedbackAction({ careLogId, verdict }),
          'Merci ! C’est noté dans ton grimoire 📖',
        ),
      )
    },
    [runSecretAction, withSecret],
  )

  /** « Ne plus afficher » du bandeau : coupe l'option du compte. */
  const handleLunarDisable = useCallback(() => {
    setLunarPending(true)
    void setLunarCalendarAction(false)
      .then((result) => {
        if (result.ok) {
          setLunarShown(false)
          toast('Calendrier lunaire désactivé. Tu peux le réactiver dans Mon compte › Mes alertes.')
        } else {
          toast(result.error)
        }
      })
      .catch(() => toast('Impossible de changer ce réglage. Réessaie.'))
      .finally(() => setLunarPending(false))
  }, [toast])

  const pendingByHorizon = useMemo(
    () => groupActionsByHorizon(ordinary.filter((a) => !a.done)),
    [ordinary],
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl lg:max-w-none">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
            Ton calendrier jardin 📅
          </h1>
          <p className="font-raleway text-forest/60 mt-1">
            Ce qui presse d&apos;abord&nbsp;; le reste, quand tu peux.
          </p>
        </div>
        <Suspense>
          <CalendarViewToggle activeView={activeView} />
        </Suspense>
      </div>

      {lunar && lunarShown && (
        <LunarBanner lunar={lunar} onDisable={handleLunarDisable} disabling={lunarPending} />
      )}

      {/* Weather alerts */}
      {alerts.length > 0 && <WeatherAlertBanner alerts={alerts} />}

      {/* Secrets de jardinier — en tête, hors des listes ordinaires */}
      {secrets.length > 0 && (
        <section aria-label="Secrets de jardinier" className="grid gap-4 md:grid-cols-2">
          {secrets.map((action) => (
            <SecretCard
              key={action.id}
              action={action}
              pending={secretPending === action.id}
              grimoire={grimoire}
              // La découverte prend toute la largeur (maquette `Main`) ; les
              // suites — « c'est prêt », « Ça a marché ? » — vont par deux.
              className={action.secret.stage === 'discover' ? 'md:col-span-2' : undefined}
              onOpen={openSecret}
              onReadyDone={handleSecretReadyDone}
              onFeedback={handleSecretFeedback}
            />
          ))}
        </section>
      )}

      {/* Summary bar */}
      <div className="rounded-xl bg-sand px-4 py-3 flex flex-wrap gap-x-5 gap-y-1 font-raleway text-sm text-forest/70">
        {doneToday.length > 0 && (
          <span>
            ✅ {doneToday.length} fait{doneToday.length > 1 ? 's' : ''} aujourd&apos;hui
          </span>
        )}
        <span>🌱 {pendingByHorizon.today.length} aujourd&apos;hui</span>
        <span>📆 {pendingByHorizon.week.length} cette semaine</span>
        <span>🌿 {pendingByHorizon.month.length} ce mois-ci</span>
      </div>

      {/* Views */}
      <AnimatePresence mode="wait">
        {activeView === 'todo' ? (
          <motion.div
            key="todo"
            variants={prefersReduced ? undefined : fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <TodoView
              actions={ordinary}
              doneToday={doneToday}
              cleared={cleared}
              onDone={handleDone}
              onDoneMany={handleDoneMany}
              onUndo={handleUndo}
              onClearToday={() => handleClear(false)}
              onRestore={() => handleClear(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="calendrier"
            variants={prefersReduced ? undefined : fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <CalendarView actions={ordinary} onDone={handleDone} />
          </motion.div>
        )}
      </AnimatePresence>

      <SecretDetailDialog
        action={secretDetail}
        open={secretDetail !== null}
        onOpenChange={(open) => !open && setSecretDetail(null)}
        pending={secretDetail !== null && secretPending === secretDetail.id}
        onTry={handleSecretTry}
        onDismiss={handleSecretDismiss}
        onReadyDone={handleSecretReadyDone}
        onFeedback={handleSecretFeedback}
      />
    </div>
  )
}

export function CalendrierPageInner(props: CalendrierPageInnerProps) {
  return (
    <Suspense>
      <CalendrierContent {...props} />
    </Suspense>
  )
}
