import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Confirmation brève et non bloquante, pour les gestes rapides
 * (« J'ai arrosé »). Elle informe sans interrompre : pas de modale,
 * disparition automatique.
 *
 * Un toast peut porter **un** lien (« Voir », pour la sève gagnée) : il reste
 * alors un peu plus longtemps à l'écran, le temps de l'atteindre. Sans lien,
 * il laisse passer les touches vers ce qu'il recouvre.
 */

type ToastTone = 'success' | 'error'

export interface ToastOptions {
  /** Posé avant le texte, en lime et en gras : « +1 de sève ». */
  emphasis?: string
  /** Une icône à gauche, déjà colorée pour le fond forest. */
  icon?: React.ReactNode
  action?: { label: string; onPress: () => void }
}

interface ToastMessage extends ToastOptions {
  text: string
  tone: ToastTone
}

type ShowToast = (text: string, tone?: ToastTone, options?: ToastOptions) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

const VISIBLE_MS = 2200
const VISIBLE_WITH_ACTION_MS = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const show = useCallback(
    (text: string, tone: ToastTone = 'success', options: ToastOptions = {}) => {
      if (timer.current) clearTimeout(timer.current)
      setMessage({ text, tone, ...options })

      // 180 ms : dans la fourchette sobre imposée par le design system.
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()

      timer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(() => setMessage(null))
      }, options.action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS)
    },
    [opacity],
  )

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}

      {message ? (
        <Animated.View
          pointerEvents={message.action ? 'box-none' : 'none'}
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            // Au-dessus de la barre d'onglets, jamais sous le home indicator.
            bottom: insets.bottom + 72,
            left: 16,
            width: width - 32,
            opacity,
            transform: [
              { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          }}
        >
          <View
            className={[
              'flex-row items-center gap-3 rounded-xl px-4 py-3',
              message.tone === 'error' ? 'bg-destructive' : 'bg-forest',
            ].join(' ')}
          >
            {message.icon ?? null}
            <Text
              className={[
                'flex-1 font-raleway-medium text-secondary text-sand',
                message.icon || message.action ? '' : 'text-center',
              ].join(' ')}
            >
              {message.emphasis ? (
                <Text className="font-poppins-bold text-lime">{message.emphasis} · </Text>
              ) : null}
              {message.text}
            </Text>
            {message.action ? (
              <Pressable
                onPress={() => {
                  message.action?.onPress()
                  if (timer.current) clearTimeout(timer.current)
                  opacity.setValue(0)
                  setMessage(null)
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={message.action.label}
                className="min-h-[44px] justify-center px-1"
              >
                <Text className="font-raleway-semibold text-secondary text-sand underline">
                  {message.action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}
