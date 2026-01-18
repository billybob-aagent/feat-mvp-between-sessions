import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { LibraryService } from "./library.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { CreateLibraryItemDto } from "./dto/create-library-item.dto";
import { UpdateLibraryItemDto } from "./dto/update-library-item.dto";
import { PublishLibraryItemDto } from "./dto/publish-library-item.dto";
import { CreateSignatureRequestDto } from "./dto/create-signature-request.dto";
import { SignLibraryItemDto } from "./dto/sign-library-item.dto";
import { RagQueryDto } from "./dto/rag-query.dto";

@Controller("library")
export class LibraryController {
  constructor(private library: LibraryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Get("collections")
  async listCollections(@Req() req: any, @Query("clinicId") clinicId?: string) {
    return this.library.listCollections(req.user.userId, req.user.role, clinicId ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Get("items")
  async listItems(
    @Req() req: any,
    @Query("collectionId") collectionId?: string,
    @Query("type") type?: string,
    @Query("domain") domain?: string,
    @Query("modality") modality?: string,
    @Query("population") population?: string,
    @Query("complexity") complexity?: string,
    @Query("sessionUse") sessionUse?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.library.listItems(req.user.userId, req.user.role, {
      clinicId: clinicId ?? null,
      collectionId: collectionId ?? null,
      type: type ?? null,
      domain: domain ?? null,
      modality: modality ?? null,
      population: population ?? null,
      complexity: complexity ?? null,
      sessionUse: sessionUse ?? null,
      status: status ?? null,
      q: q ?? null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Get("items/:id")
  async getItem(
    @Req() req: any,
    @Param("id") id: string,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.library.getItem(req.user.userId, req.user.role, id, clinicId ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("items")
  async createItem(@Req() req: any, @Body() dto: CreateLibraryItemDto) {
    return this.library.createItem(req.user.userId, req.user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Patch("items/:id")
  async updateItem(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateLibraryItemDto,
  ) {
    return this.library.updateItem(req.user.userId, req.user.role, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("items/:id/publish")
  async publishItem(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: PublishLibraryItemDto,
  ) {
    return this.library.publishItem(req.user.userId, req.user.role, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("items/:id/archive")
  async archiveItem(@Req() req: any, @Param("id") id: string) {
    return this.library.archiveItem(req.user.userId, req.user.role, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Get("search")
  async search(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
    @Query("clinicId") clinicId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw || "8", 10) || 8, 1), 50);
    return this.library.search(req.user.userId, req.user.role, q ?? "", limit, clinicId ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("rag/query")
  async ragQuery(@Req() req: any, @Body() dto: RagQueryDto) {
    return this.library.ragQuery(req.user.userId, req.user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("forms/:itemId/signature-requests")
  async requestSignature(
    @Req() req: any,
    @Param("itemId") itemId: string,
    @Body() dto: CreateSignatureRequestDto,
  ) {
    return this.library.createSignatureRequest(req.user.userId, req.user.role, itemId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Post("signatures/:requestId/sign")
  async signRequest(
    @Req() req: any,
    @Param("requestId") requestId: string,
    @Body() dto: SignLibraryItemDto,
  ) {
    return this.library.signRequest(req.user.userId, req.user.role, requestId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist, UserRole.client, UserRole.admin, UserRole.CLINIC_ADMIN)
  @Get("forms/:requestId/pdf")
  async getFormPdf(
    @Req() req: any,
    @Param("requestId") requestId: string,
    @Res() res: Response,
    @Query("clinicId") clinicId?: string,
  ) {
    return this.library.streamSignaturePdf(
      req.user.userId,
      req.user.role,
      requestId,
      res,
      clinicId ?? null,
    );
  }
}
