import { plantEditorRoute } from '@/components/plants/plantRoutes'

// Une plante supprimée depuis une tâche : on revient au calendrier, la liste
// d'où l'on vient dans cette pile.
export default plantEditorRoute('/(tabs)/calendrier')
