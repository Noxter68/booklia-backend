import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

/**
 * Generates invoice PDFs with a single long-lived Puppeteer browser shared
 * across the whole process. Spawning a browser per request costs 300-500 MB
 * and kills Railway containers when multiple invoices are generated in a
 * batch; here we reuse one browser and open a fresh page per call.
 *
 * A small concurrency gate prevents page-creation storms when a batch triggers
 * dozens of parallel generations.
 */
@Injectable()
export class InvoicePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoicePdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  private readonly maxConcurrent = 3;
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  async onModuleDestroy() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        this.logger.warn(`Error closing Puppeteer browser: ${err}`);
      }
      this.browser = null;
    }
  }

  async generatePdf(snapshot: any): Promise<Buffer> {
    const html = this.buildHtml(snapshot);
    await this.acquire();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        });
        return Buffer.from(pdfBuffer);
      } finally {
        await page.close().catch(() => undefined);
      }
    } finally {
      this.release();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // If another call is already launching, reuse that promise.
    if (this.launching) {
      return this.launching;
    }

    this.launching = puppeteer
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      .then((b) => {
        this.browser = b;
        // Auto-recover if the browser dies (OOM, crash, etc.) — next call will relaunch.
        b.on('disconnected', () => {
          this.logger.warn('Puppeteer browser disconnected, will relaunch on next call');
          this.browser = null;
        });
        this.logger.log('Puppeteer browser launched');
        return b;
      })
      .finally(() => {
        this.launching = null;
      });

    return this.launching;
  }

  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
  }

  private release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }

  private buildHtml(snapshot: any): string {
    const { seller, buyer, lines, totals, legalMentions, metadata } = snapshot;

    const formatCents = (cents: number) => {
      return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC';
    };

    const formatDate = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    const linesHtml = (lines || [])
      .map(
        (line: any) => `
      <tr>
        <td>${line.label}</td>
        <td class="center">${line.quantity}</td>
        <td class="right">${formatCents(line.unitPriceHTCents)}</td>
        <td class="center">${line.vatRate}%</td>
        <td class="right">${formatCents(line.totalHTCents)}</td>
        <td class="right">${formatCents(line.totalTTCCents)}</td>
      </tr>`,
      )
      .join('');

    const mentionsHtml = (legalMentions || [])
      .map((m: string) => `<p class="mention">${m}</p>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .header-left { max-width: 60%; }
    .header-right { text-align: right; }
    .company-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .invoice-title { font-size: 22px; font-weight: 700; color: #0e1116; margin-bottom: 4px; }
    .invoice-number { font-size: 13px; color: #666; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { width: 45%; }
    .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; font-weight: 600; }
    .party-name { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
    .meta-row { display: flex; gap: 40px; margin-bottom: 30px; }
    .meta-item { }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 600; }
    .meta-value { font-size: 12px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px; text-align: left; border-bottom: 2px solid #ddd; }
    tbody td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    .center { text-align: center; }
    .right { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-table { width: 250px; }
    .totals-table tr td { padding: 6px 8px; font-size: 12px; }
    .totals-table tr:last-child td { font-weight: 700; font-size: 14px; border-top: 2px solid #333; padding-top: 10px; }
    .mentions { margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; }
    .mention { font-size: 9px; color: #888; margin-bottom: 2px; }
    .footer { margin-top: 40px; text-align: center; font-size: 9px; color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="company-name">${seller?.legalName || ''}</div>
      <div>${seller?.addressLine1 || ''}</div>
      ${seller?.addressLine2 ? `<div>${seller.addressLine2}</div>` : ''}
      <div>${seller?.postalCode || ''} ${seller?.city || ''}</div>
      <div>SIRET : ${seller?.siret || ''}</div>
      ${seller?.vatNumber ? `<div>TVA : ${seller.vatNumber}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-number">${metadata?.invoiceNumber || ''}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party"></div>
    <div class="party">
      <div class="party-label">Factur\u00e9 \u00e0</div>
      <div class="party-name">${buyer?.name || 'Client'}</div>
      ${buyer?.email ? `<div>${buyer.email}</div>` : ''}
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-item">
      <div class="meta-label">Date d'\u00e9mission</div>
      <div class="meta-value">${formatDate(metadata?.issueDate)}</div>
    </div>
    ${metadata?.serviceDate ? `
    <div class="meta-item">
      <div class="meta-label">Date de prestation</div>
      <div class="meta-value">${formatDate(metadata.serviceDate)}</div>
    </div>` : ''}
    <div class="meta-item">
      <div class="meta-label">Devise</div>
      <div class="meta-value">${metadata?.currency || 'EUR'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>D\u00e9signation</th>
        <th class="center">Qt\u00e9</th>
        <th class="right">PU HT</th>
        <th class="center">TVA</th>
        <th class="right">Total HT</th>
        <th class="right">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr>
        <td>Total HT</td>
        <td class="right">${formatCents(totals?.totalHTCents ?? 0)}</td>
      </tr>
      <tr>
        <td>TVA</td>
        <td class="right">${formatCents(totals?.totalVATCents ?? 0)}</td>
      </tr>
      <tr>
        <td>Total TTC</td>
        <td class="right">${formatCents(totals?.totalTTCCents ?? 0)}</td>
      </tr>
    </table>
  </div>

  <div class="mentions">
    ${mentionsHtml}
  </div>

  <div class="footer">
    ${seller?.legalName || ''} - SIRET ${seller?.siret || ''} - ${seller?.postalCode || ''} ${seller?.city || ''}
  </div>
</body>
</html>`;
  }
}
