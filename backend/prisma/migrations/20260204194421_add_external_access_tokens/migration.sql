-- DropForeignKey
ALTER TABLE "clinic_therapist_invites" DROP CONSTRAINT "clinic_therapist_invites_clinic_id_fkey";

-- AlterTable
ALTER TABLE "clinic_therapist_invites" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "external_access_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "clinic_id" UUID NOT NULL,
    "client_id" UUID,
    "report_type" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "program" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_access_token_uses" (
    "id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,
    "path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,

    CONSTRAINT "external_access_token_uses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_access_tokens_token_hash_key" ON "external_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "external_access_tokens_clinic_id_idx" ON "external_access_tokens"("clinic_id");

-- CreateIndex
CREATE INDEX "external_access_tokens_client_id_idx" ON "external_access_tokens"("client_id");

-- CreateIndex
CREATE INDEX "external_access_tokens_expires_at_idx" ON "external_access_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "external_access_tokens_created_by_user_id_idx" ON "external_access_tokens"("created_by_user_id");

-- CreateIndex
CREATE INDEX "external_access_token_uses_token_id_idx" ON "external_access_token_uses"("token_id");

-- AddForeignKey
ALTER TABLE "clinic_therapist_invites" ADD CONSTRAINT "clinic_therapist_invites_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_access_token_uses" ADD CONSTRAINT "external_access_token_uses_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "external_access_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
