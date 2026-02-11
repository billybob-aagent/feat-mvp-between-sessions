-- CreateEnum
CREATE TYPE "ResponseCompletionStatus" AS ENUM ('COMPLETED', 'PARTIAL');

-- AlterTable
ALTER TABLE "responses" ADD COLUMN     "completion_status" "ResponseCompletionStatus" NOT NULL DEFAULT 'COMPLETED';

-- AlterTable
ALTER TABLE "supervisor_escalations" ADD COLUMN     "source_assignment_id" UUID;

-- CreateIndex
CREATE INDEX "supervisor_escalations_source_assignment_id_idx" ON "supervisor_escalations"("source_assignment_id");
