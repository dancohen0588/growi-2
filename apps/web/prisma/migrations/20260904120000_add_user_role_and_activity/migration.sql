-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabledAt" TIMESTAMPTZ(6),
ADD COLUMN     "lastSeenAt" TIMESTAMPTZ(6),
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "user_activities" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "surface" TEXT NOT NULL,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("userId","day","surface")
);

-- CreateIndex
CREATE INDEX "user_activities_day_surface_idx" ON "user_activities"("day", "surface");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

