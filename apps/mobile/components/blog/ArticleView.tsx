import { useMemo } from 'react'
import { PixelRatio } from 'react-native'
import { WebView } from 'react-native-webview'
import * as WebBrowser from 'expo-web-browser'
import type { BlogPost } from '@growi/shared'

import { buildArticleHtml } from './article-html'

/**
 * Le corps d'un article, rendu dans une WebView.
 *
 * Le contenu arrive déjà compilé en HTML par l'API — tableaux, encadrés et
 * ancres compris. Le rendre en composants natifs demanderait de réimplémenter
 * une mise en page pour chaque balise, à commencer par `<table>`, que les
 * bibliothèques du genre ne savent traiter qu'en… ouvrant une WebView.
 *
 * Le JavaScript y est actif : les articles peuvent embarquer une vidéo
 * YouTube, dont le lecteur en a besoin. Le contenu vient de fichiers du dépôt,
 * au même niveau de confiance que le code de l'app — aucune saisie
 * d'utilisateur n'y entre.
 */
export function ArticleView({ post }: { post: BlogPost }) {
  // La WebView ignore le Dynamic Type : on lui repasse l'échelle du système.
  const html = useMemo(() => buildArticleHtml(post, PixelRatio.getFontScale()), [post])

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1, backgroundColor: '#F9F7E8' }}
      // Sans ça, la page part avec la largeur d'un écran de bureau.
      scalesPageToFit={false}
      allowsFullscreenVideo
      // Android : sans ça, un lien `target="_blank"` ouvre une fenêtre
      // fantôme au lieu de passer par le filtre ci-dessous.
      setSupportMultipleWindows={false}
      /**
       * Les liens ne naviguent pas dans la vue : ils s'ouvrent dans le
       * navigateur système, pour que le lecteur ne se retrouve jamais coincé
       * dans un site sans barre d'adresse ni bouton retour.
       */
      onShouldStartLoadWithRequest={(request) => {
        // Une iframe qui charge son lecteur n'est pas une navigation du lecteur.
        if (request.isTopFrame === false) return true

        if (/^https?:/i.test(request.url)) {
          void WebBrowser.openBrowserAsync(request.url)
          return false
        }

        // Le chargement initial du document lui-même (about:blank, data:).
        return true
      }}
    />
  )
}
