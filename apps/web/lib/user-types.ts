// Types utilisateur — définis dans @growi/shared pour être partagés avec
// l'app mobile. Ce module reste le point d'entrée historique du web.
export { DEFAULT_ALERT_CONFIG as defaultAlertConfig, alertConfigSchema } from '@growi/shared'
export type {
  AlertConfig,
  AlertFrequency,
  NotificationChannel,
  UserProfile,
} from '@growi/shared'
