import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PortfolioReportData, CompanyRecord } from './backend-api';

export async function generateFinancialStatementPdf(
    data: PortfolioReportData, 
    landlordName: string, 
    company: CompanyRecord | null,
    propertyUnits?: any[]
) {
    const doc = new jsPDF('p', 'mm', 'a4'); 
    const property = data.property;
    const totals = data.totals;
    const margin = 14;
    const pageWidth = doc.internal.pageSize.width;
    const rightAlignX = pageWidth - margin;

    // --- Helper: Load Image ---
    const loadImage = (url: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
        });
    };

    // --- 1. Branding Header ---
    if (company?.logo) {
        const logo = await loadImage(company.logo);
        if (logo) {
            doc.addImage(logo, 'PNG', margin, margin, 25, 25);
        }
    }

    // Company Info (Top Left, below logo if exists)
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const startY = company?.logo ? 45 : margin;
    doc.text(company?.name || "AEDRA MANAGEMENT", margin, startY);
    doc.text(company?.address || "", margin, startY + 4);
    doc.text(company?.phone || "", margin, startY + 8);
    doc.text(company?.email || "", margin, startY + 12);

    // Report Title & Meta (Top Right)
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("PROPERTY FINANCIAL STATEMENT", rightAlignX, margin + 5, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`PROPERTY: ${property.name.toUpperCase()}`, rightAlignX, margin + 12, { align: 'right' });
    doc.text(`LANDLORD: ${landlordName.toUpperCase()}`, rightAlignX, margin + 17, { align: 'right' });
    doc.text(`MONTH: ${data.month.toUpperCase()}`, rightAlignX, margin + 22, { align: 'right' });

    // --- 2. Unit Breakdown Table ---
    const tableRows: any[] = [];
    const vatRate = 0.16; // Standard VAT in Kenya
    const commissionPct = property.commissionPercentage || 0;

    // Occupied Units
    data.tenantPayments.forEach(tp => {
        const invoiceAmt = tp.rentAmount || 0;
        const currentCollection = tp.paidThisMonth || 0;
        const outstanding = invoiceAmt - currentCollection;
        
        const managementFee = (currentCollection * commissionPct) / 100;
        const vat = managementFee * vatRate;
        const totalDeduction = managementFee + vat;
        
        const amountRemitted = currentCollection; 
        const amountPayable = currentCollection - totalDeduction;

        tableRows.push([
            tp.unit,
            tp.name,
            invoiceAmt.toLocaleString(),
            currentCollection.toLocaleString(),
            outstanding.toLocaleString(),
            amountRemitted.toLocaleString(),
            totalDeduction.toLocaleString(),
            amountPayable.toLocaleString()
        ]);
    });

    // Vacant Units
    if (propertyUnits) {
        const occupiedUnitNumbers = new Set(data.tenantPayments.map(tp => tp.unit));
        propertyUnits.forEach(u => {
            if (!occupiedUnitNumbers.has(u.unitNumber)) {
                tableRows.push([
                    u.unitNumber,
                    "VACANT",
                    "",
                    "",
                    "",
                    "",
                    "",
                    ""
                ]);
            }
        });
    }

    autoTable(doc, {
        startY: startY + 25,
        head: [[
            'UNIT', 
            'TENANT', 
            'INV', 
            'RECD', 
            'BAL', 
            'REMT', 
            'FEE+VAT', 
            'PAY'
        ]],
        body: tableRows,
        theme: 'striped',
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        styles: { 
            fontSize: 7.5, 
            cellPadding: 2.5, 
            font: 'helvetica',
            lineWidth: 0.1,
            lineColor: [230, 230, 230]
        },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // --- 3. Summary Section ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Check for page overflow
    const checkSpace = (y: number) => {
        if (y > 240) {
            doc.addPage();
            return 20;
        }
        return y;
    };

    const summaryY = checkSpace(finalY);

    const commissionAmount = ((totals.payments || 0) * commissionPct) / 100;
    const totalVat = commissionAmount * vatRate;
    const totalDeductions = commissionAmount + totalVat + (totals.expenses || 0);
    const netLandlordShare = (totals.payments || 0) - totalDeductions;

    const summaryData = [
        ["TOTAL RENT COLLECTED", `KES ${(totals.payments || 0).toLocaleString()}`],
        ["TOTAL MANAGEMENT FEE", `KES ${commissionAmount.toLocaleString()}`],
        ["TOTAL VAT (16%)", `KES ${totalVat.toLocaleString()}`],
        ["BUILDING EXPENSES", `KES ${(totals.expenses || 0).toLocaleString()}`],
        ["TOTAL DEDUCTIONS", `KES ${totalDeductions.toLocaleString()}`],
        ["NET AMOUNT PAYABLE", `KES ${netLandlordShare.toLocaleString()}`]
    ];

    autoTable(doc, {
        startY: summaryY,
        body: summaryData,
        theme: 'plain',
        margin: { left: pageWidth - 104 }, // Align to the right side (60+40 + metadata margins)
        styles: { fontSize: 8.5, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 55 },
            1: { halign: 'right', cellWidth: 35 }
        },
        didParseCell: (dataCell: any) => {
            if (dataCell.row.index === 5) { // Net Amount Payable
                dataCell.cell.styles.fontStyle = 'bold';
                dataCell.cell.styles.fontSize = 10;
                dataCell.cell.styles.textColor = [0, 0, 0];
            }
        }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount} | Generated by Aedra AI Management System`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Save
    const filename = `${property.name.replace(/\s+/g, '_')}_Statement_${data.month.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
}
