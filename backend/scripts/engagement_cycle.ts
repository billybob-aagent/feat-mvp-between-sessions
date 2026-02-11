import { PrismaService } from "../src/modules/prisma/prisma.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { EmailService } from "../src/modules/email/email.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { SupervisorActionsService } from "../src/supervisor-actions/supervisor-actions.service";
import { EngagementService } from "../src/modules/engagement/engagement.service";

const parseArgs = (argv: string[]) => {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.replace(/^--/, "");
    if (!trimmed) continue;
    if (trimmed.includes("=")) {
      const [key, value] = trimmed.split("=");
      out[key.replace(/-/g, "_").toUpperCase()] = value ?? "";
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[trimmed.replace(/-/g, "_").toUpperCase()] = next;
      i += 1;
    } else {
      out[trimmed.replace(/-/g, "_").toUpperCase()] = "true";
    }
  }
  return out;
};

const parseBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const assignmentIds = (args.ASSIGNMENT_ID ?? args.ASSIGNMENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const clinicId = args.CLINIC_ID?.trim() || undefined;
  const dryRun = parseBool(args.DRY_RUN, false);

  const prisma = new PrismaService();
  await prisma.$connect();

  const audit = new AuditService(prisma);
  const email = new EmailService();
  const notifications = new NotificationsService(prisma, email);
  const supervisorActions = new SupervisorActionsService(prisma, audit);
  const engagement = new EngagementService(prisma, notifications, audit, supervisorActions);

  try {
    const result = await engagement.runAutomation({
      assignmentIds: assignmentIds.length > 0 ? assignmentIds : undefined,
      clinicId,
      dryRun,
    });
    // eslint-disable-next-line no-console
    console.log("ENGAGEMENT_CYCLE_RESULT=" + JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
