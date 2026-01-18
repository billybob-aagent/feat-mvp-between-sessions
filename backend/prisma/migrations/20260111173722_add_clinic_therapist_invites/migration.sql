DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'clinic_therapist_invites'
  ) THEN
    ALTER TABLE "clinic_therapist_invites" DROP CONSTRAINT IF EXISTS "clinic_therapist_invites_clinic_id_fkey";
    ALTER TABLE "clinic_therapist_invites" ALTER COLUMN "id" DROP DEFAULT;
    ALTER TABLE "clinic_therapist_invites" ADD CONSTRAINT "clinic_therapist_invites_clinic_id_fkey"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
