const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '../../');
const outDir = path.resolve(__dirname, '../test/fixtures');

const files = [
  { name: 'PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx', rows: 46 },
  { name: 'QM-CY-2026-BASED ACTION PLAN.xlsx', rows: 45 },
  { name: 'Final-ICT-RBAP-2026-03022026.xlsx', rows: 48 },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(root, f.name));
    const ws = wb.getWorksheet('Sheet1');

    const trimmed = new ExcelJS.Workbook();
    const outSheet = trimmed.addWorksheet('Sheet1');

    const maxCols = 12;
    for (let r = 1; r <= f.rows; r++) {
      const inRow = ws.getRow(r);
      const outRow = outSheet.getRow(r);
      for (let c = 1; c <= Math.min(inRow.cellCount, maxCols); c++) {
        outRow.getCell(c).value = inRow.getCell(c).value;
      }
      outRow.commit();
    }

    const buf = await trimmed.xlsx.writeBuffer();
    const outName = `regression-${f.name.replace('.xlsx', '').toLowerCase().replace(/[^a-z0-9]/g, '-')}.xlsx`;
    fs.writeFileSync(path.join(outDir, outName), Buffer.from(buf));
    console.log(`Created ${outName} (${f.rows} rows, up to ${maxCols} cols)`);
  }
}

main().catch(console.error);
