-- AlterTable
ALTER TABLE "responses"
ADD COLUMN     "mood" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "prompt_cipher" BYTEA,
ADD COLUMN     "prompt_nonce" BYTEA,
ADD COLUMN     "prompt_tag" BYTEA,
ADD COLUMN     "starred_at" TIMESTAMP(3),
ADD COLUMN     "starred_by_id" UUID;

-- CreateIndex
CREATE INDEX "responses_assignment_id_client_id_created_at_idx" ON "responses"("assignment_id", "client_id", "created_at");

-- CreateIndex
CREATE INDEX "responses_client_id_created_at_idx" ON "responses"("client_id", "created_at");

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_starred_by_id_fkey" FOREIGN KEY ("starred_by_id") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
