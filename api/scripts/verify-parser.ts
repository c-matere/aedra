import * as fs from 'fs';
import * as path from 'path';

// Simplified version of the new parser logic
function parseCSV(content: string) {
    const rows = content.split('\n').map(line => {
        const cols = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                cols.push(current.trim());
                current = '';
            } else current += char;
        }
        cols.push(current.trim());
        return cols;
    });

    const receipts: any[] = [];
    const invoices: any[] = [];

    rows.forEach(function (cols) {
        if (cols.length < 5) return;

        const dateIdx = cols.findIndex(c => /^\d{1,2}-[A-Za-z]{3,9}-\d{4}$/.test(c.trim()));
        if (dateIdx === -1) return;
        const date = cols[dateIdx].trim();

        const codeIdx = cols.findIndex((c, i) => i > dateIdx && /INV|RCT|BILL|PAY|SI\d+|SJ\d+|RCT/.test(c.toUpperCase()));
        if (codeIdx === -1) return;
        const code = cols[codeIdx].trim();

        const descIdx = cols.findIndex((c, i) => i > codeIdx && c.trim().length > 1);
        const desc = descIdx !== -1 ? cols[descIdx].trim() : '';

        const values = cols.map((c, i) => ({ val: c.trim(), idx: i }))
            .filter(o => o.idx > codeIdx && /^\(?[\d,.]+\)?$/.test(o.val) && o.val.match(/\d/))
            .map(o => ({
                amount: parseFloat(o.val.replace(/[(),]/g, '')) || 0,
                idx: o.idx,
                raw: o.val
            }))
            .filter(v => v.amount !== 0);

        if (values.length === 0) return;

        const amount = values[0].amount;

        if (code.toUpperCase().includes('INV') || code.toUpperCase().includes('BILL')) {
            invoices.push({ code, date, amount, description: desc });
        } else if (code.toUpperCase().includes('RCT') || code.toUpperCase().includes('PAY')) {
            receipts.push({ code, date, amount, description: desc });
        }
    });

    return { receipts, invoices };
}

const csvPath = '/home/chris/aedra/api/scratch_reports/TenantAccountingStatement.csv';
if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const result = parseCSV(content);

    console.log('--- Parser Verification Results ---');
    console.log(`Total Invoices Found: ${result.invoices.length}`);
    console.log(`Total Receipts Found: ${result.receipts.length}`);
    
    console.log('\n--- Sample Invoices ---');
    result.invoices.slice(0, 3).forEach(inv => console.log(`${inv.date} | ${inv.code} | ${inv.amount} | ${inv.description}`));
    
    console.log('\n--- Sample Receipts ---');
    result.receipts.slice(0, 3).forEach(rect => console.log(`${rect.date} | ${rect.code} | ${rect.amount} | ${rect.description}`));

    if (result.receipts.length > 0) {
        console.log('\nSUCCESS: Payments were correctly identified!');
    } else {
        console.log('\nFAILURE: No payments found.');
    }
} else {
    console.log('Sample CSV not found at', csvPath);
}
