import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { ExternalAccessService } from "./external-access.service";

@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller("external")
export class ExternalAccessPublicController {
  constructor(private externalAccess: ExternalAccessService) {}

  @Get("aer.pdf")
  async getAerPdf(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query("token") token?: string,
  ) {
    const { buffer, reportId } = await this.externalAccess.getAerPdfFromToken(
      token,
      this.buildMeta(req),
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="AER_${reportId}.pdf"`);

    return buffer;
  }

  @Get("aer.json")
  async getAerJson(@Req() req: any, @Query("token") token?: string) {
    return this.externalAccess.getAerJsonFromToken(token, this.buildMeta(req));
  }

  private buildMeta(req: any) {
    const path = (req.originalUrl || req.url || "").split("?")[0];
    return {
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
      path,
    };
  }
}
