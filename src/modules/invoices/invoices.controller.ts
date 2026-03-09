import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceBatchService } from './invoice-batch.service';
import { UploadService } from '../upload/upload.service';
import {
  CreateInvoiceDto,
  AddInvoiceLineDto,
  UpdateInvoiceLineDto,
} from './dto/invoice.dto';
import { BatchGenerateDto } from './dto/batch-invoice.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly invoiceBatchService: InvoiceBatchService,
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService,
  ) {}

  private async getBusinessId(userId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }
    return business.id;
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.create(businessId, req.user.id, dto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.findAll(
      businessId,
      status,
      search,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  // ============================================
  // Batch operations (must be BEFORE :id routes)
  // ============================================

  @Post('batch/preview')
  async batchPreview(@Req() req: any, @Body() dto: BatchGenerateDto) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoiceBatchService.preview(
      businessId,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }

  @Post('batch/generate')
  async batchGenerate(@Req() req: any, @Body() dto: BatchGenerateDto) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoiceBatchService.generate(
      businessId,
      req.user.id,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }

  @Get('batch/download')
  async batchDownload(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    const { buffer, filename } = await this.invoiceBatchService.buildZipBuffer(
      businessId,
      new Date(startDate),
      new Date(endDate),
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });

    res.end(buffer);
  }

  @Get('batch/history')
  async batchHistory(@Req() req: any) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoiceBatchService.listBatchGenerations(businessId);
  }

  @Get('batch/:batchId/download')
  async batchDownloadById(
    @Req() req: any,
    @Res() res: Response,
    @Param('batchId') batchId: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    const { buffer, filename } = await this.invoiceBatchService.buildZipBufferFromBatch(
      businessId,
      batchId,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });

    res.end(buffer);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.findOne(businessId, id);
  }

  @Post(':id/lines')
  async addLine(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddInvoiceLineDto,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.addLine(businessId, id, dto);
  }

  @Put(':id/lines/:lineId')
  async updateLine(
    @Req() req: any,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.updateLine(businessId, id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  async removeLine(
    @Req() req: any,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.removeLine(businessId, id, lineId);
  }

  @Post(':id/finalize')
  async finalize(@Req() req: any, @Param('id') id: string) {
    const businessId = await this.getBusinessId(req.user.id);
    const invoice = await this.invoicesService.finalize(businessId, id);

    // Générer et uploader le PDF
    if (invoice.snapshot) {
      try {
        const pdfBuffer = await this.invoicePdfService.generatePdf(
          invoice.snapshot,
        );
        const year = new Date().getFullYear();
        const pdfKey = `invoices/${businessId}/${year}/${invoice.invoiceNumber}.pdf`;
        await this.uploadService.uploadBuffer(
          pdfBuffer,
          pdfKey,
          'application/pdf',
        );
        await this.invoicesService.updatePdfKey(invoice.id, pdfKey);
        return { ...invoice, pdfKey };
      } catch (error) {
        console.error('Erreur génération PDF:', error);
        // La facture est quand même finalisée, le PDF pourra être regénéré
        return invoice;
      }
    }

    return invoice;
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.cancel(businessId, id);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.invoicesService.delete(businessId, id);
  }

  @Get(':id/pdf')
  async getPdfUrl(@Req() req: any, @Param('id') id: string) {
    const businessId = await this.getBusinessId(req.user.id);
    const invoice = await this.invoicesService.findOne(businessId, id);

    if (!invoice.pdfKey) {
      throw new NotFoundException('PDF non disponible');
    }

    // Retourner l'URL publique directement (R2 public bucket)
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    return { url: `${publicUrl}/${invoice.pdfKey}` };
  }
}
