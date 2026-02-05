-- CreateEnum
CREATE TYPE "SupervisorEscalationReason" AS ENUM ('MISSED_INTERVENTIONS', 'LOW_COMPLETION', 'NO_ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "SupervisorEscalationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "supervisor_escalations" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "reason" "SupervisorEscalationReason" NOT NULL,
    "note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "assign_to_therapist_id" UUID,
    "status" "SupervisorEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "supervisor_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supervisor_escalations_clinic_id_idx" ON "supervisor_escalations"("clinic_id");

-- CreateIndex
CREATE INDEX "supervisor_escalations_client_id_idx" ON "supervisor_escalations"("client_id");

-- CreateIndex
CREATE INDEX "supervisor_escalations_created_by_user_id_idx" ON "supervisor_escalations"("created_by_user_id");

-- CreateIndex
CREATE INDEX "supervisor_escalations_assign_to_therapist_id_idx" ON "supervisor_escalations"("assign_to_therapist_id");
