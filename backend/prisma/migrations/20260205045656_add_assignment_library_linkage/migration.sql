-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "library_item_id" UUID,
ADD COLUMN     "library_item_version" INTEGER,
ADD COLUMN     "library_source_content_type" TEXT,
ADD COLUMN     "library_source_slug" TEXT,
ADD COLUMN     "library_source_title" TEXT;

-- CreateIndex
CREATE INDEX "assignments_library_item_id_idx" ON "assignments"("library_item_id");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_library_item_id_fkey" FOREIGN KEY ("library_item_id") REFERENCES "library_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
