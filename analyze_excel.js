const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('Tableau_suivi_journalier_camion.xlsx');

let output = '';
output += '=== EXCEL ANALYSIS ===\n\n';
output += 'Sheet Names: ' + workbook.SheetNames.join(', ') + '\n\n';

workbook.SheetNames.forEach(sheetName => {
    output += `\n========== SHEET: ${sheetName} ==========\n\n`;
    const sheet = workbook.Sheets[sheetName];

    // Get the range of the sheet
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    output += `Range: ${sheet['!ref']}\n`;
    output += `Rows: ${range.e.r - range.s.r + 1}, Columns: ${range.e.c - range.s.c + 1}\n`;

    // Get merged cells info
    if (sheet['!merges']) {
        output += `\nMerged cells: ${sheet['!merges'].length}\n`;
    }

    // Convert to JSON to see data
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    output += '\n--- DATA (first 60 rows) ---\n\n';
    data.slice(0, 60).forEach((row, idx) => {
        // Filter out empty cells for readability
        const nonEmptyRow = row.map((cell, i) => cell !== '' ? `[${i}]:${cell}` : null).filter(Boolean);
        if (nonEmptyRow.length > 0) {
            output += `Row ${idx}: ${nonEmptyRow.join(' | ')}\n`;
        }
    });
});

fs.writeFileSync('analysis_output.md', output, 'utf8');
console.log('Analysis saved to analysis_output.md');
