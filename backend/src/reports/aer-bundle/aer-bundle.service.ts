import { Injectable } from "@nestjs/common";
import * as crypto from "node:crypto";
import { AerReportService } from "../aer/aer-report.service";
import { AerPdfService } from "../aer/pdf/aer-pdf.service";

@Injectable()
export class AerBundleService {
  constructor(
    private aerReport: AerReportService,
    private aerPdf: AerPdfService,
  ) {}

  private sha256(data: Buffer | string) {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  async generateBundle(params: {
    clinicId: string;
    clientId: string;
    start: Date;
    end: Date;
    periodStartLabel: string;
    periodEndLabel: string;
  }) {
    const report = await this.aerReport.generateAerReport(
      params.clinicId,
      params.clientId,
      params.start,
      params.end,
      undefined,
      {
        periodStartLabel: params.periodStartLabel,
        periodEndLabel: params.periodEndLabel,
        generatedAtOverride: params.end,
      },
    );

    const { buffer: pdfBuffer } = await this.aerPdf.generatePdfReport(
      params.clinicId,
      params.clientId,
      params.start,
      params.end,
      undefined,
      {
        periodStartLabel: params.periodStartLabel,
        periodEndLabel: params.periodEndLabel,
        generatedAtOverride: params.end,
      },
    );

    const jsonString = JSON.stringify(report);
    const jsonBuffer = Buffer.from(jsonString, "utf8");
    const jsonHash = this.sha256(jsonBuffer);
    const pdfHash = this.sha256(pdfBuffer);
    const verification = JSON.stringify(report.meta.verification ?? null);

    const verificationText = [
      `REPORT_ID=${report.audit_integrity?.report_id ?? ""}`,
      `GENERATED_AT=${report.meta.generated_at}`,
      `META_VERIFICATION=${verification}`,
      `JSON_SHA256=${jsonHash}`,
      `PDF_SHA256=${pdfHash}`,
      "NOTE=Hashes validate integrity and determinism for this period.",
    ].join("\n");

    const buffer = this.createZip([
      { name: "AER.json", data: jsonBuffer },
      { name: "AER.pdf", data: pdfBuffer },
      { name: "verification.txt", data: Buffer.from(verificationText, "utf8") },
    ], new Date(report.meta.generated_at));

    return {
      buffer,
      reportId: report.audit_integrity?.report_id ?? null,
      jsonHash,
      pdfHash,
      verificationText,
    };
  }

  private createZip(
    files: Array<{ name: string; data: Buffer }>,
    generatedAt: Date,
  ): Buffer {
    const { dosDate, dosTime } = this.toDosDateTime(generatedAt);
    const fileRecords: Buffer[] = [];
    const centralRecords: Buffer[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBuf = Buffer.from(file.name, "utf8");
      const crc = this.crc32(file.data);
      const size = file.data.length;

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4); // version needed
      localHeader.writeUInt16LE(0, 6); // flags
      localHeader.writeUInt16LE(0, 8); // compression (store)
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(size, 18);
      localHeader.writeUInt32LE(size, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      const localRecord = Buffer.concat([localHeader, nameBuf, file.data]);
      fileRecords.push(localRecord);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4); // version made by
      centralHeader.writeUInt16LE(20, 6); // version needed
      centralHeader.writeUInt16LE(0, 8); // flags
      centralHeader.writeUInt16LE(0, 10); // compression
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(size, 20);
      centralHeader.writeUInt32LE(size, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30); // extra length
      centralHeader.writeUInt16LE(0, 32); // comment length
      centralHeader.writeUInt16LE(0, 34); // disk start
      centralHeader.writeUInt16LE(0, 36); // internal attrs
      centralHeader.writeUInt32LE(0, 38); // external attrs
      centralHeader.writeUInt32LE(offset, 42);

      const centralRecord = Buffer.concat([centralHeader, nameBuf]);
      centralRecords.push(centralRecord);

      offset += localRecord.length;
    }

    const centralDir = Buffer.concat(centralRecords);
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(files.length, 8);
    endRecord.writeUInt16LE(files.length, 10);
    endRecord.writeUInt32LE(centralDir.length, 12);
    endRecord.writeUInt32LE(offset, 16);
    endRecord.writeUInt16LE(0, 20);

    return Buffer.concat([...fileRecords, centralDir, endRecord]);
  }

  private toDosDateTime(date: Date) {
    const year = Math.max(date.getUTCFullYear(), 1980);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = Math.floor(date.getUTCSeconds() / 2);
    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    return { dosDate, dosTime };
  }

  private crc32(buffer: Buffer) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buffer.length; i += 1) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
