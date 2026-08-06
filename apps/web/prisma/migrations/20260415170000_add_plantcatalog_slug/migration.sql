-- AlterTable
ALTER TABLE "plant_catalog" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "plant_catalog_slug_key" ON "plant_catalog"("slug");
