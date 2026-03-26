import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import * as puppeteer from 'puppeteer';

@Injectable()
export class ReportsGeneratorService {
  private readonly logger = new Logger(ReportsGeneratorService.name);
  private readonly reportsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateCsv(
    data: any[],
    fileName: string,
    fields?: string[],
  ): Promise<string> {
    try {
      const parser = new Parser({
        ...(fields && fields.length > 0 ? { fields } : {}),
        withBOM: true,
      });
      const csv = parser.parse(data || []);
      const filePath = path.join(this.reportsDir, fileName);
      fs.writeFileSync(filePath, csv, { encoding: 'utf8' });
      return this.getFileUrl(fileName);
    } catch (err) {
      this.logger.error('Error generating CSV', err);
      throw err;
    }
  }

  async publishFile(localPath: string, fileName: string): Promise<string> {
    try {
      const destPath = path.join(this.reportsDir, fileName);
      fs.copyFileSync(localPath, destPath);
      return this.getFileUrl(fileName);
    } catch (err) {
      this.logger.error(`Error publishing file ${fileName}`, err);
      throw err;
    }
  }

  /**
   * Basic PDF generation using Puppeteer (Legacy wrap)
   */
  async generatePdf(
    data: any,
    title: string,
    fileName: string,
  ): Promise<string> {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 50px; }
            h1 { text-align: center; color: #333; }
            .date { text-align: center; color: #666; margin-bottom: 30px; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="date">Generated on: ${new Date().toLocaleString()}</div>
          ${Array.isArray(data) ? this.renderBasicTable(data) : `<pre>${JSON.stringify(data, null, 2)}</pre>`}
        </body>
      </html>
    `;
    return this.generatePdfFromHtml(html, fileName);
  }

  /**
   * Premium PDF generation for McKinsey-grade reports
   */
  async generatePremiumPdf(
    insights: any,
    propertiesData: any,
    fileName: string,
  ): Promise<string> {
    const html = this.renderPremiumHtml(insights, propertiesData);
    return this.generatePdfFromHtml(html, fileName);
  }

  async generateHistoryPdf(
    entity: string,
    targetId: string,
    history: any[],
    fileName: string,
  ): Promise<string> {
    const html = this.renderHistoryHtml(entity, targetId, history);
    return this.generatePdfFromHtml(html, fileName);
  }

  private async generatePdfFromHtml(
    html: string,
    fileName: string,
  ): Promise<string> {
    const filePath = path.join(this.reportsDir, fileName);
    let browser;
    try {
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
      const page = await browser.newPage();
      this.logger.log(`Generating PDF for ${fileName} to path: ${filePath}...`);
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 60000,
      });
      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true,
      });

      if (fs.existsSync(filePath)) {
        this.logger.log(`Successfully verified file exists at: ${filePath}`);
      } else {
        this.logger.error(
          `CRITICAL: File missing immediately after generation at: ${filePath}`,
        );
      }

      return this.getFileUrl(fileName);
    } catch (err) {
      this.logger.error('Error generating PDF via Puppeteer', err);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }

  private renderBasicTable(data: any[]): string {
    if (!data.length) return '<p>No data found.</p>';
    const headers = Object.keys(data[0]);
    return `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #eee;">
            ${headers.map((h) => `<th style="border: 1px solid #ccc; padding: 8px; text-align: left;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${headers.map((h) => `<td style="border: 1px solid #ccc; padding: 8px;">${row[h] || ''}</td>`).join('')}
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  private renderPremiumHtml(insights: any, propertiesData: any): string {
    const {
      execBadge,
      execSummary,
      waterfall = [],
      heatmap = [],
      patterns = [],
      risks = [],
      recommendations = [],
    } = insights;

    const totals = propertiesData.totals || {};
    const maintenance = propertiesData.maintenance || {};
    const occupancyRate = totals.occupancy || 0;
    const collectionRate = totals.invoices
      ? Math.round((totals.payments / totals.invoices) * 100)
      : 0;
    const outstanding = Math.max(0, totals.invoices - totals.payments);

    // Formatters
    const fmtK = (n: number) =>
      n >= 1000 ? `${Math.round(n / 1000)}K` : n.toLocaleString();
    const fmt = (n: number) => n.toLocaleString();

    const badgeClass = execBadge?.toLowerCase().includes('strong')
      ? 'b-green'
      : execBadge?.toLowerCase().includes('risk')
        ? 'b-red'
        : 'b-amber';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aedra · ${propertiesData.property?.name || 'Portfolio Report'}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');
            
            :root {
              --color-background-primary: #ffffff;
              --color-background-secondary: #f8fafc;
              --color-text-primary: #0f1923;
              --color-text-secondary: #637285;
              --color-border-tertiary: #f1f5f9;
              --border-radius-lg: 12px;
              --border-radius-md: 8px;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: #fff; color: var(--color-text-primary); }
            
            .wrap { padding: 1.5rem; max-width: 900px; font-family: 'Outfit', sans-serif; margin: 0 auto; }
            
            .cover { border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); overflow: hidden; margin-bottom: 1.25rem; }
            .cover-top { background: #0f1923; padding: 2rem; color: #fff; }
            .cover-eyebrow { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #637285; margin-bottom: 0.6rem; font-family: 'DM Mono', monospace; }
            .cover-title { font-family: 'DM Serif Display', serif; font-size: 30px; font-weight: 400; line-height: 1.15; margin-bottom: 0.4rem; }
            .cover-sub { font-size: 12px; color: #8a9ab0; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
            
            .cover-metrics { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--color-background-secondary); border-top: 0.5px solid var(--color-border-tertiary); }
            .m-box { padding: 1rem 1.25rem; border-right: 0.5px solid var(--color-border-tertiary); }
            .m-box:last-child { border-right: none; }
            .m-lbl { font-size: 10px; color: var(--color-text-secondary); font-weight: 400; margin-bottom: 5px; letter-spacing: 0.05em; text-transform: uppercase; font-family: 'DM Mono', monospace; }
            .m-val { font-size: 24px; font-weight: 500; color: var(--color-text-primary); line-height: 1; }
            .m-delta { font-size: 11px; margin-top: 4px; font-family: 'DM Mono', monospace; }
            .up { color: #1d9e75; } .dn { color: #d85a30; } .neutral { color: var(--color-text-secondary); }
            
            .section { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1.25rem; margin-bottom: 1rem; }
            .s-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 0.5px solid var(--color-border-tertiary); }
            .s-title { font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-text-secondary); font-family: 'DM Mono', monospace; }
            
            .badge { font-size: 10px; padding: 3px 8px; border-radius: 4px; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
            .b-green { background: #eaf3de; color: #3b6d11; }
            .b-amber { background: #faeeda; color: #854f0b; }
            .b-red { background: #fcebeb; color: #a32d2d; }
            .b-blue { background: #e6f1fb; color: #185fa5; }
            
            .exec-box { background: var(--color-background-secondary); border-left: 3px solid #0f1923; padding: 1rem 1.25rem; border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0; font-size: 14px; line-height: 1.85; color: var(--color-text-primary); }
            
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
            .chart-label { font-size: 10px; font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-text-secondary); margin-bottom: 8px; }
            .chart-wrap { position: relative; width: 100%; height: 180px; }
            
            .narrative { font-size: 13.5px; line-height: 1.8; color: var(--color-text-primary); margin-bottom: 1rem; }
            
            .heat-wrap { overflow-x: auto; }
            .heat-table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'DM Mono', monospace; }
            .heat-table th { font-size: 10px; color: var(--color-text-secondary); font-weight: 400; padding: 6px 8px; text-align: center; letter-spacing: 0.06em; border-bottom: 0.5px solid var(--color-border-tertiary); }
            .heat-table th:first-child { text-align: left; }
            .heat-table td { padding: 5px 8px; text-align: center; border-bottom: 0.5px solid var(--color-border-tertiary); }
            .heat-table td:first-child { text-align: left; color: var(--color-text-primary); font-size: 12px; }
            .heat-table tr:last-child td { border-bottom: none; }
            
            .hc-g { background: #eaf3de; color: #3b6d11; border-radius: 3px; padding: 2px 6px; display: inline-block; }
            .hc-a { background: #faeeda; color: #854f0b; border-radius: 3px; padding: 2px 6px; display: inline-block; }
            .hc-r { background: #fcebeb; color: #a32d2d; border-radius: 3px; padding: 2px 6px; display: inline-block; }
            
            .risk-list { list-style: none; }
            .risk-item { display: flex; gap: 10px; padding: 11px 0; border-bottom: 0.5px solid var(--color-border-tertiary); align-items: flex-start; }
            .risk-item:last-child { border-bottom: none; }
            .rdot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
            .rdot.red { background: #e24b4a; } .rdot.amber { background: #ef9f27; } .rdot.green { background: #639922; }
            .r-label { font-size: 10px; font-family: 'DM Mono', monospace; color: var(--color-text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
            .r-body { font-size: 13px; line-height: 1.65; color: var(--color-text-primary); }
            
            .rec-list { list-style: none; }
            .rec-item { display: flex; gap: 14px; padding: 11px 0; border-bottom: 0.5px solid var(--color-border-tertiary); align-items: flex-start; }
            .rec-item:last-child { border-bottom: none; }
            .rec-num { font-size: 10px; font-family: 'DM Mono', monospace; color: var(--color-text-secondary); min-width: 18px; margin-top: 3px; }
            .rec-body { font-size: 13px; line-height: 1.65; color: var(--color-text-primary); }
            
            .pattern-card { background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 1rem 1.25rem; margin-bottom: 10px; font-size: 13px; line-height: 1.75; color: var(--color-text-primary); }
            .pattern-card .p-tag { font-size: 10px; font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-secondary); margin-bottom: 6px; }
            
            .roi-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); overflow: hidden; margin-top: 1rem; }
            .roi-cell { padding: 0.9rem 1rem; text-align: center; border-right: 0.5px solid var(--color-border-tertiary); }
            .roi-cell:last-child { border-right: none; }
            .roi-lbl { font-size: 10px; font-family: 'DM Mono', monospace; color: var(--color-text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
            .roi-val { font-size: 18px; font-weight: 500; color: var(--color-text-primary); }
            
            .footer { font-size: 10px; color: var(--color-text-secondary); font-family: 'DM Mono', monospace; text-align: center; padding: 1.25rem 0 0; border-top: 0.5px solid var(--color-border-tertiary); margin-top: 0.5rem; letter-spacing: 0.04em; }
            
            .wf-row { display: flex; align-items: center; gap: 8px; font-size: 12px; font-family: 'DM Mono', monospace; margin-bottom: 6px; }
            .wf-lbl { min-width: 110px; color: var(--color-text-secondary); font-size: 11px; }
            .wf-bar { height: 22px; border-radius: 3px; display: flex; align-items: center; padding: 0 8px; font-size: 11px; font-weight: 500; white-space:nowrap; min-width: 40px; }
          </style>
      </head>
      <body>
          <div class="wrap">
              <!-- COVER -->
              <div class="cover">
                <div class="cover-top">
                  <div class="cover-eyebrow">Homeet Intelligence · Monthly Portfolio Report</div>
                  <div class="cover-title">${propertiesData.property?.name || 'Portfolio Overview'}</div>
                  <div class="cover-sub">${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · Managed by ${propertiesData.property?.manager || 'Aedra'} · Prepared by Homeet AI</div>
                </div>
                <div class="cover-metrics">
                  <div class="m-box">
                    <div class="m-lbl">Occupancy</div>
                    <div class="m-val">${occupancyRate}%</div>
                    <div class="m-delta up">↑ Stable</div>
                  </div>
                  <div class="m-box">
                    <div class="m-lbl">Collection rate</div>
                    <div class="m-val">${collectionRate}%</div>
                    <div class="m-delta up">↑ Active tracking</div>
                  </div>
                  <div class="m-box">
                    <div class="m-lbl">Outstanding</div>
                    <div class="m-val">KES ${fmtK(outstanding)}</div>
                    <div class="m-delta dn">Action required</div>
                  </div>
                  <div class="m-box">
                    <div class="m-lbl">Open issues</div>
                    <div class="m-val">${maintenance.open || 0}</div>
                    <div class="m-delta neutral">${maintenance.resolved || 0} resolved</div>
                  </div>
                </div>
              </div>

              <!-- EXECUTIVE SUMMARY -->
              <div class="section">
                <div class="s-hdr">
                  <div class="s-title">Executive summary</div>
                  <div class="badge ${badgeClass}">${execBadge || 'Stable'}</div>
                </div>
                <div class="exec-box">${execSummary || 'Executive summary currently being detailed by intelligence engine...'}</div>
              </div>

              <!-- CHARTS -->
              <div class="two-col">
                <div class="section">
                  <div class="s-hdr"><div class="s-title">Rent collection</div></div>
                  <div class="chart-label">Collected vs target (KES thousands)</div>
                  <div class="chart-wrap"><canvas id="colChart"></canvas></div>
                </div>
                <div class="section">
                  <div class="s-hdr"><div class="s-title">Payment methods</div></div>
                  <div class="chart-label">Distribution — ${new Date().toLocaleDateString(undefined, { month: 'short' })}</div>
                  <div class="chart-wrap"><canvas id="payChart"></canvas></div>
                </div>
              </div>

              <!-- WATERFALL -->
              <div class="section">
                <div class="s-hdr">
                  <div class="s-title">Net yield waterfall</div>
                  <div class="badge b-blue">Yield analysis</div>
                </div>
                <div class="narrative">Data-driven waterfall breakdown from gross rent to net yield, accounting for operational leakage and maintenance spend.</div>
                <div class="waterfall-list">
                  ${waterfall
                    .map((row: any) => {
                      const maxVal = Math.max(
                        ...waterfall.map((r: any) => Math.abs(r.value)),
                      );
                      const widthPct = Math.max(
                        8,
                        Math.round((Math.abs(row.value) / maxVal) * 90),
                      );
                      const isNeg = row.value < 0;
                      const color =
                        row.type === 'total'
                          ? 'b-green'
                          : isNeg
                            ? 'b-red'
                            : 'b-blue';
                      return `
                      <div class="wf-row">
                        <div class="wf-lbl">${row.label}</div>
                        <div class="wf-bar ${color}" style="width: ${widthPct}%">
                          ${isNeg ? '− ' : ''}KES ${fmt(Math.abs(row.value))}
                        </div>
                        ${row.note ? `<div class="wf-val">${row.note}</div>` : ''}
                      </div>
                    `;
                    })
                    .join('')}
                </div>
              </div>

              <!-- HEATMAP -->
              <div class="section">
                <div class="s-hdr">
                  <div class="s-title">Tenant payment heatmap</div>
                  <div class="badge b-amber">${heatmap.length > 0 ? heatmap.filter((h: any) => h.ltv < 80).length + ' Flags' : 'No Flags'}</div>
                </div>
                <div class="heat-wrap">
                  <table class="heat-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Unit</th>
                        ${(heatmap[0]?.payments || []).map((p: any) => `<th>${p.month}</th>`).join('')}
                        <th>LTV</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${heatmap
                        .map(
                          (row: any) => `
                        <tr>
                          <td>${row.name}</td>
                          <td>${row.unit}</td>
                          ${(row.payments || [])
                            .map(
                              (p: any) => `
                            <td><span class="${p.status === 'ok' ? 'hc-g' : p.status === 'late' ? 'hc-a' : 'hc-r'}">${p.status}</span></td>
                          `,
                            )
                            .join('')}
                          <td><span class="hc-g" style="background:${row.ltv > 85 ? '#eaf3de' : '#faeeda'}; color:${row.ltv > 85 ? '#3b6d11' : '#854f0b'}">${row.ltv}</span></td>
                        </tr>
                      `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- PATTERNS -->
              <div class="section">
                <div class="s-hdr">
                  <div class="s-title">Deep pattern analysis</div>
                  <div class="badge b-blue">AI Insight Layer</div>
                </div>
                ${patterns
                  .map(
                    (p: any) => `
                  <div class="pattern-card">
                    <div class="p-tag">${p.tag}</div>
                    <div>${p.body}</div>
                  </div>
                `,
                  )
                  .join('')}
              </div>

              <!-- RISKS & RECS -->
              <div class="two-col">
                <div class="section">
                  <div class="s-hdr"><div class="s-title">Risk flags</div><div class="badge b-red">${risks.length} Flags</div></div>
                  <ul class="risk-list">
                    ${risks
                      .map(
                        (r: any) => `
                      <li class="risk-item">
                        <div class="rdot ${r.level}"></div>
                        <div>
                          <div class="r-label">${r.label}</div>
                          <div class="r-body">${r.detail}</div>
                        </div>
                      </li>
                    `,
                      )
                      .join('')}
                  </ul>
                </div>
                <div class="section">
                  <div class="s-hdr"><div class="s-title">Recommendations</div><div class="badge b-blue">Actions</div></div>
                  <ul class="rec-list">
                    ${recommendations
                      .map(
                        (rec: any, i: number) => `
                      <li class="rec-item">
                        <div class="rec-num">0${i + 1}</div>
                        <div class="rec-body">${rec.action} <br> <span style="color:#d85a30; font-size:11px; font-family:'DM Mono'">→ ${rec.deadline}</span></div>
                      </li>
                    `,
                      )
                      .join('')}
                  </ul>
                </div>
              </div>

              <div class="footer">Generated by Homeet Intelligence · Powered by Aedra · ${new Date().toLocaleDateString()} · Confidential</div>
          </div>

          <script>
            new Chart(document.getElementById('colChart'), {
              type: 'bar',
              data: {
                labels: ['Target', 'Collected', 'Expenses'],
                datasets: [{
                  data: [${totals.invoices / 1000}, ${totals.payments / 1000}, ${totals.expenses / 1000}],
                  backgroundColor: ['#b5d4f4', '#1d9e75', '#f0997b'],
                  borderWidth: 0, borderRadius: 4
                }]
              },
              options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { font: { size: 10, family: 'DM Mono' }, callback: v => v + 'K', color: '#888780' }, grid: { color: 'rgba(128,128,128,0.1)' } },
                  y: { ticks: { font: { size: 11, family: 'DM Mono' }, color: '#888780' }, grid: { display: false } }
                }
              }
            });

            new Chart(document.getElementById('payChart'), {
              type: 'doughnut',
              data: {
                labels: ${JSON.stringify((propertiesData.paymentMethods || []).map((m: any) => m.method))},
                datasets: [{ 
                  data: ${JSON.stringify((propertiesData.paymentMethods || []).map((m: any) => m.count))}, 
                  backgroundColor: ['#1d9e75', '#378add', '#888780', '#ef9f27', '#e24b4a'], 
                  borderWidth: 0, 
                  hoverOffset: 4 
                }]
              },
              options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: { legend: { display: false } }
              }
            });
          </script>
      </body>
      </html>
    `;
  }

  private getFileUrl(fileName: string): string {
    const baseUrl =
      process.env.FILE_BASE_URL ||
      process.env.PUBLIC_URL ||
      process.env.API_URL ||
      '';

    if (!baseUrl) {
      this.logger.warn(
        'FILE_BASE_URL/PUBLIC_URL not set; returning relative file path. Configure FILE_BASE_URL to avoid localhost links.',
      );
      return `/documents/files/${fileName}`;
    }

    const normalizedBase = baseUrl.endsWith('/')
      ? baseUrl.slice(0, -1)
      : baseUrl;

    return `${normalizedBase}/documents/files/${fileName}`;
  }

  private renderHistoryHtml(
    entity: string,
    targetId: string,
    history: any[],
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Aedra · Entity History</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
            body { font-family: 'Outfit', sans-serif; padding: 40px; color: #0f1923; line-height: 1.6; }
            .header { border-bottom: 2px solid #0f1923; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
            .subtitle { font-family: 'DM Mono', monospace; font-size: 12px; color: #637285; margin-top: 5px; }
            .log-entry { border-left: 2px solid #e2e8f0; padding-left: 20px; position: relative; margin-bottom: 30px; }
            .log-entry::before { content: ''; width: 10px; height: 10px; background: #0f1923; border-radius: 50%; position: absolute; left: -6px; top: 0; }
            .log-time { font-family: 'DM Mono', monospace; font-size: 11px; color: #637285; }
            .log-action { font-weight: 600; font-size: 14px; margin: 4px 0; }
            .log-actor { font-size: 11px; color: #637285; margin-bottom: 8px; }
            .diff-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
            .diff-table th { text-align: left; font-size: 11px; text-transform: uppercase; color: #637285; padding: 8px; border-bottom: 1px solid #f1f5f9; }
            .diff-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
            .field-name { font-weight: 500; width: 25%; }
            .old-val { color: #d85a30; text-decoration: line-through; }
            .new-val { color: #1d9e75; font-weight: 500; }
            .footer { margin-top: 50px; font-size: 10px; color: #637285; text-align: center; font-family: 'DM Mono', monospace; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="title">${entity} History Log</div>
              <div class="subtitle">Entity ID: ${targetId} · Generated by Aedra Version Control</div>
          </div>

          ${history
            .map(
              (entry) => `
            <div class="log-entry">
                <div class="log-time">${new Date(entry.timestamp).toLocaleString()}</div>
                <div class="log-action">${entry.action}</div>
                <div class="log-actor">By: ${entry.actor.role} (${entry.actor.id})</div>
                
                ${
                  Object.keys(entry.diff).length > 0
                    ? `
                <table class="diff-table">
                    <thead>
                        <tr>
                            <th>Field</th>
                            <th>Previous State</th>
                            <th>New State</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(entry.diff)
                          .map(
                            ([field, delta]: [string, any]) => `
                        <tr>
                            <td class="field-name">${field}</td>
                            <td class="old-val">${delta.old !== null ? delta.old : '<em>null</em>'}</td>
                            <td class="new-val">${delta.new !== null ? delta.new : '<em>null</em>'}</td>
                        </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
                `
                    : '<div style="font-size: 12px; font-style: italic; color: #637285;">No field-level changes recorded.</div>'
                }
            </div>
          `,
            )
            .join('')}

          <div class="footer">Confidential · Internal Version Control Report · Aedra AI</div>
      </body>
      </html>
    `;
  }
}
