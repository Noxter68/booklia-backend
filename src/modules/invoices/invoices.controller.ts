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
  NotFoundException,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { UploadService } from '../upload/upload.service';
import {
  CreateInvoiceDto,
  AddInvoiceLineDto,
  UpdateInvoiceLineDto,
} from './dto/invoice.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
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
