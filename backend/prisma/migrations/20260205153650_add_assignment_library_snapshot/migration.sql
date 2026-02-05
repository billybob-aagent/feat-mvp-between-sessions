-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "library_assigned_checksum_sha256" TEXT,
ADD COLUMN     "library_assigned_slug" TEXT,
ADD COLUMN     "library_assigned_title" TEXT,
ADD COLUMN     "library_assigned_version_number" INTEGER;
