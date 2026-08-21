import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Confirmation brève et non bloquante, pour les gestes rapides
 * (« J'ai arrosé »). Elle informe sans interrompre : pas de bouton, pas de
 * modale, disparition automatique.
 */

type ToastTone = 'success' | 'error'

interface ToastMessage {
  text: string
  tone: ToastTone
}

const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

const VISIBLE_MS = 2200

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const show = useCallback(
    (text: string, tone: ToastTone = 'success') => {
      if (timer.current) clearTimeout(timer.current)
      setMessage({ text, tone })

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
      }, VISIBLE_MS)
    },
    [opacity],
  )

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}

      {message ? (
        <Animated.View
          pointerEvents="none"
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
              'rounded-xl px-4 py-3',
              message.tone === 'error' ? 'bg-destructive' : 'bg-forest',
            ].join(' ')}
          >
            <Text className="font-raleway-medium text-secondary text-sand text-center">
              {message.text}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}
