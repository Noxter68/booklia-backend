import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('business/accounting')
@UseGuards(AuthGuard)
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly prisma: PrismaService,
  ) {}

  private async getBusinessId(userId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business non trouvé');
    return business.id;
  }

  /**
   * Single aggregated endpoint for the accounting tab.
   * Period is specified as either:
   *   ?period=month&value=YYYY-MM
   *   ?period=year&value=YYYY
   *   ?from=ISO&to=ISO  (custom)
   */
  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('period') period?: 'month' | 'year',
    @Query('value') value?: string,
    @Query('from') fromQuery?: string,
    @Query('to') toQuery?: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    const { from, to } = resolvePeriod(period, value, fromQuery, toQuery);
    return this.accounting.getSummary(businessId, from, to);
  }

  @Post('expenses')
  async createExpense(@Req() req: any, @Body() dto: CreateExpenseDto) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.accounting.createExpense(businessId, dto);
  }

  @Patch('expenses/:id')
  async updateExpense(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.accounting.updateExpense(businessId, id, dto);
  }

  @Delete('expenses/:id')
  async deleteExpense(@Req() req: any, @Param('id') id: string) {
    const businessId = await this.getBusinessId(req.user.id);
    await this.accounting.deleteExpense(businessId, id);
    return { ok: true };
  }
}

function resolvePeriod(
  period?: 'month' | 'year',
  value?: string,
  fromQuery?: string,
  toQuery?: string,
): { from: Date; to: Date } {
  if (fromQuery && toQuery) {
    const from = new Date(fromQuery);
    const to = new Date(toQuery);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Dates invalides');
    }
    return { from, to };
  }

  if (period === 'month') {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException('Format attendu: YYYY-MM');
    }
    const [year, month] = value.split('-').map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from, to };
  }

  if (period === 'year') {
    if (!value || !/^\d{4}$/.test(value)) {
      throw new BadRequestException('Format attendu: YYYY');
    }
    const year = Number(value);
    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { from, to };
  }

  // Default: current month
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { from, to };
}
