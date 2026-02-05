CREATE TYPE "LibraryItemStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "FormSignatureRequestStatus" AS ENUM ('pending', 'signed', 'canceled', 'expired');
CREATE TYPE "FormSignerRole" AS ENUM ('CLIENT', 'CLINICIAN', 'WITNESS');

CREATE TABLE "library_collections" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_items" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "LibraryItemStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "source_file_name" TEXT,
    "import_timestamp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_item_versions" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "metadata_snapshot" JSONB NOT NULL,
    "sections_snapshot" JSONB NOT NULL,
    "change_summary" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_item_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_tags" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_item_tags" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_item_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_chunks" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "heading_path" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "embeddings" (
    "id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "vector" DOUBLE PRECISION[] NOT NULL,
    "model_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_signature_requests" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "client_id" UUID,
    "clinician_id" UUID,
    "status" "FormSignatureRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "pdf_snapshot_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "form_signature_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_signatures" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "signer_role" "FormSignerRole" NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature_data" JSONB NOT NULL,
    "pdf_snapshot_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_signatures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_collections_clinic_id_idx" ON "library_collections"("clinic_id");
CREATE INDEX "library_items_clinic_id_status_idx" ON "library_items"("clinic_id", "status");
CREATE INDEX "library_items_collection_id_status_idx" ON "library_items"("collection_id", "status");
CREATE INDEX "library_items_slug_idx" ON "library_items"("slug");
CREATE UNIQUE INDEX "library_items_clinic_id_slug_key" ON "library_items"("clinic_id", "slug");
CREATE UNIQUE INDEX "library_item_versions_item_id_version_number_key" ON "library_item_versions"("item_id", "version_number");
CREATE INDEX "library_item_versions_item_id_idx" ON "library_item_versions"("item_id");
CREATE INDEX "library_tags_clinic_id_idx" ON "library_tags"("clinic_id");
CREATE UNIQUE INDEX "library_tags_clinic_id_name_key" ON "library_tags"("clinic_id", "name");
CREATE UNIQUE INDEX "library_item_tags_item_id_tag_id_key" ON "library_item_tags"("item_id", "tag_id");
CREATE INDEX "library_item_tags_tag_id_idx" ON "library_item_tags"("tag_id");
CREATE INDEX "library_chunks_item_id_version_number_idx" ON "library_chunks"("item_id", "version_number");
CREATE INDEX "library_chunks_heading_path_idx" ON "library_chunks"("heading_path");
CREATE INDEX "embeddings_chunk_id_idx" ON "embeddings"("chunk_id");
CREATE INDEX "form_signature_requests_clinic_id_status_idx" ON "form_signature_requests"("clinic_id", "status");
CREATE INDEX "form_signature_requests_item_id_idx" ON "form_signature_requests"("item_id");
CREATE INDEX "form_signatures_request_id_idx" ON "form_signatures"("request_id");

ALTER TABLE "library_collections" ADD CONSTRAINT "library_collections_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "library_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_item_versions" ADD CONSTRAINT "library_item_versions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_tags" ADD CONSTRAINT "library_tags_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_item_tags" ADD CONSTRAINT "library_item_tags_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_item_tags" ADD CONSTRAINT "library_item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "library_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_chunks" ADD CONSTRAINT "library_chunks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "library_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_signature_requests" ADD CONSTRAINT "form_signature_requests_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_signature_requests" ADD CONSTRAINT "form_signature_requests_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_signature_requests" ADD CONSTRAINT "form_signature_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_signature_requests" ADD CONSTRAINT "form_signature_requests_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_signatures" ADD CONSTRAINT "form_signatures_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "form_signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
