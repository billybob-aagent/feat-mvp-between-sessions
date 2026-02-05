/*
  Warnings:

  - You are about to drop the column `therapist_note` on the `responses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "responses" DROP COLUMN "therapist_note",
ADD COLUMN     "therapist_note_cipher" BYTEA,
ADD COLUMN     "therapist_note_nonce" BYTEA,
ADD COLUMN     "therapist_note_tag" BYTEA;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
