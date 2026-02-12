import { PrismaClient } from "@prisma/client";
import { ingestStarterPack } from "../src/modules/library/starter-pack/ingest-starter-pack";

const prisma = new PrismaClient();

async function ensureClinicId() {
  if (process.env.CLINIC_ID) return process.env.CLINIC_ID;
  const clinic = await prisma.clinics.findFirst({ orderBy: { created_at: "asc" } });
  if (!clinic) throw new Error("No clinic found. Set CLINIC_ID env var.");
  return clinic.id;
}

async function run() {
  const clinicId = await ensureClinicId();
  const summary = await ingestStarterPack({ prisma, clinicId });
  const output = JSON.stringify(summary);
  if (!summary.ok || summary.validation_errors.length) {
    console.error(output);
    process.exitCode = 1;
    return;
  }
  console.log(`STARTER_PACK_INGEST_RESULT=${output}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
