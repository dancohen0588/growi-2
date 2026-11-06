-- La Sève, phase 7 (spec 17) : le défi de la semaine du quartier et ses résultats.
-- Uniquement des créations.

-- CreateTable
CREATE TABLE "quartier_weeks" (
    "week" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quartier_weeks_pkey" PRIMARY KEY ("week")
);

-- CreateTable
CREATE TABLE "quartier_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contributed" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,
    "reached" BOOLEAN NOT NULL,
    "secretSlug" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quartier_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quartier_results_userId_week_key" ON "quartier_results"("userId", "week");

-- AddForeignKey
ALTER TABLE "quartier_results" ADD CONSTRAINT "quartier_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
