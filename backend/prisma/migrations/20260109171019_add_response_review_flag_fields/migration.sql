-- AlterTable
ALTER TABLE "responses" ADD COLUMN     "flagged_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" UUID,
ADD COLUMN     "therapist_note" TEXT;
