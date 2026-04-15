import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PortfolioReportData, CompanyRecord, getLogoUrl } from './backend-api';

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
    const logoUrl = getLogoUrl(company?.logo) || "/aedra logo.png";
    const logo = await loadImage(logoUrl);
    if (logo) {
        doc.addImage(logo, 'PNG', margin, margin, 25, 25);
    }

    // Company Info (Top Left)
    const startY = 45; // Always reserve space for logo since we have a fallback
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text(company?.name || "AEDRA MANAGEMENT", margin, startY);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    let currentInfoY = startY + 4;
    
    // Always show these block but fallback to Aedra defaults if company data is missing
    const address = company?.address || "P.O BOX 80000-80100, MOMBASA, KENYA";
    doc.text(address, margin, currentInfoY);
    currentInfoY += 4;

    const phone = company?.phone || "Property Management Office";
    doc.text(`TEL: ${phone}`, margin, currentInfoY);
    currentInfoY += 4;

    const email = company?.email || "support@aedra.co.ke";
    doc.text(`EMAIL: ${email}`, margin, currentInfoY);
    currentInfoY += 4;

    if (company?.pinNumber) {
        doc.setFont("helvetica", "bold");
        doc.text(`PIN: ${company.pinNumber}`, margin, currentInfoY);
        currentInfoY += 4;
    }


    const headerFinalY = Math.max(currentInfoY, startY + 20);


    // Report Title & Meta (Top Right)
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("REMITTANCE REPORT", rightAlignX, margin + 5, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`PROPERTY: ${property.name.toUpperCase()}`, rightAlignX, margin + 12, { align: 'right' });
    doc.text(`LANDLORD: ${landlordName.toUpperCase()}`, rightAlignX, margin + 17, { align: 'right' });
    doc.text(`MONTH: ${data.month.toUpperCase()}`, rightAlignX, margin + 22, { align: 'right' });

    // --- 2. Unit Breakdown Table ---
    const tableRows: any[] = [];
    
    let sumExpected = 0;
    let sumPaid = 0;
    let sumBalance = 0;

    // Occupied Units
    data.tenantPayments.forEach(tp => {
        const expected = tp.rentAmount || 0;
        const paid = tp.paidThisMonth || 0;
        const balance = expected - paid;

        sumExpected += expected;
        sumPaid += paid;
        sumBalance += balance;

        tableRows.push([
            tp.unit,
            tp.name,
            expected.toLocaleString(),
            paid.toLocaleString(),
            balance.toLocaleString()
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
                    "—",
                    "—",
                    "—"
                ]);
            }
        });
    }

    autoTable(doc, {
        startY: headerFinalY + 12,
        head: [[
            'UNIT NUMBER', 
            'TENANT', 
            'EXPECTED RENT', 
            'ACTUAL PAID', 
            'BALANCE'
        ]],
        body: tableRows,
        theme: 'striped',
        headStyles: { 
            fillColor: [30, 30, 30], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: 3
        },
        styles: { 
            fontSize: 8, 
            cellPadding: 3, 
            font: 'helvetica',
            lineWidth: 0.1,
            lineColor: [230, 230, 230]
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 60 },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // --- 3. Building Summary ---
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Calculate categorized expenses
    const expensesByCategory = totals.expensesByCategory || [];
    const commissionPct = property.commissionPercentage || 0;
    const commissionAmount = (sumPaid * commissionPct) / 100;

    const maintenanceExpenses = expensesByCategory
        .filter(e => ['MAINTENANCE', 'REPAIR'].includes(e.category))
        .reduce((sum, e) => sum + e.amount, 0);

    const utilityExpenses = expensesByCategory
        .filter(e => e.category === 'UTILITY')
        .reduce((sum, e) => sum + e.amount, 0);

    const otherExpenses = (totals.expenses || 0) - maintenanceExpenses - utilityExpenses;
    const netLandlordShare = sumPaid - commissionAmount - (totals.expenses || 0);

    // Render Summary Section
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("BUILDING SUMMARY (FOR THE MONTH)", margin, finalY);
    
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, finalY + 2, pageWidth - margin, finalY + 2);

    let summaryY = finalY + 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    const renderSummaryRow = (label: string, value: string, isTotal = false) => {
        if (isTotal) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
        } else {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
        }
        
        doc.text(label, margin, summaryY);
        doc.text(value, rightAlignX, summaryY, { align: 'right' });
        summaryY += 8;
    };

    renderSummaryRow("TOTAL RENT COLLECTED", `KES ${sumPaid.toLocaleString()}`);
    renderSummaryRow("AGENT COMMISSION", `KES ${commissionAmount.toLocaleString()} (${commissionPct}%)`);
    renderSummaryRow("MAINTENANCE & REPAIRS", `KES ${maintenanceExpenses.toLocaleString()}`);
    renderSummaryRow("UTILITIES", `KES ${utilityExpenses.toLocaleString()}`);
    renderSummaryRow("OTHER EXPENSES", `KES ${otherExpenses.toLocaleString()}`);
    
    summaryY += 2;
    doc.line(margin, summaryY - 4, pageWidth - margin, summaryY - 4);
    renderSummaryRow("NET LANDLORD SHARE", `KES ${netLandlordShare.toLocaleString()}`, true);

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

    const filename = `${property.name.replace(/\s+/g, '_')}_Financial_Statement_${data.month.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
}

