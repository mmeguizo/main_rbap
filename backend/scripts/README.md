Scripts for importing data from Excel into the database.

Available scripts:
- import-excel.ts: Scaffold to read Excel workbooks and print sheet headers and sample rows.

Usage:
  # from backend/ directory
  npm install xlsx
  npx ts-node scripts/import-excel.ts --file "../PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx" --dry-run

Notes:
- The scaffold prints sheet names, columns, and sample rows. Implement transformation logic to map Excel columns to Prisma models before seeding.
- Ensure you run `npx prisma generate` and have DATABASE_URL set before writing to DB.
