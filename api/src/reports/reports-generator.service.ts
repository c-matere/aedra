import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportsGeneratorService {
  private readonly logger = new Logger(ReportsGeneratorService.name);
  private readonly reportsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateCsv(data: any[], fileName: string): Promise<string> {
    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      const filePath = path.join(this.reportsDir, fileName);
      fs.writeFileSync(filePath, csv);
      return this.getFileUrl(fileName);
    } catch (err) {
      this.logger.error('Error generating CSV', err);
      throw err;
    }
  }

  async generatePdf(data: any, title: string, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const filePath = path.join(this.reportsDir, fileName);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc.fontSize(25).text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Content
        if (Array.isArray(data)) {
          this.drawTable(doc, data);
        } else {
          doc.fontSize(14).text(JSON.stringify(data, null, 2));
        }

        doc.end();

        stream.on('finish', () => {
          resolve(this.getFileUrl(fileName));
        });

        stream.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        this.logger.error('Error generating PDF', err);
        reject(err);
      }
    });
  }

  private drawTable(doc: any, data: any[]) {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const colWidth = (doc.page.width - 100) / headers.length;
    let y = doc.y;

    // Table Headers
    doc.fontSize(12).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header.charAt(0).toUpperCase() + header.slice(1), 50 + i * colWidth, y, { width: colWidth, align: 'left' });
    });

    y += 20;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
    y += 10;

    // Table Rows
    doc.font('Helvetica').fontSize(10);
    data.forEach((row) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }
      headers.forEach((header, i) => {
        const value = row[header]?.toString() || '';
        doc.text(value, 50 + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      y += 20;
    });
  }

  private getFileUrl(fileName: string): string {
    const baseUrl = process.env.API_URL || 'http://localhost:4001';
    return `${baseUrl}/documents/files/${fileName}`;
  }
}
