-- CreateTable
CREATE TABLE "clinic_therapist_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinic_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_therapist_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_therapist_invites_token_key" ON "clinic_therapist_invites"("token");

-- CreateIndex
CREATE INDEX "clinic_therapist_invites_clinic_id_status_idx" ON "clinic_therapist_invites"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "clinic_therapist_invites_email_idx" ON "clinic_therapist_invites"("email");

-- AddForeignKey
ALTER TABLE "clinic_therapist_invites" ADD CONSTRAINT "clinic_therapist_invites_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_therapist_invites" ADD CONSTRAINT "clinic_therapist_invites_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
