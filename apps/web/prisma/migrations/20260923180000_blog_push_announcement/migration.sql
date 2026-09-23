-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "pushRequestedAt" TIMESTAMPTZ(6),
ADD COLUMN     "pushSentAt" TIMESTAMPTZ(6);

