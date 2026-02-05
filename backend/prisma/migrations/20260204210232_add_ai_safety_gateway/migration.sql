-- CreateEnum
CREATE TYPE "AiPurpose" AS ENUM ('DOCUMENTATION', 'ADHERENCE_REVIEW', 'SUPERVISOR_SUMMARY');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('ALLOWED', 'DENIED');

-- CreateTable
CREATE TABLE "ai_clinic_settings" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allow_client_facing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_clinic_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "purpose" "AiPurpose" NOT NULL,
    "status" "AiRequestStatus" NOT NULL,
    "denial_reason" TEXT,
    "input_hash" TEXT NOT NULL,
    "sanitized_hash" TEXT NOT NULL,
    "redaction_stats" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_clinic_settings_clinic_id_key" ON "ai_clinic_settings"("clinic_id");

-- CreateIndex
CREATE INDEX "ai_clinic_settings_clinic_id_idx" ON "ai_clinic_settings"("clinic_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_clinic_id_idx" ON "ai_request_logs"("clinic_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_user_id_idx" ON "ai_request_logs"("user_id");
