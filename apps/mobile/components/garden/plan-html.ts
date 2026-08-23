/**
 * Enveloppe HTML du plan SVG, pour la WebView.
 *
 * Le plan est rendu dans une WebView et non avec `react-native-svg` pour deux
 * raisons : le pincer-zoomer est natif et identique sur iOS et Android, alors
 * qu'un `ScrollView` ne sait zoomer que sur iOS ; et le SVG vient du moteur de
 * dessin du web, qui emploie filtres et dégradés — les faire passer par un
 * second moteur de rendu, c'est accepter que les deux plans divergent un jour.
 */
export function buildPlanHtml(svg: string, { interactive }: { interactive: boolean }): string {
  const viewport = interactive
    ? 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=8, user-scalable=yes'
    : 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="${viewport}">
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: #F9F7E8;
    /* Le plan est une image : la sélection de texte n'y a aucun sens et
       déclenche la loupe iOS à la moindre pression longue. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${interactive ? '12px' : '0'};
    box-sizing: border-box;
  }
  svg { max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; }
</style>
</head>
<body>${svg}</body>
</html>`
}
