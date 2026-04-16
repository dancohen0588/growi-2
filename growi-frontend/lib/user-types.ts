// User types — replaces type exports of mock-users.ts

export type NotificationChannel = 'push' | 'email' | 'both' | 'none'
export type AlertFrequency = 'immediate' | 'daily_digest' | 'weekly_digest'

export interface AlertConfig {
  frostAlert:              boolean
  frostThreshold:          number
  heatAlert:               boolean
  rainAlert:               boolean
  windAlert:               boolean
  wateringReminder:        boolean
  wateringFrequencyDays:   number
  repottingReminder:       boolean
  pruningReminder:         boolean
  seedingAlerts:           boolean
  harvestAlerts:           boolean
  channel:                 NotificationChannel
  frequency:               AlertFrequency
  quietHoursEnabled:       boolean
  quietHoursStart:         string
  quietHoursEnd:           string
}

export interface UserProfile {
  firstName:   string
  lastName:    string
  email:       string
  address?:    string
  city?:       string
  avatarColor?: string
  gardenType?: 'potager' | 'ornement' | 'mixte' | 'interieur' | 'balcon'
  timezone?:   string
  latitude?:   number | null
  longitude?:  number | null
  alertConfig: AlertConfig
}

export const defaultAlertConfig: AlertConfig = {
  frostAlert:            true,
  frostThreshold:        2,
  heatAlert:             true,
  rainAlert:             false,
  windAlert:             false,
  wateringReminder:      true,
  wateringFrequencyDays: 2,
  repottingReminder:     true,
  pruningReminder:       false,
  seedingAlerts:         true,
  harvestAlerts:         true,
  channel:               'push',
  frequency:             'immediate',
  quietHoursEnabled:     false,
  quietHoursStart:       '22:00',
  quietHoursEnd:         '07:00',
}
