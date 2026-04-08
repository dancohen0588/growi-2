// growi-frontend/lib/garden/garden-reco.ts
import type { GardenConfig } from './types'

export function generateReco(config: GardenConfig): string {
  const { orientation, solType, slopeDeg, microclimats, climateZone } = config
  let reco = ''

  if (['S', 'SE', 'SO'].includes(orientation))
    reco += 'Excellente exposition — parfait pour les légumes gourmands en soleil (tomates, poivrons, courgettes). '
  else if (orientation === 'N')
    reco += "Exposition Nord : privilégie les plantes d'ombre — fougères, hostas, impatiens. "
  else
    reco += 'Belle orientation latérale — idéale pour rosiers et légumes semi-ombragés. '

  if (solType === 'argileux') reco += "Sol argileux : surélève tes rangs pour éviter l'engorgement. "
  if (solType === 'sableux')  reco += 'Sol sableux : arrose plus souvent et amende généreusement avec du compost. '
  if (solType === 'calcaire') reco += "Sol calcaire : myrtilles et rhododendrons ne s'y plairont pas — préfère l'acidophile en pot. "
  if (solType === 'fertile')  reco += 'Sol fertile : toutes cultures sont envisageables — tu as de la chance ! '

  if (climateZone === 'mediterr') reco += "Climat méditerranéen : mise sur lavande, romarin et tomates. Arrosage goutte-à-goutte recommandé. "
  if (climateZone === 'montagne') reco += "Altitude : saison courte — démarre tes semis sous abri et utilise des variétés précoces. "

  if (slopeDeg > 25) reco += "⚠️ Forte pente : installe des terrasses en paliers pour limiter l'érosion. "
  else if (slopeDeg > 10) reco += 'Pente modérée : des cordons de retenue entre tes rangs amélioreront le drainage. '

  if (microclimats.includes('gel'))   reco += "❄️ Risque gel : protège tes plantes fragiles avec un voile d'hivernage. "
  if (microclimats.includes('vente')) reco += '💨 Vent dominant : installe des brise-vent naturels (bambous, haies). '
  if (microclimats.includes('sec'))   reco += "☀️ Sol sec : privilégie le paillage épais pour conserver l'humidité. "

  return (reco.trim() || 'Configure ton jardin pour obtenir des recommandations personnalisées.') + ' 🌿'
}
