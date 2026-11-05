-- AlterTable
ALTER TABLE "garden_tips" ADD COLUMN     "planche" JSONB;


-- La planche du premier secret dessiné, « L’eau des légumes » (lib/secrets/library.ts).
-- Les lots suivants passent par `pnpm --filter web secrets:seed`, qui ne pose
-- une planche que là où il n’y en a pas.
UPDATE "garden_tips" AS t SET "planche" = v.planche, "updatedAt" = now()
FROM (VALUES
  ('eau-cuisson', '{"panels":[{"art":"eau-cuisson/1","caption":"Garde l’eau de cuisson des légumes, sans sel ni matière grasse.","emphasis":"sans sel ni matière grasse"},{"art":"eau-cuisson/2","caption":"Laisse-la refroidir complètement : tiède, jamais chaude.","emphasis":"refroidir complètement"},{"art":"eau-cuisson/3","caption":"Arrose ta plante avec, à la place de l’eau du robinet.","emphasis":"à la place de l’eau du robinet"}],"caution":{"art":"eau-cuisson/caution","title":"Jamais salée ni grasse.","text":"Le sel brûle les racines, surtout en pot. Si tu as salé ta cuisson, cette eau-là va à l’évier."}}'::jsonb)
) AS v(slug, planche)
WHERE t."slug" = v.slug AND t."planche" IS NULL;
