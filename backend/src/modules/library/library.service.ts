import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateLibraryItemDto } from "./dto/create-library-item.dto";
import { UpdateLibraryItemDto } from "./dto/update-library-item.dto";
import { PublishLibraryItemDto } from "./dto/publish-library-item.dto";
import { CreateSignatureRequestDto } from "./dto/create-signature-request.dto";
import { SignLibraryItemDto } from "./dto/sign-library-item.dto";
import { RagQueryDto } from "./dto/rag-query.dto";
import {
  FormSignatureRequestStatus,
  FormSignerRole,
  LibraryItemStatus,
  UserRole,
} from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { assertPublishable, buildChunks, normalizeMetadata, normalizeSections } from "./library.utils";

type ResolvedClinic = {
  clinicId: string;
  therapistId: string | null;
  clientId: string | null;
};

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private extractSections(raw: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    if (raw && typeof raw === "object") {
      const obj = raw as { sections?: unknown };
      if (Array.isArray(obj.sections)) return obj.sections as Array<Record<string, unknown>>;
    }
    return [];
  }

  // Guardrail: client-facing rendering must only include explicitly tagged client sections.
  private filterClientSections(raw: unknown): Array<Record<string, unknown>> {
    const sections = this.extractSections(raw);
    return sections.filter(
      (s) => String((s as any)?.audience ?? "").trim().toLowerCase() === "client",
    );
  }

  private async resolveClinicContext(
    userId: string,
    role: UserRole,
    clinicIdOverride: string | null,
  ): Promise<ResolvedClinic> {
    if (role === UserRole.admin) {
      if (!clinicIdOverride) {
        throw new BadRequestException("clinicId is required for admin requests");
      }
      return { clinicId: clinicIdOverride, therapistId: null, clientId: null };
    }

    if (role === UserRole.CLINIC_ADMIN) {
      const membership = await this.prisma.clinic_memberships.findFirst({
        where: { user_id: userId },
      });
      if (!membership) throw new ForbiddenException("Clinic membership required");
      return { clinicId: membership.clinic_id, therapistId: null, clientId: null };
    }

    if (role === UserRole.therapist) {
      const therapist = await this.prisma.therapists.findUnique({
        where: { user_id: userId },
        select: { id: true, clinic_id: true },
      });
      if (!therapist?.clinic_id) {
        throw new ForbiddenException("Therapist clinic required");
      }
      return { clinicId: therapist.clinic_id, therapistId: therapist.id, clientId: null };
    }

    const client = await this.prisma.clients.findUnique({
      where: { user_id: userId },
      select: { id: true, therapist: { select: { clinic_id: true } } },
    });
    if (!client?.therapist?.clinic_id) {
      throw new ForbiddenException("Client clinic required");
    }
    return { clinicId: client.therapist.clinic_id, therapistId: null, clientId: client.id };
  }


  private ensureUploadsDir() {
    const cwd = process.cwd();
    const base = cwd.endsWith(path.sep + "backend") ? cwd : path.join(cwd, "backend");
    const dir = path.join(base, "uploads", "library");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private async writeFormPdf(params: {
    fileName: string;
    item: { title: string; content_type: string; sections: any; version: number };
    requestId: string;
    requestedAt: Date;
    signatures?: Array<{
      role: string;
      signerName: string;
      signedAt: Date | null;
      typedSignature?: string | null;
      drawnSignatureDataUrl?: string | null;
    }>;
  }): Promise<string> {
    const outputDir = this.ensureUploadsDir();
    const filePath = path.join(outputDir, params.fileName);

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text(params.item.title, { align: "left" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(`Content type: ${params.item.content_type}`)
      .text(`Version: ${params.item.version}`)
      .text(`Request ID: ${params.requestId}`)
      .text(`Requested: ${params.requestedAt.toISOString()}`);

    doc.moveDown();
    // Client-facing: only include client audience sections.
    const sections = this.filterClientSections(params.item.sections);
    for (const section of sections) {
      const title =
        section?.title || section?.sectionType || section?.headingPath || "Section";
      const text = section?.text ?? "";
      doc.moveDown(0.5);
      doc.fontSize(12).text(String(title));
      doc.moveDown(0.25);
      doc.fontSize(10).text(String(text));
    }

    doc.addPage();
    doc.fontSize(14).text("Signature Blocks");
    doc.moveDown();

    const signatures = params.signatures ?? [
      { role: "CLIENT", signerName: "", signedAt: null },
      { role: "CLINICIAN", signerName: "", signedAt: null },
    ];

    for (const signature of signatures) {
      doc.fontSize(11).text(`${signature.role} Signature`);
      doc.fontSize(10).text(`Name: ${signature.signerName || "________________"}`);
      if (signature.typedSignature) {
        doc.fontSize(10).text(`Typed signature: ${signature.typedSignature}`);
      }
      doc
        .fontSize(10)
        .text(
          `Signed at: ${signature.signedAt ? signature.signedAt.toISOString() : "______________"}`,
        );
      if (signature.drawnSignatureDataUrl?.startsWith("data:image")) {
        const base64 = signature.drawnSignatureDataUrl.split(",")[1];
        if (base64) {
          const buffer = Buffer.from(base64, "base64");
          doc.image(buffer, { width: 200 });
        }
      }
      doc.moveDown();
    }

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", (err) => reject(err));
    });

    return filePath;
  }

  async listCollections(userId: string, role: UserRole, clinicIdOverride: string | null) {
    const { clinicId } = await this.resolveClinicContext(userId, role, clinicIdOverride);
    const collections = await this.prisma.library_collections.findMany({
      where: { clinic_id: clinicId },
      orderBy: { created_at: "asc" },
    });
    return collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      description: collection.description ?? null,
      createdAt: collection.created_at.toISOString(),
      updatedAt: collection.updated_at.toISOString(),
    }));
  }

  async listItems(
    userId: string,
    role: UserRole,
    filters: {
      clinicId: string | null;
      collectionId: string | null;
      type: string | null;
      domain: string | null;
      modality: string | null;
      population: string | null;
      complexity: string | null;
      sessionUse: string | null;
      status: string | null;
      q: string | null;
    },
  ) {
    const { clinicId } = await this.resolveClinicContext(userId, role, filters.clinicId);
    const normalizedStatus =
      role === UserRole.client
        ? LibraryItemStatus.PUBLISHED
        : filters.status === "draft"
          ? LibraryItemStatus.DRAFT
          : filters.status === "submitted"
            ? LibraryItemStatus.SUBMITTED
            : filters.status === "under_review"
              ? LibraryItemStatus.UNDER_REVIEW
              : filters.status === "approved"
                ? LibraryItemStatus.APPROVED
                : filters.status === "rejected"
                  ? LibraryItemStatus.REJECTED
                  : filters.status === "archived"
                    ? LibraryItemStatus.ARCHIVED
                    : filters.status === "published"
                      ? LibraryItemStatus.PUBLISHED
                      : undefined;

    const items = await this.prisma.library_items.findMany({
      where: {
        clinic_id: clinicId,
        collection_id: filters.collectionId ?? undefined,
        content_type: filters.type ?? undefined,
        status: normalizedStatus,
        title: filters.q ? { contains: filters.q, mode: "insensitive" } : undefined,
      },
      orderBy: { updated_at: "desc" },
    });

    const filtered = items.filter((item) => {
      const metadata = item.metadata as any;
      const domainOk = filters.domain
        ? Array.isArray(metadata?.primaryClinicalDomains) &&
          metadata.primaryClinicalDomains.some((d: string) =>
            String(d).toLowerCase().includes(filters.domain!.toLowerCase()),
          )
        : true;
      const modalityOk = filters.modality
        ? Array.isArray(metadata?.applicableModalities) &&
          metadata.applicableModalities.some((m: string) =>
            String(m).toLowerCase().includes(filters.modality!.toLowerCase()),
          )
        : true;
      const populationOk = filters.population
        ? Array.isArray(metadata?.targetPopulation) &&
          metadata.targetPopulation.some((p: string) =>
            String(p).toLowerCase().includes(filters.population!.toLowerCase()),
          )
        : true;
      const complexityOk = filters.complexity
        ? String(metadata?.clinicalComplexityLevel || "")
            .toLowerCase()
            .includes(filters.complexity!.toLowerCase())
        : true;
      const sessionOk = filters.sessionUse
        ? String(metadata?.sessionUse || "")
            .toLowerCase()
            .includes(filters.sessionUse!.toLowerCase())
        : true;
      return domainOk && modalityOk && populationOk && complexityOk && sessionOk;
    });

    return filtered.map((item) => ({
      id: item.id,
      collectionId: item.collection_id,
      slug: item.slug,
      title: item.title,
      contentType: item.content_type,
      status: item.status,
      version: item.version,
      metadata: item.metadata,
      updatedAt: item.updated_at.toISOString(),
    }));
  }

  async getItem(
    userId: string,
    role: UserRole,
    id: string,
    clinicIdOverride: string | null,
  ) {
    const { clinicId } = await this.resolveClinicContext(userId, role, clinicIdOverride);
    const item = await this.prisma.library_items.findFirst({
      where: { id, clinic_id: clinicId },
      include: {
        versions: { orderBy: { version_number: "desc" }, take: 10 },
        decisions: { orderBy: [{ created_at: "asc" }, { id: "asc" }], take: 100 },
      },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (role === UserRole.client && item.status !== LibraryItemStatus.PUBLISHED) {
      throw new ForbiddenException("Item not published");
    }
    const sections =
      role === UserRole.client ? this.filterClientSections(item.sections) : item.sections;
    return {
      id: item.id,
      collectionId: item.collection_id,
      slug: item.slug,
      title: item.title,
      contentType: item.content_type,
      metadata: item.metadata,
      sections,
      status: item.status,
      version: item.version,
      sourceFileName: item.source_file_name ?? null,
      importTimestamp: item.import_timestamp?.toISOString() ?? null,
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
      versions:
        role === UserRole.client
          ? []
          : item.versions.map((version) => ({
              id: version.id,
              versionNumber: version.version_number,
              changeSummary: version.change_summary ?? null,
              createdAt: version.created_at.toISOString(),
            })),
      decisions:
        role === UserRole.client
          ? []
          : item.decisions.map((d) => ({
              id: d.id,
              action: d.action,
              fromStatus: d.from_status,
              toStatus: d.to_status,
              reason: d.reason ?? null,
              actorUserId: d.actor_user_id ?? null,
              actorRole: d.actor_role,
              createdAt: d.created_at.toISOString(),
            })),
    };
  }

  async createItem(userId: string, role: UserRole, dto: CreateLibraryItemDto) {
    let clinicId: string;
    if (role === UserRole.admin) {
      const collection = await this.prisma.library_collections.findUnique({
        where: { id: dto.collectionId },
      });
      if (!collection) throw new NotFoundException("Collection not found");
      clinicId = collection.clinic_id;
    } else {
      clinicId = (await this.resolveClinicContext(userId, role, null)).clinicId;
    }
    const metadata = normalizeMetadata(dto.metadata, dto.contentType);
    const sections = normalizeSections(dto.sections);
    const versionNumber = 1;
    const chunks = buildChunks(dto.title, sections, versionNumber);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.library_items.create({
        data: {
          clinic_id: clinicId,
          collection_id: dto.collectionId,
          slug: dto.slug,
          title: dto.title,
          content_type: dto.contentType,
          metadata: metadata as any,
          sections: sections as any,
          status: LibraryItemStatus.DRAFT,
          version: versionNumber,
          created_by: userId,
          updated_by: userId,
        },
      });

      await tx.library_item_versions.create({
        data: {
          item_id: item.id,
          version_number: versionNumber,
          metadata_snapshot: metadata as any,
          sections_snapshot: sections as any,
          change_summary: dto.changeSummary ?? "Initial draft",
          created_by: userId,
        },
      });

      if (dto.tags?.length) {
        const tags = await Promise.all(
          dto.tags.map((name) =>
            tx.library_tags.upsert({
              where: { clinic_id_name: { clinic_id: clinicId, name } },
              update: {},
              create: { clinic_id: clinicId, name },
            }),
          ),
        );
        await tx.library_item_tags.createMany({
          data: tags.map((tag) => ({ item_id: item.id, tag_id: tag.id })),
          skipDuplicates: true,
        });
      }

      if (chunks.length) {
        await tx.library_chunks.createMany({
          data: chunks.map((chunk) => ({
            item_id: item.id,
            version_number: chunk.versionNumber,
            chunk_index: chunk.chunkIndex,
            heading_path: chunk.headingPath,
            text: chunk.text,
            token_count: chunk.tokenCount,
          })),
        });
      }

      return item;
    });

    await this.audit.log({
      userId,
      action: "library.item.created",
      entityType: "library_item",
      entityId: result.id,
    });

    return { id: result.id };
  }

  async updateItem(userId: string, role: UserRole, id: string, dto: UpdateLibraryItemDto) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    const clinicId = clinicContext?.clinicId ?? item.clinic_id;

    // Governance: edits are only allowed while item is a draft or after rejection (fix-and-resubmit).
    if (item.status !== LibraryItemStatus.DRAFT && item.status !== LibraryItemStatus.REJECTED) {
      throw new BadRequestException("Item is not editable in its current status");
    }

    const nextContentType = dto.contentType ?? item.content_type;
    const metadata = dto.metadata
      ? normalizeMetadata(dto.metadata, nextContentType)
      : (item.metadata as any);
    const rawSections = item.sections as any;
    const sections = dto.sections
      ? normalizeSections(dto.sections)
      : (Array.isArray(rawSections) ? rawSections : rawSections?.sections ?? []);

    const nextVersion = item.version + 1;
    const chunks = buildChunks(dto.title ?? item.title, sections as any, nextVersion);

    const nextStatus =
      item.status === LibraryItemStatus.REJECTED ? LibraryItemStatus.DRAFT : item.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: {
          collection_id: dto.collectionId ?? item.collection_id,
          slug: dto.slug ?? item.slug,
          title: dto.title ?? item.title,
          content_type: nextContentType,
          metadata: metadata as any,
          sections: sections as any,
          version: nextVersion,
          status: nextStatus,
          updated_by: userId,
        },
      });

      await tx.library_item_versions.create({
        data: {
          item_id: item.id,
          version_number: nextVersion,
          metadata_snapshot: metadata as any,
          sections_snapshot: sections as any,
          change_summary: dto.changeSummary ?? "Updated content",
          created_by: userId,
        },
      });

      if (dto.tags) {
        await tx.library_item_tags.deleteMany({ where: { item_id: item.id } });
        if (dto.tags.length) {
          const tags = await Promise.all(
            dto.tags.map((name) =>
              tx.library_tags.upsert({
                where: { clinic_id_name: { clinic_id: clinicId, name } },
                update: {},
                create: { clinic_id: clinicId, name },
              }),
            ),
          );
          await tx.library_item_tags.createMany({
            data: tags.map((tag) => ({ item_id: item.id, tag_id: tag.id })),
            skipDuplicates: true,
          });
        }
      }

      await tx.library_chunks.deleteMany({ where: { item_id: item.id } });
      if (chunks.length) {
        await tx.library_chunks.createMany({
          data: chunks.map((chunk) => ({
            item_id: item.id,
            version_number: chunk.versionNumber,
            chunk_index: chunk.chunkIndex,
            heading_path: chunk.headingPath,
            text: chunk.text,
            token_count: chunk.tokenCount,
          })),
        });
      }

      if (item.status !== nextStatus) {
        await tx.library_item_decisions.create({
          data: {
            item_id: item.id,
            actor_user_id: userId,
            actor_role: role,
            action: "library.item.revised",
            from_status: item.status,
            to_status: nextStatus,
            reason: dto.changeSummary ?? null,
          },
        });
      }

      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.updated",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, version: updated.version };
  }

  async publishItem(
    userId: string,
    role: UserRole,
    id: string,
    dto: PublishLibraryItemDto,
  ) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (item.status !== LibraryItemStatus.APPROVED) {
      throw new BadRequestException("Item must be approved before publishing");
    }

    assertPublishable(item);

    const nextVersion = item.version + 1;
    const rawSections = item.sections as any;
    const sections = Array.isArray(rawSections) ? rawSections : rawSections?.sections ?? [];
    const chunks = buildChunks(item.title, sections, nextVersion);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: {
          status: LibraryItemStatus.PUBLISHED,
          version: nextVersion,
          updated_by: userId,
        },
      });

      await tx.library_item_decisions.create({
        data: {
          item_id: item.id,
          actor_user_id: userId,
          actor_role: role,
          action: "library.item.published",
          from_status: item.status,
          to_status: LibraryItemStatus.PUBLISHED,
          reason: dto.changeSummary ?? null,
        },
      });

      await tx.library_item_versions.create({
        data: {
          item_id: item.id,
          version_number: nextVersion,
          metadata_snapshot: item.metadata as any,
          sections_snapshot: item.sections as any,
          change_summary: dto.changeSummary ?? "Published",
          created_by: userId,
        },
      });

      await tx.library_chunks.deleteMany({ where: { item_id: item.id } });
      if (chunks.length) {
        await tx.library_chunks.createMany({
          data: chunks.map((chunk) => ({
            item_id: item.id,
            version_number: chunk.versionNumber,
            chunk_index: chunk.chunkIndex,
            heading_path: chunk.headingPath,
            text: chunk.text,
            token_count: chunk.tokenCount,
          })),
        });
      }

      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.published",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, status: updated.status, version: updated.version };
  }

  async submitItem(userId: string, role: UserRole, id: string) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (item.status !== LibraryItemStatus.DRAFT) {
      throw new BadRequestException("Only draft items can be submitted");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: { status: LibraryItemStatus.SUBMITTED, updated_by: userId },
      });
      await tx.library_item_decisions.create({
        data: {
          item_id: item.id,
          actor_user_id: userId,
          actor_role: role,
          action: "library.item.submitted",
          from_status: item.status,
          to_status: LibraryItemStatus.SUBMITTED,
          reason: null,
        },
      });
      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.submitted",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, status: updated.status };
  }

  async startReview(userId: string, role: UserRole, id: string) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (item.status !== LibraryItemStatus.SUBMITTED) {
      throw new BadRequestException("Only submitted items can be moved to under review");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: { status: LibraryItemStatus.UNDER_REVIEW, updated_by: userId },
      });
      await tx.library_item_decisions.create({
        data: {
          item_id: item.id,
          actor_user_id: userId,
          actor_role: role,
          action: "library.item.review_started",
          from_status: item.status,
          to_status: LibraryItemStatus.UNDER_REVIEW,
          reason: null,
        },
      });
      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.review_started",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, status: updated.status };
  }

  async approveItem(userId: string, role: UserRole, id: string) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (item.status !== LibraryItemStatus.UNDER_REVIEW) {
      throw new BadRequestException("Only under-review items can be approved");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: { status: LibraryItemStatus.APPROVED, updated_by: userId },
      });
      await tx.library_item_decisions.create({
        data: {
          item_id: item.id,
          actor_user_id: userId,
          actor_role: role,
          action: "library.item.approved",
          from_status: item.status,
          to_status: LibraryItemStatus.APPROVED,
          reason: null,
        },
      });
      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.approved",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, status: updated.status };
  }

  async rejectItem(userId: string, role: UserRole, id: string, reason: string) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (item.status !== LibraryItemStatus.SUBMITTED && item.status !== LibraryItemStatus.UNDER_REVIEW) {
      throw new BadRequestException("Only submitted or under-review items can be rejected");
    }

    const normalized = reason.trim();
    if (!normalized) throw new BadRequestException("reason is required");

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: { status: LibraryItemStatus.REJECTED, updated_by: userId },
      });
      await tx.library_item_decisions.create({
        data: {
          item_id: item.id,
          actor_user_id: userId,
          actor_role: role,
          action: "library.item.rejected",
          from_status: item.status,
          to_status: LibraryItemStatus.REJECTED,
          reason: normalized,
        },
      });
      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.rejected",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, status: updated.status };
  }

  async reviewQueue(
    userId: string,
    role: UserRole,
    clinicIdOverride: string | null,
    statusFilter: string | null,
  ) {
    const { clinicId } = await this.resolveClinicContext(userId, role, clinicIdOverride);
    const allowedStatuses = new Set([
      LibraryItemStatus.SUBMITTED,
      LibraryItemStatus.UNDER_REVIEW,
      LibraryItemStatus.APPROVED,
    ]);
    const normalized =
      statusFilter === "SUBMITTED"
        ? LibraryItemStatus.SUBMITTED
        : statusFilter === "UNDER_REVIEW"
          ? LibraryItemStatus.UNDER_REVIEW
          : statusFilter === "APPROVED"
            ? LibraryItemStatus.APPROVED
            : null;

    const statuses = normalized ? [normalized] : Array.from(allowedStatuses);
    const items = await this.prisma.library_items.findMany({
      where: { clinic_id: clinicId, status: { in: statuses } },
      orderBy: [{ updated_at: "asc" }, { id: "asc" }],
      include: { decisions: { orderBy: [{ created_at: "desc" }, { id: "asc" }], take: 1 } },
      take: 500,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        collectionId: item.collection_id,
        title: item.title,
        slug: item.slug,
        contentType: item.content_type,
        status: item.status,
        version: item.version,
        updatedAt: item.updated_at.toISOString(),
        lastDecisionAt: item.decisions[0]?.created_at.toISOString() ?? null,
        lastDecisionAction: item.decisions[0]?.action ?? null,
      })),
    };
  }

  async archiveItem(userId: string, role: UserRole, id: string) {
    const clinicContext =
      role === UserRole.admin ? null : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id, ...(clinicContext ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.library_items.update({
        where: { id: item.id },
        data: { status: LibraryItemStatus.ARCHIVED, updated_by: userId },
      });
      await tx.library_item_decisions.create({
        data: {
          item_id: item.id,
          actor_user_id: userId,
          actor_role: role,
          action: "library.item.archived",
          from_status: item.status,
          to_status: LibraryItemStatus.ARCHIVED,
          reason: null,
        },
      });
      return updatedItem;
    });

    await this.audit.log({
      userId,
      action: "library.item.archived",
      entityType: "library_item",
      entityId: updated.id,
    });

    return { id: updated.id, status: updated.status };
  }

  async search(
    userId: string,
    role: UserRole,
    query: string,
    limit: number,
    clinicIdOverride: string | null,
  ) {
    const { clinicId } = await this.resolveClinicContext(userId, role, clinicIdOverride);
    const q = query.trim();
    if (!q) return { items: [] };
    if (role === UserRole.client) {
      // Safety boundary: clients must never see clinician-audience content via chunk search.
      // Use client-audience sections as the search corpus (deterministic, best-effort).
      const items = await this.prisma.library_items.findMany({
        where: { clinic_id: clinicId, status: LibraryItemStatus.PUBLISHED },
        select: { id: true, title: true, content_type: true, status: true, sections: true },
      });
      const qLower = q.toLowerCase();
      const matches: Array<{
        score: number;
        itemId: string;
        itemTitle: string;
        contentType: string;
        status: string;
        headingPath: string;
        snippet: string;
      }> = [];

      for (const item of items) {
        const sections = this.filterClientSections(item.sections);
        for (const section of sections) {
          const headingPath =
            String((section as any)?.headingPath ?? "").trim() ||
            String((section as any)?.title ?? "").trim() ||
            item.title;
          const text = String((section as any)?.text ?? "");
          const idx = text.toLowerCase().indexOf(qLower);
          if (idx < 0) continue;
          const start = Math.max(0, idx - 80);
          const end = Math.min(text.length, idx + 160);
          const snippet = text.slice(start, end);
          const score = text.toLowerCase().split(qLower).length - 1;
          matches.push({
            score,
            itemId: item.id,
            itemTitle: item.title,
            contentType: item.content_type,
            status: item.status,
            headingPath,
            snippet,
          });
        }
      }

      matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
        return a.headingPath.localeCompare(b.headingPath);
      });

      return { items: matches.slice(0, limit).map(({ score: _score, ...row }) => row) };
    }

    const chunks = await this.prisma.library_chunks.findMany({
      where: {
        item: { clinic_id: clinicId },
        text: { contains: q, mode: "insensitive" },
      },
      take: limit,
      include: {
        item: { select: { id: true, title: true, content_type: true, status: true } },
      },
    });

    return {
      items: chunks.map((chunk) => ({
        itemId: chunk.item_id,
        itemTitle: chunk.item.title,
        contentType: chunk.item.content_type,
        status: chunk.item.status,
        headingPath: chunk.heading_path,
        snippet: chunk.text.slice(0, 240),
      })),
    };
  }

  async ragQuery(userId: string, role: UserRole, dto: RagQueryDto) {
    const { clinicId } = await this.resolveClinicContext(userId, role, dto.clinicId ?? null);
    const limit = Math.min(Math.max(dto.limit ?? 6, 1), 20);
    const q = dto.query.trim();
    if (!q) throw new BadRequestException("query required");
    if (role === UserRole.client) {
      // Safety boundary: clients must never see clinician-audience content via RAG retrieval.
      const items = await this.prisma.library_items.findMany({
        where: { clinic_id: clinicId, status: LibraryItemStatus.PUBLISHED },
        select: { id: true, title: true, content_type: true, status: true, sections: true },
      });
      const qLower = q.toLowerCase();
      const matches: Array<{
        score: number;
        itemId: string;
        itemTitle: string;
        contentType: string;
        status: string;
        headingPath: string;
        text: string;
      }> = [];
      for (const item of items) {
        const sections = this.filterClientSections(item.sections);
        for (const section of sections) {
          const headingPath =
            String((section as any)?.headingPath ?? "").trim() ||
            String((section as any)?.title ?? "").trim() ||
            item.title;
          const text = String((section as any)?.text ?? "");
          if (!text.toLowerCase().includes(qLower)) continue;
          const score = text.toLowerCase().split(qLower).length - 1;
          matches.push({
            score,
            itemId: item.id,
            itemTitle: item.title,
            contentType: item.content_type,
            status: item.status,
            headingPath,
            text,
          });
        }
      }

      matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
        return a.headingPath.localeCompare(b.headingPath);
      });

      return { query: q, chunks: matches.slice(0, limit).map(({ score: _s, ...row }) => row) };
    }

    const chunks = await this.prisma.library_chunks.findMany({
      where: {
        item: { clinic_id: clinicId },
        text: { contains: q, mode: "insensitive" },
      },
      take: limit,
      include: {
        item: { select: { id: true, title: true, content_type: true, status: true } },
      },
    });

    return {
      query: q,
      chunks: chunks.map((chunk) => ({
        itemId: chunk.item_id,
        itemTitle: chunk.item.title,
        contentType: chunk.item.content_type,
        status: chunk.item.status,
        headingPath: chunk.heading_path,
        text: chunk.text,
      })),
    };
  }

  async createSignatureRequest(
    userId: string,
    role: UserRole,
    itemId: string,
    dto: CreateSignatureRequestDto,
  ) {
    const clinicContext =
      role === UserRole.admin
        ? { clinicId: null, therapistId: null }
        : await this.resolveClinicContext(userId, role, null);
    const item = await this.prisma.library_items.findFirst({
      where: { id: itemId, ...(clinicContext.clinicId ? { clinic_id: clinicContext.clinicId } : {}) },
    });
    if (!item) throw new NotFoundException("Library item not found");
    if (!item.content_type.toLowerCase().includes("form")) {
      throw new BadRequestException("Signature requests are only available for forms");
    }
    const clinicId = clinicContext.clinicId ?? item.clinic_id;

    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    const request = await this.prisma.form_signature_requests.create({
      data: {
        clinic_id: clinicId,
        item_id: item.id,
        client_id: dto.clientId,
        clinician_id: clinicContext.therapistId,
        status: FormSignatureRequestStatus.pending,
        due_at: dueAt,
      },
    });

    const pdfPath = await this.writeFormPdf({
      fileName: `request-${request.id}.pdf`,
      item: {
        title: item.title,
        content_type: item.content_type,
        sections: item.sections,
        version: item.version,
      },
      requestId: request.id,
      requestedAt: request.requested_at,
    });

    await this.prisma.form_signature_requests.update({
      where: { id: request.id },
      data: { pdf_snapshot_ref: pdfPath },
    });

    await this.audit.log({
      userId,
      action: "library.signature.requested",
      entityType: "form_signature_request",
      entityId: request.id,
    });

    return {
      id: request.id,
      status: request.status,
      pdfSnapshotRef: pdfPath,
    };
  }

  async listSignatureRequests(
    userId: string,
    role: UserRole,
    filters: {
      clinicId: string | null;
      status: string | null;
      clientId: string | null;
      itemId: string | null;
      limit: number;
    },
  ) {
    const { clinicId, therapistId, clientId } = await this.resolveClinicContext(
      userId,
      role,
      filters.clinicId,
    );

    const normalizedStatus =
      filters.status === "pending" ||
      filters.status === "signed" ||
      filters.status === "canceled" ||
      filters.status === "expired"
        ? filters.status
        : null;

    const where: Record<string, unknown> = { clinic_id: clinicId };
    if (normalizedStatus) where.status = normalizedStatus;
    if (filters.itemId) where.item_id = filters.itemId;

    if (role === UserRole.client) {
      where.client_id = clientId;
    } else if (role === UserRole.therapist) {
      // Therapist can only see their own requests to avoid leaking cross-therapist client data.
      where.clinician_id = therapistId;
      if (filters.clientId) where.client_id = filters.clientId;
    } else {
      // CLINIC_ADMIN/admin can filter by client.
      if (filters.clientId) where.client_id = filters.clientId;
    }

    const requests = await this.prisma.form_signature_requests.findMany({
      where: where as any,
      take: filters.limit,
      orderBy: [{ requested_at: "desc" }, { id: "asc" }],
      include: {
        item: { select: { id: true, title: true, content_type: true, status: true } },
        signatures: {
          select: { signed_at: true, created_at: true },
          orderBy: [{ created_at: "desc" }, { id: "asc" }],
          take: 1,
        },
      },
    });

    return {
      items: requests.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        itemTitle: r.item.title,
        itemContentType: r.item.content_type,
        itemStatus: r.item.status,
        status: r.status,
        requestedAt: r.requested_at.toISOString(),
        dueAt: r.due_at ? r.due_at.toISOString() : null,
        signedAt: r.signatures[0]?.signed_at ? r.signatures[0].signed_at.toISOString() : null,
      })),
    };
  }

  async signRequest(
    userId: string,
    role: UserRole,
    requestId: string,
    dto: SignLibraryItemDto,
  ) {
    const { clinicId, therapistId, clientId } = await this.resolveClinicContext(userId, role, null);
    const request = await this.prisma.form_signature_requests.findFirst({
      where: { id: requestId, clinic_id: clinicId },
      include: { item: true },
    });
    if (!request) throw new NotFoundException("Signature request not found");
    if (request.status !== FormSignatureRequestStatus.pending) {
      throw new BadRequestException("Signature request is not pending");
    }

    let signerRole: FormSignerRole;
    if (role === UserRole.client) {
      if (!clientId || request.client_id !== clientId) {
        throw new ForbiddenException("Client not authorized to sign");
      }
      signerRole = FormSignerRole.CLIENT;
    } else {
      if (request.clinician_id && therapistId !== request.clinician_id) {
        throw new ForbiddenException("Clinician not authorized to sign");
      }
      signerRole = FormSignerRole.CLINICIAN;
    }

    const signatureData = {
      signerName: dto.signerName,
      typedSignature: dto.typedSignature ?? null,
      drawnSignatureDataUrl: dto.drawnSignatureDataUrl ?? null,
      signerMeta: dto.signerMeta ?? null,
    };

    const pdfPath = await this.writeFormPdf({
      fileName: `signed-${request.id}-${Date.now()}.pdf`,
      item: {
        title: request.item.title,
        content_type: request.item.content_type,
        sections: request.item.sections,
        version: request.item.version,
      },
      requestId: request.id,
      requestedAt: request.requested_at,
      signatures: [
        {
          role: signerRole,
          signerName: dto.signerName,
          signedAt: new Date(),
          typedSignature: dto.typedSignature ?? null,
          drawnSignatureDataUrl: dto.drawnSignatureDataUrl ?? null,
        },
      ],
    });

    const signature = await this.prisma.form_signatures.create({
      data: {
        request_id: request.id,
        signer_role: signerRole,
        signature_data: signatureData as any,
        pdf_snapshot_ref: pdfPath,
      },
    });

    await this.prisma.form_signature_requests.update({
      where: { id: request.id },
      data: { status: FormSignatureRequestStatus.signed },
    });

    await this.audit.log({
      userId,
      action: "library.signature.signed",
      entityType: "form_signature",
      entityId: signature.id,
    });

    return {
      id: signature.id,
      status: "signed",
      pdfSnapshotRef: pdfPath,
    };
  }

  async streamSignaturePdf(
    userId: string,
    role: UserRole,
    requestId: string,
    res: any,
    clinicIdOverride: string | null,
  ) {
    const { clinicId, clientId, therapistId } = await this.resolveClinicContext(
      userId,
      role,
      clinicIdOverride,
    );
    const request = await this.prisma.form_signature_requests.findFirst({
      where: { id: requestId, clinic_id: clinicId },
      include: { signatures: { orderBy: { created_at: "desc" }, take: 1 } },
    });
    if (!request) throw new NotFoundException("Signature request not found");

    if (role === UserRole.client && request.client_id !== clientId) {
      throw new ForbiddenException("Client not authorized");
    }
    if (role === UserRole.therapist && request.clinician_id && request.clinician_id !== therapistId) {
      throw new ForbiddenException("Clinician not authorized");
    }

    const latestSignature = request.signatures[0];
    const filePath =
      latestSignature?.pdf_snapshot_ref ?? request.pdf_snapshot_ref ?? null;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException("PDF snapshot not found");
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="form-${requestId}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  }
}
