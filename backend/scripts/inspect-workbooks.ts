import * as ExcelJS from 'exceljs';
import * as path from 'path';

const files = [
  'PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx',
  'Final-ICT-RBAP-2026-03022026.xlsx',
  'QM-CY-2026-BASED ACTION PLAN.xlsx',
];

async function main() {
  for (const f of files) {
    console.log(`\n===== ${f} =====`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.resolve(__dirname, '../../', f));
    for (const ws of wb.worksheets) {
      console.log(`Sheet: "${ws.name}" (rows: ${ws.rowCount}, cols: ${ws.columnCount})`);
      const limit = Math.min(ws.rowCount, 40);
      for (let r = 1; r <= limit; r++) {
        const row = ws.getRow(r);
        const vals: string[] = [];
        for (let c = 1; c <= 12; c++) {
          const cell = row.getCell(c);
          const v = cell.value;
          if (v !== undefined && v !== null && v !== '') {
            vals.push(`[${c}]${String(v).substring(0, 80)}`);
          } else {
            vals.push('');
          }
        }
        const line = vals.join(' | ');
        if (line.replace(/\s*\|\s*/g, '').trim()) {
          console.log(`  R${r}: ${line}`);
        }
      }
    }
  }
}

main().catch(console.error);
