-- « Je tente » ajoute le secret au calendrier en tâche à faire (source SECRET) ;
-- la tâche garde le secret qu'elle porte, pour l'inscrire au journal une fois cochée.
ALTER TABLE "plant_tasks" ADD COLUMN "tipSlug" TEXT;
