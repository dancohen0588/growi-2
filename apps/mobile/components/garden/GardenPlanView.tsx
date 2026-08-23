import { useMemo } from 'react'
import { View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { GardenPlan } from '@growi/shared'

import { buildPlanHtml } from './plan-html'

/**
 * Le plan dessiné, affiché tel que le serveur l'a composé.
 *
 * `interactive` distingue l'aperçu de la fiche jardin — figé, il ne doit pas
 * voler le défilement de la page — de l'écran plein où l'on zoome.
 */
export function GardenPlanView({
  plan,
  interactive = false,
}: {
  plan: GardenPlan
  interactive?: boolean
}) {
  const html = useMemo(() => buildPlanHtml(plan.svg, { interactive }), [plan.svg, interactive])

  return (
    <View className="flex-1 overflow-hidden bg-sand" accessible accessibilityRole="image" accessibilityLabel={`Plan du jardin, ${plan.elementCount} élément${plan.elementCount > 1 ? 's' : ''}`}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#F9F7E8' }}
        // Le document est un SVG statique : rien à exécuter.
        javaScriptEnabled={false}
        scalesPageToFit={false}
        scrollEnabled={interactive}
        // L'aperçu est décoratif et laisse le doigt à la page qui le porte.
        pointerEvents={interactive ? 'auto' : 'none'}
        // Rien à ouvrir depuis un plan : aucune navigation n'est légitime.
        onShouldStartLoadWithRequest={(request) => !/^https?:/i.test(request.url)}
      />
    </View>
  )
}
