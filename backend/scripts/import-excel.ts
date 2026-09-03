/*
Simple Excel import scaffold for RBAP IDM.
Usage:
  npx ts-node scripts/import-excel.ts --file "../PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx" --dry-run

Notes:
- Requires 'xlsx' and Prisma client. Install with:
  npm install xlsx
  npm install -D ts-node typescript @types/node
- This script is a scaffold: it reads sheets and prints headers and sample rows.
- Implement transformations to Prisma models before seeding.
*/

import fs from 'fs';
import path from 'path';
import process from 'process';

// lazy require to avoid hard dependency when script is not used
let xlsx: any;
try {
  xlsx = require('xlsx');
} catch (e) {
  console.error("Missing dependency 'xlsx'. Install with: npm install xlsx");
  process.exit(1);
}

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('file', { type: 'string', demandOption: true })
  .option('dry-run', { type: 'boolean', default: true })
  .help()
  .argv;

const filePath = path.resolve(process.cwd(), argv.file as string);
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

console.log('Reading workbook:', filePath);
const wb = xlsx.readFile(filePath, { cellDates: true });
console.log('Sheets:', wb.SheetNames.join(', '));

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
  console.log(`\n--- Sheet: ${name} ---`);
  if (json.length === 0) {
    console.log('Empty sheet');
    continue;
  }
  const headers = Object.keys(json[0]);
  console.log('Columns:', headers.join(', '));
  console.log('Sample rows (first 3):');
  console.log(JSON.stringify(json.slice(0, 3), null, 2));
  if (!argv['dry-run']) {
    // TODO: transform rows to Prisma models and write using Prisma client
    console.log('[DRY RUN disabled] Implement transformations to write to DB.');
  }
}

console.log('\nDone.');
