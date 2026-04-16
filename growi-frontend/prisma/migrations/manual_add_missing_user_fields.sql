-- Migration: add missing User fields (never migrated to Supabase)
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gardenType" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarColor" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "alertConfig" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
