import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInvoiceDto,
  AddInvoiceLineDto,
  UpdateInvoiceLineDto,
} from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Invoice CRUD
  // ============================================

  async create(businessId: string, userId: string, dto: CreateInvoiceDto) {
    let booking: any = null;

    // Si un bookingId est fourni, vérifier qu'il appartient au business
    if (dto.bookingId) {
      booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: {
          businessService: { select: { businessId: true, name: true } },
        },
      });
      if (!booking || booking.businessService.businessId !== businessId) {
        throw new NotFoundException('Réservation non trouvée');
      }
      // Vérifier qu'il n'y a pas déjà une facture pour ce booking
      const existing = await this.prisma.invoice.findUnique({
        where: { bookingId: dto.bookingId },
      });
      if (existing) {
        throw new BadRequestException(
          'Une facture existe déjà pour cette réservation',
        );
      }
    }

    // Récupérer le vatMode des settings
    const settings = await this.prisma.businessBillingSettings.findUnique({
      where: { businessId },
    });

    const vatMode = settings?.vatMode ?? 'FRANCHISE_293B';

    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        clientId: dto.clientId ?? null,
        bookingId: dto.bookingId ?? null,
        serviceDate: dto.serviceDate
          ? new Date(dto.serviceDate)
          : booking?.scheduledAt ?? null,
        vatMode,
        createdByUserId: userId,
      },
      include: { lines: true, client: { select: { id: true, name: true, email: true } } },
    });

    // Auto-ajouter une ligne si le booking a un prix et un service
    if (booking && booking.agreedPriceCents != null) {
      const unitPriceHTCents = booking.agreedPriceCents;
      const vatRate = vatMode === 'FRANCHISE_293B' ? 0 : 20;
      const totalHTCents = unitPriceHTCents;
      const totalVATCents = Math.round(totalHTCents * vatRate / 100);
      const totalTTCCents = totalHTCents + totalVATCents;

      await this.prisma.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          kind: 'SERVICE',
          label: booking.businessService?.name ?? 'Prestation',
          quantity: 1,
          unitPriceHTCents,
          vatRate,
          totalHTCents,
          totalVATCents,
          totalTTCCents,
          sortOrder: 0,
        },
      });

      await this.recalculateTotals(invoice.id);
    }

    return this.findOne(businessId, invoice.id);
  }

  async findOne(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
        booking: {
          include: {
            businessService: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }

    if (invoice.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }

    return invoice;
  }

  async findAll(
    businessId: string,
    status?: string,
    search?: string,
    limit = 20,
    offset = 0,
  ) {
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { client: { name: { contains: term, mode: 'insensitive' } } },
        { client: { email: { contains: term, mode: 'insensitive' } } },
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          client: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  // ============================================
  // Invoice Lines
  // ============================================

  async addLine(businessId: string, invoiceId: string, dto: AddInvoiceLineDto) {
    const invoice = await this.assertDraft(businessId, invoiceId);

    const totalHTCents = dto.quantity * dto.unitPriceHTCents;
    const totalVATCents = Math.round(totalHTCents * dto.vatRate / 100);
    const totalTTCCents = totalHTCents + totalVATCents;

    // Calculer le prochain sortOrder
    const maxSort = await this.prisma.invoiceLine.aggregate({
      where: { invoiceId },
      _max: { sortOrder: true },
    });

    await this.prisma.invoiceLine.create({
      data: {
        invoiceId,
        kind: dto.kind ?? 'SERVICE',
        label: dto.label,
        quantity: dto.quantity,
        unitPriceHTCents: dto.unitPriceHTCents,
        vatRate: dto.vatRate,
        totalHTCents,
        totalVATCents,
        totalTTCCents,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    await this.recalculateTotals(invoiceId);

    return this.findOne(businessId, invoiceId);
  }

  async updateLine(
    businessId: string,
    invoiceId: string,
    lineId: string,
    dto: UpdateInvoiceLineDto,
  ) {
    await this.assertDraft(businessId, invoiceId);

    const line = await this.prisma.invoiceLine.findUnique({
      where: { id: lineId },
    });

    if (!line || line.invoiceId !== invoiceId) {
      throw new NotFoundException('Ligne non trouvée');
    }

    const quantity = dto.quantity ?? line.quantity;
    const unitPriceHTCents = dto.unitPriceHTCents ?? line.unitPriceHTCents;
    const vatRate = dto.vatRate ?? line.vatRate;
    const totalHTCents = quantity * unitPriceHTCents;
    const totalVATCents = Math.round(totalHTCents * vatRate / 100);
    const totalTTCCents = totalHTCents + totalVATCents;

    await this.prisma.invoiceLine.update({
      where: { id: lineId },
      data: {
        kind: dto.kind ?? undefined,
        label: dto.label ?? undefined,
        quantity,
        unitPriceHTCents,
        vatRate,
        totalHTCents,
        totalVATCents,
        totalTTCCents,
      },
    });

    await this.recalculateTotals(invoiceId);

    return this.findOne(businessId, invoiceId);
  }

  async removeLine(businessId: string, invoiceId: string, lineId: string) {
    await this.assertDraft(businessId, invoiceId);

    const line = await this.prisma.invoiceLine.findUnique({
      where: { id: lineId },
    });

    if (!line || line.invoiceId !== invoiceId) {
      throw new NotFoundException('Ligne non trouvée');
    }

    await this.prisma.invoiceLine.delete({ where: { id: lineId } });

    await this.recalculateTotals(invoiceId);

    return this.findOne(businessId, invoiceId);
  }

  // ============================================
  // Finalization
  // ============================================

  async finalize(businessId: string, invoiceId: string) {
    const invoice = await this.assertDraft(businessId, invoiceId);

    // Vérifier qu'il y a au moins une ligne
    const lineCount = await this.prisma.invoiceLine.count({
      where: { invoiceId },
    });
    if (lineCount === 0) {
      throw new BadRequestException(
        'La facture doit contenir au moins une ligne',
      );
    }

    // Vérifier que les billing settings sont complets
    const settings = await this.prisma.businessBillingSettings.findUnique({
      where: { businessId },
    });
    if (!settings) {
      throw new BadRequestException(
        'Les paramètres de facturation doivent être configurés avant de finaliser',
      );
    }
    if (!settings.legalName || !settings.addressLine1 || !settings.postalCode || !settings.city || !settings.siret) {
      throw new BadRequestException(
        'Les paramètres de facturation sont incomplets (raison sociale, adresse, SIRET requis)',
      );
    }

    // Transaction: lock settings, incrémenter séquence, générer numéro, snapshot
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock row pour éviter les race conditions sur la séquence
      const lockedSettings = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "BusinessBillingSettings" WHERE "businessId" = $1 FOR UPDATE`,
        businessId,
      );
      const currentSettings = lockedSettings[0];
      if (!currentSettings) {
        throw new BadRequestException('Paramètres de facturation non trouvés');
      }

      const sequence = currentSettings.nextInvoiceSequence;
      const year = new Date().getFullYear();
      const invoiceNumber = `${currentSettings.invoicePrefix}-${year}-${String(sequence).padStart(4, '0')}`;

      // Incrémenter la séquence
      await tx.businessBillingSettings.update({
        where: { businessId },
        data: { nextInvoiceSequence: sequence + 1 },
      });

      // Récupérer les données complètes pour le snapshot
      const fullInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          client: { select: { id: true, name: true, email: true } },
        },
      });

      // Construire le snapshot
      const snapshot = {
        seller: {
          legalName: currentSettings.legalName,
          addressLine1: currentSettings.addressLine1,
          addressLine2: currentSettings.addressLine2,
          postalCode: currentSettings.postalCode,
          city: currentSettings.city,
          country: currentSettings.country,
          siret: currentSettings.siret,
          vatNumber: currentSettings.vatNumber,
          vatMode: currentSettings.vatMode,
          logoKey: currentSettings.logoKey,
        },
        buyer: fullInvoice?.client
          ? {
              id: fullInvoice.client.id,
              name: fullInvoice.client.name,
              email: fullInvoice.client.email,
            }
          : null,
        lines: fullInvoice?.lines.map((l) => ({
          kind: l.kind,
          label: l.label,
          quantity: l.quantity,
          unitPriceHTCents: l.unitPriceHTCents,
          vatRate: l.vatRate,
          totalHTCents: l.totalHTCents,
          totalVATCents: l.totalVATCents,
          totalTTCCents: l.totalTTCCents,
        })),
        totals: {
          totalHTCents: fullInvoice?.totalHTCents ?? 0,
          totalVATCents: fullInvoice?.totalVATCents ?? 0,
          totalTTCCents: fullInvoice?.totalTTCCents ?? 0,
        },
        legalMentions: this.buildLegalMentions(currentSettings.vatMode, currentSettings.paymentTerms),
        metadata: {
          invoiceNumber,
          issueDate: new Date().toISOString(),
          serviceDate: fullInvoice?.serviceDate?.toISOString() ?? null,
          currency: fullInvoice?.currency ?? 'EUR',
        },
      };

      // Finaliser la facture
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'FINALIZED',
          invoiceNumber,
          issueDate: new Date(),
          snapshot,
        },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          client: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return result;
  }

  async delete(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }
    if (invoice.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }
    if (invoice.status !== 'CANCELLED') {
      throw new BadRequestException(
        'Seules les factures annulées peuvent être supprimées',
      );
    }

    await this.prisma.invoiceLine.deleteMany({ where: { invoiceId } });
    await this.prisma.invoice.delete({ where: { id: invoiceId } });

    return { success: true };
  }

  async cancel(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }
    if (invoice.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Facture déjà annulée');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updatePdfKey(invoiceId: string, pdfKey: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfKey },
    });
  }

  // ============================================
  // Helpers
  // ============================================

  private async assertDraft(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }
    if (invoice.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(
        'Seules les factures brouillon peuvent être modifiées',
      );
    }

    return invoice;
  }

  private async recalculateTotals(invoiceId: string) {
    const lines = await this.prisma.invoiceLine.findMany({
      where: { invoiceId },
    });

    const totalHTCents = lines.reduce((sum, l) => sum + l.totalHTCents, 0);
    const totalVATCents = lines.reduce((sum, l) => sum + l.totalVATCents, 0);
    const totalTTCCents = lines.reduce((sum, l) => sum + l.totalTTCCents, 0);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { totalHTCents, totalVATCents, totalTTCCents },
    });
  }

  private buildLegalMentions(vatMode: string, paymentTerms?: string | null): string[] {
    const mentions: string[] = [];

    if (vatMode === 'FRANCHISE_293B') {
      mentions.push('TVA non applicable, art. 293 B du CGI');
    }

    if (paymentTerms) {
      mentions.push(paymentTerms);
    }

    return mentions;
  }
}
