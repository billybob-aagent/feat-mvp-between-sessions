-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LibraryItemStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "LibraryItemStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "LibraryItemStatus" ADD VALUE 'APPROVED';
ALTER TYPE "LibraryItemStatus" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "library_item_decisions" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_role" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" "LibraryItemStatus" NOT NULL,
    "to_status" "LibraryItemStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_item_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_item_decisions_item_id_created_at_idx" ON "library_item_decisions"("item_id", "created_at");

-- CreateIndex
CREATE INDEX "library_item_decisions_to_status_created_at_idx" ON "library_item_decisions"("to_status", "created_at");

-- AddForeignKey
ALTER TABLE "library_item_decisions" ADD CONSTRAINT "library_item_decisions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
