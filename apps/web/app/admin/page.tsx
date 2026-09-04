/**
 * Tableau de bord de l'administration.
 *
 * Marque-page en attendant les indicateurs : sans lui, `/admin` répondrait 404
 * et le contrôle d'accès du layout ne serait jamais atteint.
 */
export default function AdminHomePage() {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-card">
      <h1 className="font-poppins text-2xl font-semibold text-forest">Administration</h1>
      <p className="mt-2 max-w-prose text-forest/70">
        Les indicateurs, les utilisateurs et la messagerie arriveront ici. Pour l’instant, ce
        portail sert surtout à vérifier les droits et à faire démarrer l’historique d’activité.
      </p>
    </div>
  )
}
