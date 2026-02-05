import { Injectable } from "@nestjs/common";
import PDFDocument = require("pdfkit");
import { AerReportService } from "../aer-report.service";

type AerReport = Awaited<ReturnType<AerReportService["generateAerReport"]>>;

type AerPdfResult = {
  buffer: Buffer;
  reportId: string;
};

type TableColumn = {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
};

const PAGE_SIZE = "LETTER";
const MARGIN = 50;
const FOOTER_HEIGHT = 20;
const FONT_NORMAL = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const TITLE_SIZE = 16;
const SECTION_SIZE = 12;
const BODY_SIZE = 10;
const TABLE_SIZE = 9;
const ROW_PADDING = 4;

const toDisplay = (value: unknown) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

@Injectable()
export class AerPdfService {
  constructor(private aerReportService: AerReportService) {}

  async generatePdfReport(
    clinicId: string,
    clientId: string,
    start: Date,
    end: Date,
    program?: string,
    options?: {
      periodStartLabel?: string;
      periodEndLabel?: string;
      generatedAtOverride?: Date;
    },
  ): Promise<AerPdfResult> {
    // Use the period end as generated_at to keep identical inputs deterministic.
    const report = await this.aerReportService.generateAerReport(
      clinicId,
      clientId,
      start,
      end,
      program,
      {
        periodStartLabel: options?.periodStartLabel,
        periodEndLabel: options?.periodEndLabel,
        generatedAtOverride: options?.generatedAtOverride ?? end,
      },
    );

    const buffer = await this.renderReport(report);

    return {
      buffer,
      reportId: report.audit_integrity.report_id,
    };
  }

  async renderReport(report: AerReport): Promise<Buffer> {
    const creationDate = this.parseIsoDate(report.meta.generated_at);
    const doc = new PDFDocument({
      size: PAGE_SIZE,
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: "Adherence Evidence Report (AER)",
        Creator: "Between Sessions",
        Producer: "Between Sessions",
        CreationDate: creationDate,
        ModDate: creationDate,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    this.renderContent(doc, report);
    this.renderFooters(doc, report.audit_integrity.report_id);

    doc.end();
    return completed;
  }

  private parseIsoDate(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date(0);
    }
    return parsed;
  }

  private renderContent(doc: PDFKit.PDFDocument, report: AerReport) {
    const contentWidth = doc.page.width - MARGIN * 2;
    const labelWidth = 140;
    const valueWidth = contentWidth - labelWidth;

    const pageBottom = () => doc.page.height - MARGIN - FOOTER_HEIGHT;

    const ensureSpace = (height: number) => {
      if (doc.y + height > pageBottom()) {
        doc.addPage();
      }
    };

    const sectionTitle = (text: string) => {
      ensureSpace(SECTION_SIZE + ROW_PADDING * 2);
      doc.font(FONT_BOLD).fontSize(SECTION_SIZE).text(text);
      doc.moveDown(0.3);
    };

    const renderKeyValue = (label: string, value: unknown) => {
      const labelText = toDisplay(label);
      const valueText = toDisplay(value);

      doc.font(FONT_BOLD).fontSize(BODY_SIZE);
      const labelHeight = doc.heightOfString(labelText, { width: labelWidth });
      doc.font(FONT_NORMAL).fontSize(BODY_SIZE);
      const valueHeight = doc.heightOfString(valueText, { width: valueWidth });
      const rowHeight = Math.max(labelHeight, valueHeight) + ROW_PADDING;

      ensureSpace(rowHeight);
      const y = doc.y;
      doc.font(FONT_BOLD).fontSize(BODY_SIZE).text(labelText, MARGIN, y, {
        width: labelWidth,
      });
      doc.font(FONT_NORMAL).fontSize(BODY_SIZE).text(valueText, MARGIN + labelWidth, y, {
        width: valueWidth,
      });
      doc.y = y + rowHeight;
    };

    const renderTable = (columns: TableColumn[], rows: string[][]) => {
      const drawHeader = () => {
        doc.font(FONT_BOLD).fontSize(TABLE_SIZE);
        const heights = columns.map((col) =>
          doc.heightOfString(col.header, { width: col.width, align: col.align ?? "left" }),
        );
        const rowHeight = Math.max(...heights) + ROW_PADDING;
        ensureSpace(rowHeight);
        const y = doc.y;
        let x = MARGIN;
        columns.forEach((col) => {
          doc.text(col.header, x, y, { width: col.width, align: col.align ?? "left" });
          x += col.width;
        });
        doc.y = y + rowHeight;
      };

      const drawRow = (cells: string[]) => {
        doc.font(FONT_NORMAL).fontSize(TABLE_SIZE);
        const heights = cells.map((cell, index) =>
          doc.heightOfString(cell, {
            width: columns[index].width,
            align: columns[index].align ?? "left",
          }),
        );
        const rowHeight = Math.max(...heights) + ROW_PADDING;
        if (doc.y + rowHeight > pageBottom()) {
          doc.addPage();
          drawHeader();
        }
        const y = doc.y;
        let x = MARGIN;
        cells.forEach((cell, index) => {
          doc.text(cell, x, y, {
            width: columns[index].width,
            align: columns[index].align ?? "left",
          });
          x += columns[index].width;
        });
        doc.y = y + rowHeight;
      };

      drawHeader();
      rows.forEach((row) => drawRow(row));
      doc.moveDown(0.5);
    };

    doc.font(FONT_BOLD).fontSize(TITLE_SIZE).text("Adherence Evidence Report (AER)");
    doc.font(FONT_NORMAL).fontSize(BODY_SIZE).text("Version: v1");
    doc.moveDown(0.5);

    sectionTitle("Meta");
    renderKeyValue("clinic_id", report.meta.clinic_id);
    renderKeyValue("client_id", report.meta.client_id);
    renderKeyValue("program", report.meta.program ?? null);
    renderKeyValue(
      "reporting_period",
      `${report.meta.period.start} to ${report.meta.period.end}`,
    );
    renderKeyValue("generated_at", report.meta.generated_at);
    renderKeyValue("report_id", report.audit_integrity.report_id);
    doc.moveDown(0.5);

    sectionTitle("Prescribed Interventions");
    const interventions = [...report.prescribed_interventions].sort((a, b) => {
      const aKey = a.assigned_at ?? "";
      const bKey = b.assigned_at ?? "";
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return a.assignment_id.localeCompare(b.assignment_id);
    });

    const interventionColumns: TableColumn[] = [
      { header: "Title", width: 160 },
      { header: "Assigned At", width: 80 },
      { header: "Due End", width: 80 },
      { header: "Completed", width: 48, align: "right" },
      { header: "Partial", width: 48, align: "right" },
      { header: "Missed", width: 48, align: "right" },
      { header: "Late", width: 48, align: "right" },
    ];

    const interventionRows = interventions.map((entry) => [
      (() => {
        const lines: string[] = [];
        lines.push(toDisplay(entry.title));
        if (entry.library_source) {
          const srcName =
            entry.library_source.title ??
            entry.library_source.slug ??
            entry.library_source.item_id;
          const versionLabel = entry.library_source.version_id
            ? ` v${entry.library_source.version_id}`
            : "";
          lines.push(`Source: ${toDisplay(srcName)}${versionLabel}`);
        }
        if (entry.reviewed_at) {
          lines.push(`Reviewed: ${toDisplay(entry.reviewed_at)}`);
        }
        return lines.join("\n");
      })(),
      toDisplay(entry.assigned_at),
      toDisplay(entry.due.end),
      toDisplay(entry.status_summary.completed),
      toDisplay(entry.status_summary.partial),
      toDisplay(entry.status_summary.missed),
      toDisplay(entry.status_summary.late),
    ]);

    renderTable(interventionColumns, interventionRows);

    sectionTitle("Adherence Timeline");
    const timeline = [...report.adherence_timeline].sort((a, b) => {
      if (a.ts !== b.ts) return a.ts.localeCompare(b.ts);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      const aRef = a.ref.assignment_id ?? a.ref.response_id ?? "";
      const bRef = b.ref.assignment_id ?? b.ref.response_id ?? "";
      if (aRef !== bRef) return aRef.localeCompare(bRef);
      return (a.ref.response_id ?? "").localeCompare(b.ref.response_id ?? "");
    });

    const timelineColumns: TableColumn[] = [
      { header: "Timestamp", width: 150 },
      { header: "Event Type", width: 160 },
      { header: "Source", width: 70 },
      { header: "Reference ID", width: 132 },
    ];

    const timelineRows = timeline.map((entry) => {
      const refId = entry.ref.assignment_id ?? entry.ref.response_id ?? null;
      return [
        toDisplay(entry.ts),
        toDisplay(entry.type),
        toDisplay(entry.source),
        toDisplay(refId),
      ];
    });

    renderTable(timelineColumns, timelineRows);

    sectionTitle("Noncompliance / Escalations");
    const escalations = [...report.noncompliance_escalations].sort((a, b) => {
      if (a.ts !== b.ts) return a.ts.localeCompare(b.ts);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.channel.localeCompare(b.channel);
    });

    const escalationColumns: TableColumn[] = [
      { header: "Timestamp", width: 200 },
      { header: "Type", width: 120 },
      { header: "Channel", width: 192 },
    ];

    const escalationRows = escalations.map((entry) => [
      toDisplay(entry.ts),
      toDisplay(entry.type),
      toDisplay(entry.channel),
    ]);

    renderTable(escalationColumns, escalationRows);

    sectionTitle("Clinician Review State");
    const reviewStatus = report.clinician_review.reviewed ? "reviewed" : "not_reviewed";
    renderKeyValue("status", reviewStatus);
    renderKeyValue(
      "reviewed_by_at",
      report.clinician_review.reviewed_at
        ? `${toDisplay(report.clinician_review.reviewed_by.name)} @ ${report.clinician_review.reviewed_at}`
        : null,
    );
    renderKeyValue("signed_by_at", null);
    renderKeyValue("notes", report.clinician_review.notes ?? null);
  }

  private renderFooters(doc: PDFKit.PDFDocument, reportId: string) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const footerY = doc.page.height - MARGIN - FOOTER_HEIGHT + 6;
      doc.font(FONT_NORMAL).fontSize(8).text(
        `Report ID: ${reportId} | Page ${i + 1} of ${range.count}`,
        MARGIN,
        footerY,
        {
          width: doc.page.width - MARGIN * 2,
          align: "center",
        },
      );
    }
    doc.flushPages();
  }
}
