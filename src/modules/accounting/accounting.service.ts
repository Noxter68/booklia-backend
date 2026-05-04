import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpenseCategory } from '@prisma/client';

export interface AccountingSummary {
  period: { from: string; to: string };
  revenue: {
    /**
     * Operational revenue: Σ agreedPriceCents on COMPLETED bookings in period
     * (bucketed by scheduledAt). This is what the pro actually earned, whether
     * a formal invoice was issued or not.
     */
    grossCents: number;
    /**
     * For franchise (no VAT) regime, HT = TTC. For VAT-liable businesses we
     * don't know the HT split at the booking level — caller should treat this
     * as best-effort. We keep this field for the URSSAF computation.
     */
    netHTCents: number;
    bookingCount: number;
    /** Σ totalTTCCents on FINALIZED invoices issued in period (by issueDate). */
    invoicedCents: number;
    invoiceCount: number;
    monthlyBreakdown: { month: string; cents: number }[]; // YYYY-MM, based on bookings
  };
  expenses: {
    totalCents: number;
    count: number;
    byCategory: { category: ExpenseCategory; cents: number }[];
    monthlyBreakdown: { month: string; cents: number }[];
    items: ExpenseItem[]; // full list (small enough for v1: ~50/mo)
  };
  provisions: {
    urssafCents: number;
    incomeTaxCents: number;
  };
  netEstimateCents: number; // grossCents − expenses − provisions
  settings: {
    legalForm: string | null;
    urssafRate: number | null;
    incomeTaxRate: number | null;
    acreActive: boolean;
    vatMode: string;
  } | null;
}

export interface ExpenseItem {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  reference: string | null;
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single aggregated query for the accounting tab.
   * One trip: invoices in period + expenses in period + billing settings.
   */
  async getSummary(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<AccountingSummary> {
    const [bookings, invoices, expenses, settings] = await Promise.all([
      // Completed bookings = the source of truth for operational revenue
      this.prisma.booking.findMany({
        where: {
          status: 'COMPLETED',
          scheduledAt: { gte: from, lte: to },
          businessService: { businessId },
        },
        select: {
          agreedPriceCents: true,
          scheduledAt: true,
        },
      }),
      // Invoices: tracked separately as a "what was formally invoiced"
      // indicator. Bucketed by issueDate (when the invoice was finalized).
      this.prisma.invoice.findMany({
        where: {
          businessId,
          status: 'FINALIZED',
          issueDate: { gte: from, lte: to },
        },
        select: { totalTTCCents: true, issueDate: true },
      }),
      this.prisma.expense.findMany({
        where: { businessId, date: { gte: from, lte: to } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.businessBillingSettings.findUnique({
        where: { businessId },
        select: {
          legalForm: true,
          urssafRate: true,
          incomeTaxRate: true,
          acreActive: true,
          vatMode: true,
        },
      }),
    ]);

    // Revenue from completed bookings
    const revenueGrossCents = bookings.reduce(
      (sum, b) => sum + (b.agreedPriceCents ?? 0),
      0,
    );
    // For franchise regime HT = TTC (no VAT collected).
    // For VAT-liable businesses, the booking price is the agreed amount
    // (typically TTC); we don't have a per-booking HT/TTC split, so we keep
    // this equal to gross. The URSSAF base falls back to gross in both cases,
    // which is the correct behavior for autoentrepreneurs.
    const revenueNetHTCents = revenueGrossCents;
    const revenueByMonth = bucketByMonth(
      bookings
        .filter((b): b is typeof b & { scheduledAt: Date } => !!b.scheduledAt)
        .map((b) => ({ date: b.scheduledAt, cents: b.agreedPriceCents ?? 0 })),
    );

    // Invoiced indicator
    const invoicedCents = invoices.reduce((sum, i) => sum + i.totalTTCCents, 0);

    // Expense aggregation
    const expensesTotalCents = expenses.reduce(
      (sum, e) => sum + e.amountCents,
      0,
    );
    const expensesByCategoryMap = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      expensesByCategoryMap.set(
        e.category,
        (expensesByCategoryMap.get(e.category) ?? 0) + e.amountCents,
      );
    }
    const expensesByCategory = Array.from(expensesByCategoryMap.entries())
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents);

    const expensesByMonth = bucketByMonth(
      expenses.map((e) => ({ date: e.date, cents: e.amountCents })),
    );

    // Provisions
    // URSSAF base: HT for VAT-liable businesses, TTC for franchise (autoentrepreneur)
    // Autoentrepreneur cotisations are computed on chiffre d'affaires (= TTC, since no VAT).
    const urssafBase =
      settings?.vatMode === 'STANDARD' ? revenueNetHTCents : revenueGrossCents;
    const urssafCents = settings?.urssafRate
      ? Math.round(urssafBase * settings.urssafRate)
      : 0;
    const incomeTaxCents = settings?.incomeTaxRate
      ? Math.round(urssafBase * settings.incomeTaxRate)
      : 0;

    const netEstimateCents =
      revenueGrossCents - expensesTotalCents - urssafCents - incomeTaxCents;

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      revenue: {
        grossCents: revenueGrossCents,
        netHTCents: revenueNetHTCents,
        bookingCount: bookings.length,
        invoicedCents,
        invoiceCount: invoices.length,
        monthlyBreakdown: revenueByMonth,
      },
      expenses: {
        totalCents: expensesTotalCents,
        count: expenses.length,
        byCategory: expensesByCategory,
        monthlyBreakdown: expensesByMonth,
        items: expenses.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          category: e.category,
          description: e.description,
          amountCents: e.amountCents,
          reference: e.reference,
        })),
      },
      provisions: {
        urssafCents,
        incomeTaxCents,
      },
      netEstimateCents,
      settings: settings
        ? {
            legalForm: settings.legalForm,
            urssafRate: settings.urssafRate,
            incomeTaxRate: settings.incomeTaxRate,
            acreActive: settings.acreActive,
            vatMode: settings.vatMode,
          }
        : null,
    };
  }

  async createExpense(
    businessId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseItem> {
    const e = await this.prisma.expense.create({
      data: {
        businessId,
        date: new Date(dto.date),
        category: dto.category,
        description: dto.description.trim(),
        amountCents: dto.amountCents,
        reference: dto.reference?.trim() || null,
      },
    });
    return {
      id: e.id,
      date: e.date.toISOString(),
      category: e.category,
      description: e.description,
      amountCents: e.amountCents,
      reference: e.reference,
    };
  }

  async updateExpense(
    businessId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseItem> {
    const existing = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });
    if (!existing) throw new NotFoundException('Charge introuvable');
    if (existing.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }

    const e = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        category: dto.category,
        description: dto.description?.trim(),
        amountCents: dto.amountCents,
        reference: dto.reference !== undefined ? dto.reference?.trim() || null : undefined,
      },
    });
    return {
      id: e.id,
      date: e.date.toISOString(),
      category: e.category,
      description: e.description,
      amountCents: e.amountCents,
      reference: e.reference,
    };
  }

  async deleteExpense(businessId: string, expenseId: string): Promise<void> {
    const existing = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });
    if (!existing) throw new NotFoundException('Charge introuvable');
    if (existing.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }
    await this.prisma.expense.delete({ where: { id: expenseId } });
  }
}

function bucketByMonth(
  items: { date: Date; cents: number }[],
): { month: string; cents: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const key = `${it.date.getUTCFullYear()}-${String(it.date.getUTCMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + it.cents);
  }
  return Array.from(map.entries())
    .map(([month, cents]) => ({ month, cents }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
