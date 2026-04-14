import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PortfolioReportData } from './backend-api';

export function generateFinancialStatementPdf(data: PortfolioReportData, landlordName: string, propertyUnits?: any[]) {
    const doc = new jsPDF();
    const property = data.property;
    const totals = data.totals;

    // --- Header Section ---
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text("PROPERTY FINANCIAL REPORT", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    // --- Property Info ---
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(property.name.toUpperCase(), 14, 40);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Landlord: ${landlordName}`, 14, 46);
    doc.text(`Address: ${property.address || 'N/A'}`, 14, 51);
    doc.text(`Report Month: ${data.month || 'Current Month'}`, 14, 56);

    // --- Unit Breakdown Table ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("UNIT BREAKDOWN", 14, 70);

    const tableRows: any[] = [];
    
    // Occupied Units
    data.tenantPayments.forEach(tp => {
        tableRows.push([
            tp.unit,
            tp.name,
            `KES ${tp.rentAmount?.toLocaleString()}`,
            `KES ${tp.paidThisMonth?.toLocaleString()}`,
            `KES ${(tp.rentAmount - tp.paidThisMonth)?.toLocaleString()}`
        ]);
    });

    // Vacant Units (if propertyUnits provided)
    if (propertyUnits) {
        const occupiedUnitNumbers = new Set(data.tenantPayments.map(tp => tp.unit));
        propertyUnits.forEach(u => {
            if (!occupiedUnitNumbers.has(u.unitNumber)) {
                tableRows.push([
                    u.unitNumber,
                    "",
                    "",
                    "",
                    ""
                ]);
            }
        });
    }

    autoTable(doc, {
        startY: 75,
        head: [['UNIT NUMBER', 'TENANT', 'EXPECTED RENT', 'ACTUAL PAID', 'BALANCE']],
        body: tableRows,
        headStyles: { fillColor: [45, 45, 45], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    // --- Building Summary Section ---
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    if (finalY > 250) {
        doc.addPage();
    }
    
    const summaryStartY = finalY > 250 ? 20 : finalY;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("BUILDING SUMMARY (FOR THE MONTH)", 14, summaryStartY);

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
        ["TOTAL RENT COLLECTED", `KES ${(totals.payments || 0).toLocaleString()}`],
        ["AGENT COMMISSION", `KES ${commissionAmount.toLocaleString()} (${property.commissionPercentage || 0}%)`],
        ["MAINTENANCE & REPAIRS", `KES ${maintenanceExpenses.toLocaleString()}`],
        ["UTILITIES", `KES ${utilityExpenses.toLocaleString()}`],
        ["OTHER EXPENSES", `KES ${otherExpenses.toLocaleString()}`],
        ["NET LANDLORD SHARE", `KES ${netLandlordShare.toLocaleString()}`]
    ];

    autoTable(doc, {
        startY: summaryStartY + 5,
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 80 },
            1: { halign: 'right' }
        },
        didParseCell: (dataCell: any) => {
            if (dataCell.row.index === 5) {
                dataCell.cell.styles.fontStyle = 'bold';
                dataCell.cell.styles.fontSize = 12;
                dataCell.cell.styles.textColor = [0, 100, 0];
            }
        }
    });

    // Save the PDF
    const fileName = `${property.name.replace(/\s+/g, '_')}_Financial_Statement_${data.month.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}
