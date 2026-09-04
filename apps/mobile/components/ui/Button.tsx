import { forwardRef } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
} from 'react-native'

export type ButtonVariant =
  | 'primary'
  | 'forest'
  | 'outline'
  | 'ghost'
  // `ghost` posé sur un fond sombre : même absence de surface, libellé sand.
  | 'ghost-inverse'
  | 'destructive'
export type ButtonSize = 'default' | 'lg'
/**
 * Police du libellé. Raleway partout, sauf l'onboarding qui est entièrement en
 * Poppins — la prop existe pour que ces écrans n'aient pas à styler le texte
 * à la main.
 */
export type ButtonFont = 'raleway' | 'poppins'

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  font?: ButtonFont
  loading?: boolean
  /** Icône affichée avant le libellé (lucide-react-native, taille 20). */
  icon?: React.ReactNode
  fullWidth?: boolean
}

// lime en fond avec du texte forest : le lime n'a pas un contraste suffisant
// pour du texte, il ne sert donc jamais qu'en surface.
const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-lime',
  forest: 'bg-forest',
  outline: 'bg-transparent border border-forest',
  ghost: 'bg-transparent',
  'ghost-inverse': 'bg-transparent',
  destructive: 'bg-destructive',
}

const PRESSED: Record<ButtonVariant, string> = {
  primary: 'bg-lime-pressed',
  forest: 'bg-forest-light',
  outline: 'bg-sand-dark',
  ghost: 'bg-sand-dark',
  'ghost-inverse': 'bg-forest-light',
  destructive: 'opacity-90',
}

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-forest',
  forest: 'text-sand',
  outline: 'text-forest',
  ghost: 'text-forest',
  'ghost-inverse': 'text-sand',
  destructive: 'text-sand',
}

const SPINNER: Record<ButtonVariant, string> = {
  primary: '#1E5631',
  forest: '#F9F7E8',
  outline: '#1E5631',
  ghost: '#1E5631',
  'ghost-inverse': '#F9F7E8',
  destructive: '#F9F7E8',
}

const FONT: Record<ButtonFont, string> = {
  raleway: 'font-raleway-semibold',
  poppins: 'font-poppins',
}

// 44 pt est la zone tactile minimale ; 56 pour un CTA principal.
const HEIGHT: Record<ButtonSize, string> = {
  default: 'h-11 px-5 rounded-lg',
  lg: 'h-14 px-6 rounded-xl',
}

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    label,
    variant = 'primary',
    size = 'default',
    font = 'raleway',
    loading = false,
    icon,
    fullWidth = true,
    disabled,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={[
        'flex-row items-center justify-center gap-2',
        HEIGHT[size],
        CONTAINER[variant],
        fullWidth ? 'w-full' : 'self-start',
        isDisabled ? 'opacity-50' : '',
      ].join(' ')}
      style={({ pressed }) => [
        // Retour tactile immédiat, discret.
        pressed && !isDisabled ? { transform: [{ scale: 0.98 }] } : null,
        variant === 'primary' && !isDisabled
          ? {
              shadowColor: '#B4DD7F',
              shadowOpacity: 0.5,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }
          : null,
      ]}
      {...props}
    >
      {({ pressed }) => (
        <View
          className={[
            'flex-row items-center justify-center gap-2 w-full h-full',
            pressed && !isDisabled ? PRESSED[variant] : '',
            size === 'lg' ? 'rounded-xl' : 'rounded-lg',
          ].join(' ')}
        >
          {loading ? (
            <ActivityIndicator size="small" color={SPINNER[variant]} />
          ) : (
            icon
          )}
          <Text
            className={`${FONT[font]} text-body ${LABEL[variant]}`}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
})
