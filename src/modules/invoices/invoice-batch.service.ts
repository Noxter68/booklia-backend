import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { UploadService } from '../upload/upload.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import * as archiver from 'archiver';

export interface BatchProgress {
  current: number;
  total: number;
  currentClient: string;
  phase: 'creating' | 'done' | 'error';
}

export interface BatchResult {
  generatedCount: number;
  totalHTCents: number;
  totalVATCents: number;
  totalTTCCents: number;
  invoiceIds: string[];
  errors: string[];
  batchId?: string;
}

@Injectable()
export class InvoiceBatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly uploadService: UploadService,
    private readonly wsGateway: WebsocketGateway,
  ) {}

  /**
   * Preview: count eligible bookings for a date range
   */
  async preview(businessId: string, startDate: Date, endDate: Date) {
    const bookings = await this.getEligibleBookings(businessId, startDate, endDate);
    return {
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: b.id,
        clientName: b.requester?.name || 'Sans client',
        serviceName: b.businessService?.name || 'Prestation',
        scheduledAt: b.scheduledAt,
        priceCents: b.agreedPriceCents,
      })),
    };
  }

  /**
   * Generate invoices for all eligible bookings in a date range.
   * Sends WebSocket progress events to the user.
   */
  async generate(
    businessId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BatchResult> {
    // Verify billing settings first
    const settings = await this.prisma.businessBillingSettings.findUnique({
      where: { businessId },
    });
    if (!settings || !settings.legalName || !settings.addressLine1 || !settings.postalCode || !settings.city || !settings.siret) {
      throw new BadRequestException(
        'Les paramètres de facturation doivent être complets avant de générer des factures',
      );
    }

    const bookings = await this.getEligibleBookings(businessId, startDate, endDate);

    if (bookings.length === 0) {
      throw new BadRequestException(
        'Aucune prestation éligible pour cette période',
      );
    }

    const result: BatchResult = {
      generatedCount: 0,
      totalHTCents: 0,
      totalVATCents: 0,
      totalTTCCents: 0,
      invoiceIds: [],
      errors: [],
    };

    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      const clientName = booking.requester?.name || 'Sans client';

      // Send progress via WebSocket
      this.sendProgress(userId, {
        current: i + 1,
        total: bookings.length,
        currentClient: clientName,
        phase: 'creating',
      });

      try {
        // Create invoice from booking
        const invoice = await this.invoicesService.create(businessId, userId, {
          clientId: booking.requesterId,
          bookingId: booking.id,
          serviceDate: booking.scheduledAt?.toISOString(),
        });

        // Finalize immediately
        const finalized = await this.invoicesService.finalize(businessId, invoice.id);

        // Generate PDF
        if (finalized.snapshot) {
          try {
            const pdfBuffer = await this.invoicePdfService.generatePdf(finalized.snapshot);
            const year = new Date().getFullYear();
            const pdfKey = `invoices/${businessId}/${year}/${finalized.invoiceNumber}.pdf`;
            await this.uploadService.uploadBuffer(pdfBuffer, pdfKey, 'application/pdf');
            await this.invoicesService.updatePdfKey(finalized.id, pdfKey);
          } catch (pdfError) {
            // Invoice is finalized even if PDF fails
            console.error(`Erreur PDF pour facture ${finalized.invoiceNumber}:`, pdfError);
          }
        }

        result.generatedCount++;
        result.totalHTCents += finalized.totalHTCents;
        result.totalVATCents += finalized.totalVATCents;
        result.totalTTCCents += finalized.totalTTCCents;
        result.invoiceIds.push(finalized.id);
      } catch (error: any) {
        result.errors.push(`${clientName}: ${error.message}`);
      }
    }

    // Send completion
    this.sendProgress(userId, {
      current: bookings.length,
      total: bookings.length,
      currentClient: '',
      phase: 'done',
    });

    // Save batch generation history
    const batchRecord = await this.prisma.batchGeneration.create({
      data: {
        businessId,
        createdByUserId: userId,
        status: result.errors.length > 0 && result.generatedCount === 0 ? 'FAILED' : 'COMPLETED',
        startDate,
        endDate,
        invoiceCount: result.generatedCount,
        totalHTCents: result.totalHTCents,
        totalVATCents: result.totalVATCents,
        totalTTCCents: result.totalTTCCents,
        invoiceIds: result.invoiceIds,
        errors: result.errors,
      },
    });

    return { ...result, batchId: batchRecord.id };
  }

  /**
   * Build a ZIP of all finalized invoice PDFs for a date range
   */
  async buildZipBuffer(
    businessId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: 'FINALIZED',
        pdfKey: { not: null },
        issueDate: { gte: startDate, lte: endDate },
      },
      orderBy: { invoiceNumber: 'asc' },
      select: { invoiceNumber: true, pdfKey: true },
    });

    if (invoices.length === 0) {
      throw new BadRequestException('Aucune facture finalisée avec PDF pour cette période');
    }

    const publicUrl = process.env.R2_PUBLIC_URL || '';
    const archive = archiver('zip', { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    // Collect archive output into buffer
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    // Fetch each PDF and append to archive
    for (const inv of invoices) {
      if (!inv.pdfKey) continue;
      try {
        const url = `${publicUrl}/${inv.pdfKey}`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        archive.append(pdfBuffer, { name: `${inv.invoiceNumber}.pdf` });
      } catch {
        // Skip failed PDFs
      }
    }

    // Finalize and wait for the full buffer
    await archive.finalize();
    const buffer = await bufferPromise;

    // Build filename from date range
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    const filename = `factures-${startStr}-${endStr}.zip`;

    return { buffer, filename };
  }

  // ============================================
  // Private helpers
  // ============================================

  private async getEligibleBookings(
    businessId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.booking.findMany({
      where: {
        businessService: { businessId },
        status: { in: ['COMPLETED', 'ACCEPTED'] },
        scheduledAt: { gte: startDate, lte: endDate },
        // No existing invoice
        invoice: { is: null },
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        businessService: { select: { name: true, businessId: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ============================================
  // Batch history
  // ============================================

  async listBatchGenerations(businessId: string) {
    return this.prisma.batchGeneration.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async deleteBatchGeneration(businessId: string, batchId: string) {
    const batch = await this.prisma.batchGeneration.findUnique({
      where: { id: batchId },
    });
    if (!batch || batch.businessId !== businessId) {
      throw new NotFoundException('Génération non trouvée');
    }

    // Supprime uniquement l'historique, les factures restent intactes
    await this.prisma.batchGeneration.delete({ where: { id: batchId } });
    return { success: true };
  }

  async buildZipBufferFromBatch(
    businessId: string,
    batchId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const batch = await this.prisma.batchGeneration.findUnique({
      where: { id: batchId },
    });
    if (!batch || batch.businessId !== businessId) {
      throw new NotFoundException('Génération non trouvée');
    }

    if (batch.invoiceIds.length === 0) {
      throw new BadRequestException('Aucune facture dans cette génération');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        id: { in: batch.invoiceIds },
        status: 'FINALIZED',
        pdfKey: { not: null },
      },
      select: { invoiceNumber: true, pdfKey: true },
      orderBy: { invoiceNumber: 'asc' },
    });

    if (invoices.length === 0) {
      throw new BadRequestException('Aucun PDF disponible pour cette génération');
    }

    const publicUrl = process.env.R2_PUBLIC_URL || '';
    const archive = archiver('zip', { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    for (const inv of invoices) {
      if (!inv.pdfKey) continue;
      try {
        const url = `${publicUrl}/${inv.pdfKey}`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        archive.append(pdfBuffer, { name: `${inv.invoiceNumber}.pdf` });
      } catch {
        // Skip failed PDFs
      }
    }

    await archive.finalize();
    const buffer = await bufferPromise;

    const startStr = batch.startDate.toISOString().slice(0, 10);
    const endStr = batch.endDate.toISOString().slice(0, 10);
    const filename = `factures-${startStr}-${endStr}.zip`;

    return { buffer, filename };
  }

  private sendProgress(userId: string, progress: BatchProgress) {
    this.wsGateway.server
      .to(`user:${userId}`)
      .emit('invoice:batch-progress', progress);
  }
}
