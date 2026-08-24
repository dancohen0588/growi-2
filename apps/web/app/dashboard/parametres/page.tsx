// growi-frontend/app/dashboard/parametres/page.tsx
import { permanentRedirect } from 'next/navigation'

/**
 * Les paramètres ont fusionné avec « Mon compte ». La route est conservée le
 * temps que les liens et signets existants s'éteignent d'eux-mêmes.
 */
export default function ParametresPage() {
  permanentRedirect('/dashboard/compte')
}
