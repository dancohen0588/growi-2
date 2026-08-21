import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native'
import { HEALTH_STATUSES, HEALTH_STATUS_LABELS, type HealthStatus } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'

const STATUS_OPTIONS = HEALTH_STATUSES.map((value) => ({
  value,
  label: HEALTH_STATUS_LABELS[value],
}))

export interface HealthNoteSheetProps {
  visible: boolean
  current: HealthStatus
  submitting: boolean
  onClose: () => void
  onSubmit: (status: HealthStatus, note?: string) => void
}

/**
 * Saisie d'une note de santé, en surcouche plutôt qu'en écran : le geste part
 * de la fiche et y revient, sans perdre le contexte.
 */
export function HealthNoteSheet({
  visible,
  current,
  submitting,
  onClose,
  onSubmit,
}: HealthNoteSheetProps) {
  const [status, setStatus] = useState<HealthStatus>(current)
  const [note, setNote] = useState('')

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-sand"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
          >
            <Text className="font-raleway text-body text-muted-foreground">Annuler</Text>
          </Pressable>
          <Text className="font-poppins text-section text-forest">Note de santé</Text>
          <View className="w-16" />
        </View>

        <View className="px-4 gap-5">
          <OptionGroup
            label="Comment se porte-t-elle ?"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />

          <Input
            label="Observation"
            placeholder="Feuilles jaunies, pucerons sur les nouvelles pousses…"
            value={note}
            onChangeText={setNote}
            multiline
            returnKeyType="done"
            editable={!submitting}
          />

          <Button
            label="Enregistrer"
            size="lg"
            loading={submitting}
            onPress={() => onSubmit(status, note.trim() || undefined)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
