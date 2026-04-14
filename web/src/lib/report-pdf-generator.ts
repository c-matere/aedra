import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PortfolioReportData } from './backend-api';

interface Branding {
    companyName: string;
    logoBase64?: string;
}

export async function generateFinancialStatementPdf(
    data: PortfolioReportData, 
    landlordName: string, 
    propertyUnits?: any[],
    branding?: Branding
) {
    const doc = new jsPDF() as any;
    const property = data.property;
    const totals = data.totals;
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- High-Contrast Premium Header ---
    doc.setFillColor(15, 25, 35); // #0f1923
    doc.rect(0, 0, pageWidth, 55, 'F');
    
    doc.setTextColor(99, 114, 133); // #637285
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("AEDRA INTELLIGENCE · FINANCIAL STATEMENT", 14, 22);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "normal");
    doc.text(property.name, 14, 34);
    
    doc.setTextColor(138, 154, 176); // #8a9ab0
    doc.setFontSize(10);
    doc.text(`${data.month} · Landlord: ${landlordName} · Prepared by Aedra AI`, 14, 42);

    // --- Branding Logo ---
    if (branding?.logoBase64) {
        try {
            doc.addImage(branding.logoBase64, 'PNG', pageWidth - 54, 12, 40, 30, undefined, 'FAST');
        } catch (e) {
            console.error("Failed to add logo to PDF", e);
        }
    } else {
        // Placeholder logo/text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(branding?.companyName?.toUpperCase() || "AEDRA", pageWidth - 14, 25, { align: 'right' });
    }

    // --- Metric Cards Strip ---
    const cardY = 65;
    const cardWidth = (pageWidth - 28) / 4;
    const cardHeight = 25;

    const renderMetric = (label: string, value: string, subValue: string, x: number, isPositive?: boolean) => {
        doc.setDrawColor(241, 245, 249);
        doc.rect(x, cardY, cardWidth, cardHeight);
        
        doc.setTextColor(99, 114, 133);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(label.toUpperCase(), x + 5, cardY + 7);
        
        doc.setTextColor(15, 25, 35);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(value, x + 5, cardY + 16);
        
        doc.setTextColor(isPositive ? 29 : 216, isPositive ? 158 : 90, isPositive ? 117 : 48);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(subValue, x + 5, cardY + 22);
    };

    const occupancyRate = totals.occupancy || 0;
    const collectionRate = totals.invoices ? Math.round((totals.payments / totals.invoices) * 100) : 0;
    const outstanding = Math.max(0, totals.invoices - totals.payments);

    renderMetric("OCCUPANCY", `${occupancyRate}%`, "↑ Stable vs prev", xCoord(0), true);
    renderMetric("COLLECTION", `${collectionRate}%`, "Active tracking", xCoord(1), true);
    renderMetric("OUTSTANDING", `KES ${(outstanding / 1000).toFixed(1)}K`, "Due this month", xCoord(2), false);
    renderMetric("MAINTENANCE", String(data.maintenance?.open || 0), "Open issues", xCoord(3));

    function xCoord(index: number) {
        return 14 + (index * cardWidth);
    }

    // --- Unit Breakdown Table ---
    doc.setTextColor(99, 114, 133);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("UNIT BREAKDOWN", 14, 105);

    const tableRows: any[] = [];
    data.tenantPayments.forEach(tp => {
        tableRows.push([
            tp.unit,
            tp.name,
            `KES ${tp.rentAmount?.toLocaleString()}`,
            `KES ${tp.paidThisMonth?.toLocaleString()}`,
            `KES ${(tp.rentAmount - tp.paidThisMonth)?.toLocaleString()}`
        ]);
    });

    if (propertyUnits) {
        const occupiedUnitNumbers = new Set(data.tenantPayments.map(tp => tp.unit));
        propertyUnits.forEach(u => {
            if (!occupiedUnitNumbers.has(u.unitNumber)) {
                tableRows.push([u.unitNumber, "", "", "", ""]);
            }
        });
    }

    autoTable(doc, {
        startY: 110,
        head: [['UNIT', 'TENANT', 'EXPECTED RENT', 'ACTUAL PAID', 'BALANCE']],
        body: tableRows,
        headStyles: { fillColor: [15, 25, 35], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // --- Building Summary Card ---
    const finalTableY = (doc as any).lastAutoTable.finalY;
    const summaryY = finalTableY + 15;
    
    if (summaryY > 230) doc.addPage();
    const currentSummaryY = summaryY > 230 ? 20 : summaryY;

    doc.setTextColor(15, 25, 35);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("BUILDING SUMMARY", 14, currentSummaryY);

    const commissionAmount = ((totals.payments || 0) * (property.commissionPercentage || 0)) / 100;
    const expensesByCategory = totals.expensesByCategory || [];
    const maintenanceExpenses = expensesByCategory
        .filter(e => ['MAINTENANCE', 'REPAIR'].includes(e.category))
        .reduce((sum, e) => sum + e.amount, 0);
    const utilityExpenses = expensesByCategory
        .filter(e => e.category === 'UTILITY')
        .reduce((sum, e) => sum + e.amount, 0);
    const otherExpenses = (totals.expenses || 0) - maintenanceExpenses - utilityExpenses;
    const netLandlordShare = (totals.payments || 0) - commissionAmount - (totals.expenses || 0);

    const summaryData = [
        ["Total Rent Collected", `KES ${(totals.payments || 0).toLocaleString()}`],
        [`Agency Commission (${property.commissionPercentage || 0}%)`, `KES ${commissionAmount.toLocaleString()}`],
        ["Maintenance & Repairs", `KES ${maintenanceExpenses.toLocaleString()}`],
        ["Utilities & Services", `KES ${utilityExpenses.toLocaleString()}`],
        ["Operating Expenses", `KES ${otherExpenses.toLocaleString()}`],
        ["NET LANDLORD SHARE", `KES ${netLandlordShare.toLocaleString()}`]
    ];

    autoTable(doc, {
        startY: currentSummaryY + 5,
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (dataCell: any) => {
            if (dataCell.row.index === 5) {
                dataCell.cell.styles.fillColor = [29, 158, 117]; // #1d9e75 (Emerald)
                dataCell.cell.styles.textColor = [255, 255, 255];
                dataCell.cell.styles.fontSize = 11;
                dataCell.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // --- Footer ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text(
            `Generated by Aedra AI · ${branding?.companyName || 'Management'} · Confidential · Page ${i} of ${totalPages}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    const fileName = `${property.name.replace(/\s+/g, '_')}_Statement_${data.month.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}
