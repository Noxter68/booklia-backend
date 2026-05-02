import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertBillingSettingsDto } from './dto/billing-settings.dto';

@Injectable()
export class BillingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(businessId: string) {
    return this.prisma.businessBillingSettings.findUnique({
      where: { businessId },
    });
  }

  async upsert(businessId: string, dto: UpsertBillingSettingsDto) {
    const data = {
      legalName: dto.legalName,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2 ?? null,
      postalCode: dto.postalCode,
      city: dto.city,
      country: dto.country ?? 'FR',
      siret: dto.siret,
      vatNumber: dto.vatNumber ?? null,
      vatMode: dto.vatMode,
      invoicePrefix: dto.invoicePrefix,
      logoKey: dto.logoKey ?? null,
      paymentTerms: dto.paymentTerms ?? null,
      legalForm: dto.legalForm ?? null,
      urssafRate: dto.urssafRate ?? null,
      incomeTaxRate: dto.incomeTaxRate ?? null,
      acreActive: dto.acreActive ?? false,
      acreEndDate: dto.acreEndDate ? new Date(dto.acreEndDate) : null,
    };

    return this.prisma.businessBillingSettings.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
    });
  }
}
