-- AlterTable
ALTER TABLE "gardens" ADD COLUMN     "planningClearedOn" TEXT;

-- AlterTable
ALTER TABLE "plant_instances" ADD COLUMN     "lastHarvestedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "plant_tasks" ADD COLUMN     "supersededAt" TIMESTAMPTZ(6),
ADD COLUMN     "supersededByDiagnosisId" TEXT;

