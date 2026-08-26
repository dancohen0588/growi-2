-- AlterTable
ALTER TABLE "diagnoses" ADD COLUMN     "tasksPlannedAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "plant_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "diagnosisId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DIAGNOSIS',
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "doneAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plant_tasks_userId_doneAt_dueDate_idx" ON "plant_tasks"("userId", "doneAt", "dueDate");

-- CreateIndex
CREATE INDEX "plant_tasks_plantInstanceId_idx" ON "plant_tasks"("plantInstanceId");

-- AddForeignKey
ALTER TABLE "plant_tasks" ADD CONSTRAINT "plant_tasks_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_tasks" ADD CONSTRAINT "plant_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_tasks" ADD CONSTRAINT "plant_tasks_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "diagnoses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

