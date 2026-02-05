-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('draft', 'published');

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_prompt_id_fkey";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "description" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'published',
ADD COLUMN     "title" TEXT,
ALTER COLUMN "prompt_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
