-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "library_item_version_id" UUID;

-- CreateIndex
CREATE INDEX "assignments_library_item_version_id_idx" ON "assignments"("library_item_version_id");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_library_item_version_id_fkey" FOREIGN KEY ("library_item_version_id") REFERENCES "library_item_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
