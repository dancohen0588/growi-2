'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface PlantDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantName: string
  onConfirm: () => void
}

export function PlantDeleteDialog({
  open,
  onOpenChange,
  plantName,
  onConfirm,
}: PlantDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {plantName} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La fiche de{' '}
            <strong>{plantName}</strong> et toutes ses données seront définitivement
            supprimées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
