-- CreateTable
CREATE TABLE "identify_quotas" (
    "ip_hash" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "identify_quotas_pkey" PRIMARY KEY ("ip_hash","day")
);

-- CreateIndex
CREATE INDEX "identify_quotas_day_idx" ON "identify_quotas"("day");

