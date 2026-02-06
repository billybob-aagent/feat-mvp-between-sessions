import { PrismaService } from "../src/modules/prisma/prisma.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { AssignmentsService } from "../src/modules/assignments/assignments.service";
import { ResponsesService } from "../src/modules/responses/responses.service";
import { AerReportService } from "../src/reports/aer/aer-report.service";
import { AerPdfService } from "../src/reports/aer/pdf/aer-pdf.service";
import { ExternalAccessService } from "../src/modules/external-access/external-access.service";
import { AiAssistService } from "../src/ai-assist/ai-assist.service";
import { AiSafetyGatewayService } from "../src/ai-safety-gateway/ai-safety-gateway.service";
import { RedactionService } from "../src/ai-safety-gateway/redaction/redaction.service";
import { PolicyService } from "../src/ai-safety-gateway/policy/policy.service";
import { RetrievalService } from "../src/ai-assist/retrieval/retrieval.service";
import {
  buildDateRangeFromParts,
  formatDateOnly,
  parseDateOnly,
  toDateOnlyStringLocal,
} from "../src/reports/aer/aer-report.utils";
import { LibraryItemStatus, UserRole } from "@prisma/client";
import * as argon2 from "argon2";

const DAY_MS = 24 * 60 * 60 * 1000;

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

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function resolveDateInput(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() || fallback;
  const parts = parseDateOnly(trimmed);
  if (!parts) {
    throw new Error(`Invalid date format: ${trimmed}. Expected YYYY-MM-DD.`);
  }
  return { label: trimmed, parts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const get = (key: string, fallback: string) => args[key] ?? process.env[key] ?? fallback;

  const now = new Date();
  const defaultEnd = now.toISOString().slice(0, 10);
  const defaultStart = new Date(now.getTime() - 7 * DAY_MS).toISOString().slice(0, 10);

  const clinicName = get("CLINIC_NAME", "Pilot Clinic");
  const clinicTimezone = get("CLINIC_TIMEZONE", "UTC");

  const clinicAdminEmail = get("CLINIC_ADMIN_EMAIL", "pilot-admin@betweensessions.local");
  const clinicAdminPassword = get("CLINIC_ADMIN_PASSWORD", "ChangeMeAdmin1!");

  const therapistEmail = get("THERAPIST_EMAIL", "pilot-therapist@betweensessions.local");
  const therapistName = get("THERAPIST_NAME", "Pilot Therapist");
  const therapistPassword = get("THERAPIST_PASSWORD", "ChangeMeTherapist1!");

  const clientPassword = get("CLIENT_PASSWORD", "ChangeMeClient1!");

  const clientCount = parseNumber(args.CLIENT_COUNT ?? process.env.CLIENT_COUNT, 5);
  const assignmentsPerClient = parseNumber(
    args.ASSIGNMENTS_PER_CLIENT ?? process.env.ASSIGNMENTS_PER_CLIENT,
    3,
  );

  const startInput = resolveDateInput(args.START_DATE ?? process.env.START_DATE, defaultStart);
  const endInput = resolveDateInput(args.END_DATE ?? process.env.END_DATE, defaultEnd);

  const includeEscalation = parseBool(
    args.INCLUDE_ESCALATION ?? process.env.INCLUDE_ESCALATION,
    true,
  );
  const includeExternalToken = parseBool(
    args.INCLUDE_EXTERNAL_TOKEN ?? process.env.INCLUDE_EXTERNAL_TOKEN,
    false,
  );
  const includeAiDrafts = parseBool(
    args.INCLUDE_AI_DRAFTS ?? process.env.INCLUDE_AI_DRAFTS,
    false,
  );

  const prisma = new PrismaService();
  await prisma.$connect();

  const audit = new AuditService(prisma);
  const notificationsStub = {
    notifyUser: async () => ({ created: false }),
  } as any;
  const assignmentsService = new AssignmentsService(prisma, notificationsStub, audit);
  const responsesService = new ResponsesService(prisma, audit);
  const aerReportService = new AerReportService(prisma);
  const aerPdfService = new AerPdfService(aerReportService);
  const externalAccessService = new ExternalAccessService(prisma, aerReportService, aerPdfService);

  const rangeStart = buildDateRangeFromParts(startInput.parts).start;
  const rangeEnd = buildDateRangeFromParts(endInput.parts).end;

  try {
    const clinicIdArg = args.CLINIC_ID ?? process.env.CLINIC_ID;
    let clinic = clinicIdArg
      ? await prisma.clinics.findUnique({ where: { id: clinicIdArg } })
      : await prisma.clinics.findFirst({ where: { name: clinicName } });

    if (!clinic) {
      clinic = await prisma.clinics.create({
        data: {
          name: clinicName,
          timezone: clinicTimezone,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`Created clinic ${clinic.name} (${clinic.id})`);
    }

    const adminHash = await argon2.hash(clinicAdminPassword);
    let clinicAdminUser = await prisma.users.findUnique({ where: { email: clinicAdminEmail } });
    if (!clinicAdminUser) {
      clinicAdminUser = await prisma.users.create({
        data: {
          email: clinicAdminEmail,
          password_hash: adminHash,
          role: UserRole.CLINIC_ADMIN,
          email_verified_at: new Date(),
        },
      });
    }

    const existingMembership = await prisma.clinic_memberships.findFirst({
      where: { clinic_id: clinic.id, user_id: clinicAdminUser.id },
    });
    if (!existingMembership) {
      await prisma.clinic_memberships.create({
        data: {
          clinic_id: clinic.id,
          user_id: clinicAdminUser.id,
          role: "ADMIN",
        },
      });
    }

    const therapistHash = await argon2.hash(therapistPassword);
    let therapistUser = await prisma.users.findUnique({ where: { email: therapistEmail } });
    if (!therapistUser) {
      therapistUser = await prisma.users.create({
        data: {
          email: therapistEmail,
          password_hash: therapistHash,
          role: UserRole.therapist,
          email_verified_at: new Date(),
        },
      });
    }

    let therapist = await prisma.therapists.findUnique({ where: { user_id: therapistUser.id } });
    if (!therapist) {
      therapist = await prisma.therapists.create({
        data: {
          user_id: therapistUser.id,
          clinic_id: clinic.id,
          full_name: therapistName,
          timezone: clinicTimezone,
        },
      });
    } else if (therapist.clinic_id !== clinic.id) {
      therapist = await prisma.therapists.update({
        where: { id: therapist.id },
        data: { clinic_id: clinic.id },
      });
    }

    const baseSlug = slugify(clinic.name || "pilot");
    const clientHash = await argon2.hash(clientPassword);

    const clients: { id: string; userId: string; email: string }[] = [];
    for (let i = 0; i < clientCount; i += 1) {
      const email = `pilot-client-${i + 1}@${baseSlug}.local`;
      let user = await prisma.users.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.users.create({
          data: {
            email,
            password_hash: clientHash,
            role: UserRole.client,
            email_verified_at: new Date(),
          },
        });
      }

      let client = await prisma.clients.findUnique({ where: { user_id: user.id } });
      if (!client) {
        client = await prisma.clients.create({
          data: {
            user_id: user.id,
            therapist_id: therapist.id,
            full_name: `Pilot Client ${i + 1}`,
          },
        });
      }

      clients.push({ id: client.id, userId: user.id, email });
    }

    const libraryItems = await prisma.library_items.findMany({
      where: { clinic_id: clinic.id, status: LibraryItemStatus.PUBLISHED },
      select: { id: true, title: true },
      orderBy: { created_at: "asc" },
    });

    if (libraryItems.length === 0) {
      throw new Error("No published library items found. Ingest/publish library items first.");
    }

    const totalAssignments = clientCount * assignmentsPerClient;
    const periodMs = rangeEnd.getTime() - rangeStart.getTime();
    const stepMs = Math.max(Math.floor(periodMs / (totalAssignments + 1)), 60 * 60 * 1000);

    const assignments: { id: string; clientId: string; createdAt: Date }[] = [];
    let cursorMs = rangeStart.getTime();

    for (const client of clients) {
      for (let j = 0; j < assignmentsPerClient; j += 1) {
        const item = libraryItems[(assignments.length + j) % libraryItems.length];
        const createdAt = new Date(cursorMs);
        const dueDate = new Date(Math.min(createdAt.getTime() + 3 * DAY_MS, rangeEnd.getTime()));
        const dueDateLabel = toDateOnlyStringLocal(dueDate);

        const created = await assignmentsService.createFromLibrary(
          therapistUser.id,
          UserRole.therapist,
          {
            clientId: client.id,
            libraryItemId: item.id,
            dueDate: dueDateLabel,
            note: "Pilot seed assignment",
            program: null,
          },
        );

        await prisma.assignments.update({
          where: { id: created.id },
          data: {
            created_at: createdAt,
            published_at: createdAt,
            due_date: dueDate,
          },
        });

        assignments.push({ id: created.id, clientId: client.id, createdAt });
        cursorMs += stepMs;
      }
    }

    const responses: { id: string; clientId: string; createdAt: Date; reviewed: boolean }[] = [];
    for (let i = 0; i < assignments.length; i += 1) {
      if (i % 2 !== 0) continue;
      const assignment = assignments[i];
      const client = clients.find((c) => c.id === assignment.clientId);
      if (!client) continue;

      const createdAt = new Date(Math.min(assignment.createdAt.getTime() + DAY_MS, rangeEnd.getTime()));
      const response = await responsesService.submit(client.userId, {
        assignmentId: assignment.id,
        text: `Pilot response ${i + 1}`,
        mood: 6,
      });

      await prisma.responses.update({
        where: { id: response.id },
        data: { created_at: createdAt },
      });

      responses.push({ id: response.id, clientId: client.id, createdAt, reviewed: false });
    }

    const reviewedResponseIds: string[] = [];
    for (let i = 0; i < responses.length; i += 1) {
      if (i % 2 !== 0) continue;
      const response = responses[i];
      await responsesService.markReviewed(therapistUser.id, response.id, "Reviewed in pilot seed");
      const reviewedAt = new Date(Math.min(response.createdAt.getTime() + DAY_MS, rangeEnd.getTime()));
      await prisma.responses.update({
        where: { id: response.id },
        data: { reviewed_at: reviewedAt },
      });
      response.reviewed = true;
      reviewedResponseIds.push(response.id);
    }

    let escalationId: string | null = null;
    if (includeEscalation && clients.length > 0) {
      const escalation = await prisma.supervisor_escalations.create({
        data: {
          clinic_id: clinic.id,
          client_id: clients[0].id,
          period_start: buildDateRangeFromParts(startInput.parts).start,
          period_end: buildDateRangeFromParts(endInput.parts).end,
          reason: "NO_ACTIVITY",
          note: "Pilot escalation placeholder",
          created_by_user_id: clinicAdminUser.id,
          assign_to_therapist_id: therapist.id,
          status: "OPEN",
        },
      });
      escalationId = escalation.id;
    }

    let externalTokenUrl: string | null = null;
    if (includeExternalToken && clients.length > 0) {
      const token = await externalAccessService.createAerToken({
        userId: clinicAdminUser.id,
        role: UserRole.CLINIC_ADMIN,
        clinicId: clinic.id,
        clientId: clients[0].id,
        start: startInput.label,
        end: endInput.label,
        program: null,
        format: "pdf",
        ttlMinutes: 60,
      });
      externalTokenUrl = token.url;
    }

    if (includeAiDrafts && clients.length > 0) {
      const aiSettings = await prisma.ai_clinic_settings.findUnique({
        where: { clinic_id: clinic.id },
      });
      if (aiSettings?.enabled) {
        const redaction = new RedactionService();
        const policy = new PolicyService(prisma);
        const gateway = new AiSafetyGatewayService(prisma, redaction, policy);
        const retrieval = new RetrievalService(prisma);
        const aiAssist = new AiAssistService(gateway, retrieval, prisma);

        try {
          await aiAssist.progressSummaryDraft({
            userId: clinicAdminUser.id,
            role: UserRole.CLINIC_ADMIN,
            payload: {
              clinicId: clinic.id,
              clientId: clients[0].id,
              periodStart: startInput.label,
              periodEnd: endInput.label,
            },
          });
        } catch (err) {
          console.warn("AI progress summary draft skipped:", err instanceof Error ? err.message : err);
        }

        if (escalationId) {
          try {
            await aiAssist.supervisorSummaryDraft({
              userId: clinicAdminUser.id,
              role: UserRole.CLINIC_ADMIN,
              payload: {
                clinicId: clinic.id,
                clientId: clients[0].id,
                periodStart: startInput.label,
                periodEnd: endInput.label,
              },
            });
          } catch (err) {
            console.warn("AI supervisor summary draft skipped:", err instanceof Error ? err.message : err);
          }
        }

        const reviewedResponse = reviewedResponseIds[0];
        if (reviewedResponse) {
          try {
            await aiAssist.adherenceFeedbackDraft({
              userId: clinicAdminUser.id,
              role: UserRole.CLINIC_ADMIN,
              payload: {
                clinicId: clinic.id,
                responseId: reviewedResponse,
              },
            });
          } catch (err) {
            console.warn("AI adherence feedback draft skipped:", err instanceof Error ? err.message : err);
          }
        }
      } else {
        console.warn("AI drafts requested but AI is disabled for the clinic.");
      }
    }

    if (clients.length > 0) {
      await aerReportService.generateAerReport(
        clinic.id,
        clients[0].id,
        rangeStart,
        rangeEnd,
        undefined,
        {
          periodStartLabel: startInput.label,
          periodEndLabel: endInput.label,
        },
      );

      await aerPdfService.generatePdfReport(
        clinic.id,
        clients[0].id,
        rangeStart,
        rangeEnd,
        undefined,
        {
          periodStartLabel: startInput.label,
          periodEndLabel: endInput.label,
        },
      );
    }

    const result = {
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicTimezone: clinic.timezone,
      clinicAdminEmail,
      therapistEmail,
      therapistName,
      clientIds: clients.map((c) => c.id),
      assignmentsCreated: assignments.length,
      responsesCreated: responses.length,
      reviewedResponseIds,
      periodStart: startInput.label,
      periodEnd: endInput.label,
      escalationId,
      externalTokenUrl,
    };

    console.log("PILOT_SEED_RESULT=" + JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
