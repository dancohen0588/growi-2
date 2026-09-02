import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { CalendarPlus, Check, NotebookPen } from 'lucide-react-native'
import type { ChatProposal } from '@growi/shared'

/**
 * Une action que l'agent propose, et que seul un tap de l'utilisateur exécute.
 *
 * La carte porte toujours le mot « proposer » jusqu'à la confirmation : rien
 * n'a été fait tant que le bouton n'a pas été touché, et le laisser croire
 * serait le pire défaut de cette fonctionnalité.
 */

const ICON: Record<ChatProposal['kind'], typeof CalendarPlus> = {
  plan_task: CalendarPlus,
  care_log: NotebookPen,
  mark_done: Check,
}

/** Ce que l'acceptation a produit, une fois faite. */
const DONE_LABEL: Record<ChatProposal['kind'], string> = {
  plan_task: 'Planifié',
  care_log: 'Noté',
  mark_done: 'Fait',
}

export interface ProposalCardProps {
  proposal: ChatProposal
  submitting: boolean
  /** Désactivé pendant qu'une autre proposition est en cours. */
  disabled: boolean
  onConfirm: () => void
}

export function ProposalCard({ proposal, submitting, disabled, onConfirm }: ProposalCardProps) {
  // « Ignorer » ne fait que masquer la carte : le serveur n'a rien à en savoir,
  // et l'utilisateur retrouvera la proposition en rouvrant le fil.
  const [hidden, setHidden] = useState(false)

  const Icon = ICON[proposal.kind]
  const accepted = proposal.acceptedAt !== null

  if (hidden && !accepted) return null

  if (accepted) {
    return (
      <View className="flex-row items-center gap-2 rounded-xl bg-lime/25 px-4 py-3">
        <Check size={18} color="#1E5631" />
        <Text className="flex-1 font-raleway-medium text-secondary text-forest">
          {DONE_LABEL[proposal.kind]} · {proposal.title}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <View className="flex-row items-start gap-2">
        <Icon size={18} color="#1E5631" />
        <Text className="flex-1 font-raleway-medium text-secondary text-forest">
          {proposal.title}
        </Text>
      </View>

      <Pressable
        onPress={onConfirm}
        disabled={disabled || submitting}
        accessibilityRole="button"
        accessibilityLabel={`Confirmer : ${proposal.title}`}
        className={[
          'h-11 flex-row items-center justify-center gap-2 rounded-lg bg-lime',
          disabled && !submitting ? 'opacity-50' : '',
        ].join(' ')}
        style={({ pressed }) => (pressed ? { backgroundColor: '#a2cf6b' } : null)}
      >
        {submitting ? (
          <ActivityIndicator color="#1E5631" />
        ) : (
          <>
            <Check size={18} color="#1E5631" />
            <Text className="font-raleway-semibold text-body text-forest">Confirmer</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => setHidden(true)}
        disabled={submitting}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Ignorer : ${proposal.title}`}
        className="min-h-11 items-center justify-center self-stretch"
      >
        <Text className="font-raleway text-caption text-muted-foreground">Ignorer</Text>
      </Pressable>
    </View>
  )
}
