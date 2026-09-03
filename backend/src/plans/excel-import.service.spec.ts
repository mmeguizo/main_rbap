import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelImportService } from './excel-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const FIXTURES_DIR = path.resolve(__dirname, '../../test/fixtures');

function loadFixture(name: string): Promise<Buffer> {
  return fs.promises.readFile(path.join(FIXTURES_DIR, name));
}

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@chmsu.edu.ph',
  role: 'ADMIN',
  office: {
    id: 'off-1',
    name: 'Test Office',
    parentId: null,
    status: 'ACTIVE',
  },
};

function makeWorkbookBuffer(): Promise<never> {
  const workbook = new ExcelJS.Workbook();
  const plansSheet = workbook.addWorksheet('Plans');
  plansSheet.addRow([
    'Plan Ref',
    'Office',
    'Planning Year',
    'Campus',
    'Program/Project/Activity/KRA',
    'Strategic Alignment',
    'Breakthrough Goals',
    'Strategic Objectives',
    'Monitoring Frequency',
    'Reporting Office',
  ]);
  plansSheet.addRow([
    'P1',
    'Main Campus',
    2026,
    'Main Campus',
    'KRA 1',
    'SA 1',
    'BG 1',
    'SO 1',
    'Quarterly',
    'Registrar',
  ]);

  const goalsSheet = workbook.addWorksheet('Goals');
  goalsSheet.addRow([
    'Goal Ref',
    'Plan Ref',
    'Result Level',
    'Target Result',
    'Key Actions',
    'Key Risk',
    'Mitigation Measures',
    'KPI',
    'Target',
    'Responsible Office/Person',
    'Timeline',
    'Fund Source',
    'Budget Requirements',
    'Budget Allocation',
    'Means of Verification',
  ]);
  goalsSheet.addRow([
    'G1',
    'P1',
    'Level 1',
    'Target Result 1',
    'Action 1',
    'Risk 1',
    'Mitigation 1',
    'KPI 1',
    '100',
    'Person 1',
    'Q1',
    'Source 1',
    50000,
    45000,
    'MOV 1',
  ]);

  const objectivesSheet = workbook.addWorksheet('Objectives');
  objectivesSheet.addRow([
    'Objective Ref',
    'Goal Ref',
    'Result Level',
    'Target Result',
    'Key Actions',
    'Key Risk',
    'Mitigation Measures',
    'KPI',
    'Target',
    'Responsible Office/Person',
    'Timeline',
    'Fund Source',
    'Budget Requirements',
    'Budget Allocation',
    'Means of Verification',
  ]);
  objectivesSheet.addRow([
    'O1',
    'G1',
    'Level 1.1',
    'Target Result 1.1',
    'Action 1.1',
    'Risk 1.1',
    'Mitigation 1.1',
    'KPI 1.1',
    '50',
    'Person 1.1',
    'Q1.1',
    'Source 1.1',
    25000,
    20000,
    'MOV 1.1',
  ]);

  return workbook.xlsx.writeBuffer() as never;
}

function makeEmptyPlansBuffer(): Promise<never> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Plans');
  workbook.addWorksheet('Goals');
  workbook.addWorksheet('Objectives');
  return workbook.xlsx.writeBuffer() as never;
}

describe('ExcelImportService', () => {
  let service: ExcelImportService;
  let officesService: jest.Mocked<OfficesService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const txMock = {
      plan: {
        create: jest
          .fn<(args: any) => Promise<any>>()
          .mockResolvedValue({ id: 'plan-id-1' }),
      },
      goal: {
        create: jest
          .fn<(args: any) => Promise<any>>()
          .mockResolvedValue({ id: 'goal-id-1' }),
      },
      objective: {
        create: jest
          .fn<(args: any) => Promise<any>>()
          .mockResolvedValue({ id: 'obj-id-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExcelImportService,
        {
          provide: PrismaService,
          useValue: {
            plan: {
              findUnique: jest
                .fn<(args: any) => Promise<any>>()
                .mockResolvedValue(null),
            },
            $transaction: jest.fn<
              (cb: (tx: any) => Promise<any>) => Promise<any>
            >((cb: any) => cb(txMock)),
          } as unknown as jest.Mocked<PrismaService>,
        },
        {
          provide: OfficesService,
          useValue: {
            findByName: jest
              .fn<(name: string) => Promise<any>>()
              .mockResolvedValue({ id: 'off-1', name: 'Main Campus' }),
          },
        },
      ],
    }).compile();

    service = module.get<ExcelImportService>(ExcelImportService);
    officesService = module.get(OfficesService);
    prisma = module.get(PrismaService);
  });

  describe('detectFormat', () => {
    it('detects legacy-multi-sheet when Plans/Goals/Objectives sheets exist', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Plans');
      workbook.addWorksheet('Goals');
      workbook.addWorksheet('Objectives');
      expect(service.detectFormat(workbook)).toBe('legacy-multi-sheet');
    });

    it('detects chmsu-single-sheet when one sheet has RESULTS-BASED ACTION PLAN in row 1', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A1').value = 'RESULTS-BASED ACTION PLAN';
      expect(service.detectFormat(workbook)).toBe('chmsu-single-sheet');
    });

    it('returns unknown for a workbook matching neither format', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('RandomData');
      expect(service.detectFormat(workbook)).toBe('unknown');
    });

    it('detects chmsu-single-sheet for a workbook with multiple sheets but one RBAP title', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Main');
      sheet.getCell('A1').value = 'RESULTS-BASED ACTION PLAN';
      workbook.addWorksheet('Notes');
      expect(service.detectFormat(workbook)).toBe('chmsu-single-sheet');
    });

    it('returns unknown when sheet name is Sheet1 but no RBAP title', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Sheet1');
      expect(service.detectFormat(workbook)).toBe('unknown');
    });

    it('detects chmsu-single-sheet from PMU fixture', async () => {
      const buf = await loadFixture('PMU-FINAL RESULTS-BASED ACTION PLAN 2026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      expect(service.detectFormat(workbook)).toBe('chmsu-single-sheet');
    });

    it('detects chmsu-single-sheet from QM fixture', async () => {
      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      expect(service.detectFormat(workbook)).toBe('chmsu-single-sheet');
    });

    it('detects chmsu-single-sheet from ICT fixture', async () => {
      const buf = await loadFixture('Final-ICT-RBAP-2026-03022026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      expect(service.detectFormat(workbook)).toBe('chmsu-single-sheet');
    });
  });

  describe('parseChmsuBasicInfo', () => {
    it('parses all 8 fields from a PMU-style Basic Information block', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A1').value = 'RESULTS-BASED ACTION PLAN';
      sheet.getCell('A2').value = 'For FY 2026';
      sheet.getCell('A4').value = 'A. BASIC INFORMATION';
      sheet.getCell('A5').value = 'ITEM';
      sheet.getCell('B5').value = 'ITEM';
      sheet.getCell('C5').value = 'DETAILS';
      sheet.getCell('A6').value = 'Campus';
      sheet.getCell('C6').value = 'Main Campus';
      sheet.getCell('A7').value = 'Office/Unit';
      sheet.getCell('C7').value = 'Planning and Monitoring Unit';
      sheet.getCell('A8').value = 'Program/Project/Activity/KRA';
      sheet.getCell('C8').value = 'Administration';
      sheet.getCell('A9').value = 'Strategic Alignment/Planning Document';
      sheet.getCell('C9').value = 'CHMSU Strategic Plan 2025-2029';
      sheet.getCell('A10').value = 'Breakthrough Goals';
      sheet.getCell('C10').value = 'Goal 1: Excellence';
      sheet.getCell('A11').value = 'Strategic Objectives/Mandate';
      sheet.getCell('C11').value = 'SO1: Quality Education';
      sheet.getCell('A12').value = 'Planning Year';
      sheet.getCell('C12').value = 2026;
      sheet.getCell('A13').value = 'Date Prepared';
      sheet.getCell('C13').value = 'January 13, 2026';

      const info = service.parseChmsuBasicInfo(sheet);
      expect(info.campus).toBe('Main Campus');
      expect(info.officeUnit).toBe('Planning and Monitoring Unit');
      expect(info.programProjectActivityKRA).toBe('Administration');
      expect(info.strategicAlignment).toContain('CHMSU Strategic Plan');
      expect(info.breakthroughGoals).toContain('Goal 1');
      expect(info.strategicObjectives).toContain('SO1');
      expect(info.planningYear).toBe(2026);
      expect(info.datePrepared).toBeInstanceOf(Date);
      expect(info.datePrepared.getFullYear()).toBe(2026);
    });

    it('parses from PMU fixture', async () => {
      const buf = await loadFixture('PMU-FINAL RESULTS-BASED ACTION PLAN 2026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const info = service.parseChmsuBasicInfo(sheet);
      expect(info.campus).toBe('University-wide');
      expect(info.officeUnit).toContain('Project Management Unit');
      expect(info.planningYear).toBe(2026);
      expect(info.datePrepared).toBeInstanceOf(Date);
    });

    it('parses from QM fixture', async () => {
      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const info = service.parseChmsuBasicInfo(sheet);
      expect(info.campus).toBe('Campus-wide');
      expect(info.officeUnit).toContain('Quality Management');
      expect(info.planningYear).toBe(2026);
      expect(info.datePrepared).toBeInstanceOf(Date);
    });

    it('parses from ICT fixture', async () => {
      const buf = await loadFixture('Final-ICT-RBAP-2026-03022026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const info = service.parseChmsuBasicInfo(sheet);
      expect(info.campus).toBe('University-wide');
      expect(info.officeUnit).toContain('Information Technology');
      expect(info.planningYear).toBe(2026);
      expect(info.datePrepared).toBeInstanceOf(Date);
    });

    it('returns empty strings for missing fields', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A1').value = 'RESULTS-BASED ACTION PLAN';
      const info = service.parseChmsuBasicInfo(sheet);
      expect(info.campus).toBe('');
      expect(info.officeUnit).toBe('');
      expect(info.planningYear).toBe(0);
      expect(info.datePrepared).toBeNull();
    });
  });

  describe('parseChmsuMatrixRows', () => {
    it('parses matrix rows from a synthetic CHMSU sheet', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A14').value = 'B. RESULTS-BASED ACTION PLAN MATRIX';
      sheet.getCell('A16').value = 'Result Level';
      sheet.getCell('B16').value = 'Target Result (SMART)';
      sheet.getCell('C16').value = 'Key Actions/Activities';
      sheet.getCell('D16').value = 'Key Risk';
      sheet.getCell('E16').value = 'Mitigation/Control Measures';
      sheet.getCell('F16').value = 'Key Performance Output/Outcome Indicators';
      sheet.getCell('G16').value = 'Target';
      sheet.getCell('H16').value = 'Responsible Office/Person';
      sheet.getCell('I16').value = 'Timeline';
      sheet.getCell('J16').value = 'Fund Source';
      sheet.getCell('K16').value = 'Budget Requirements';
      sheet.getCell('L16').value = 'Budget Allocation';
      sheet.getCell('M16').value = 'Budget Deficit';
      sheet.getCell('N16').value = 'Means of Verification (MOV)';
      // Row 17: first data row
      sheet.getCell('A17').value = 'OUTCOME 1';
      sheet.getCell('B17').value = 'By 2026, achieve target';
      sheet.getCell('C17').value = '• Facilitate evaluation';
      sheet.getCell('D17').value = 'Risk of delay';
      sheet.getCell('E17').value = 'Early planning';
      sheet.getCell('F17').value = 'Number of programs';
      sheet.getCell('G17').value = '1 program';
      sheet.getCell('H17').value = 'OVPAA, QM';
      sheet.getCell('I17').value = '2026';
      sheet.getCell('J17').value = 'GAA';
      sheet.getCell('K17').value = 500000;
      sheet.getCell('L17').value = 450000;
      sheet.getCell('M17').value = 50000;
      sheet.getCell('N17').value = 'Completion report';
      // Row 18: output under same outcome (carried forward)
      sheet.getCell('A18').value = 'OUTPUT 1.1';
      sheet.getCell('B18').value = 'Complete prerequisite docs';
      // Row 19: empty resultLevel should carry forward
      sheet.getCell('A19').value = '';
      sheet.getCell('B19').value = 'Submit documents';

      const rows = service.parseChmsuMatrixRows(sheet);
      expect(rows).toHaveLength(3);
      expect(rows[0].resultLevel).toBe('OUTCOME 1');
      expect(rows[0].targetResult).toBe('By 2026, achieve target');
      expect(rows[0].budgetRequirements).toBe(500000);
      expect(rows[0].budgetAllocation).toBe(450000);
      expect(rows[0].budgetDeficit).toBe(50000);
      expect(rows[0].meansOfVerification).toBe('Completion report');
      expect(rows[1].resultLevel).toBe('OUTPUT 1.1');
      expect(rows[1].targetResult).toBe('Complete prerequisite docs');
      expect(rows[2].resultLevel).toBe('OUTPUT 1.1');
      expect(rows[2].targetResult).toBe('Submit documents');
    });

    it('skips rich text [object Object] rows', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A16').value = 'Result Level';
      sheet.getCell('B16').value = 'Target Result (SMART)';
      // Rich text row
      sheet.getCell('A17').value = '[object Object]';
      sheet.getCell('B17').value = '[object Object]';
      // Real data row
      sheet.getCell('A18').value = 'OUTCOME 1';
      sheet.getCell('B18').value = 'By 2026, achieve';

      const rows = service.parseChmsuMatrixRows(sheet);
      expect(rows).toHaveLength(1);
      expect(rows[0].resultLevel).toBe('OUTCOME 1');
    });

    it('stops at C. MONITORING section', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A16').value = 'Result Level';
      sheet.getCell('B16').value = 'Target Result (SMART)';
      sheet.getCell('A17').value = 'OUTCOME 1';
      sheet.getCell('B17').value = 'Goal 1';
      sheet.getCell('A18').value = 'C. MONITORING';
      sheet.getCell('A19').value = 'Monitoring Frequency';

      const rows = service.parseChmsuMatrixRows(sheet);
      expect(rows).toHaveLength(1);
    });

    it('parses from PMU fixture', async () => {
      const buf = await loadFixture('PMU-FINAL RESULTS-BASED ACTION PLAN 2026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const rows = service.parseChmsuMatrixRows(sheet);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].resultLevel).toBeTruthy();
      expect(rows[0].targetResult).toBeTruthy();
      // PMU has at least "Output 1" and "Output 2" in trimmed 25 rows
      expect(rows.some(r => r.resultLevel.includes('Output'))).toBe(true);
    });

    it('parses from QM fixture', async () => {
      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const rows = service.parseChmsuMatrixRows(sheet);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].resultLevel).toBe('OUTCOME 1');
    });

    it('parses from ICT fixture', async () => {
      const buf = await loadFixture('Final-ICT-RBAP-2026-03022026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const rows = service.parseChmsuMatrixRows(sheet);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].resultLevel).toBe('Outcome A');
      expect(rows.some(r => r.resultLevel.includes('Output'))).toBe(true);
    });
  });

  describe('parseChmsuMonitoringAndSignOff', () => {
    it('parses monitoring and sign-off from synthetic sheet', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      // Monitoring section
      sheet.getCell('A34').value = 'C. MONITORING';
      sheet.getCell('A36').value = 'ITEM';
      sheet.getCell('C36').value = 'DETAILS';
      sheet.getCell('A37').value = 'Monitoring Frequency';
      sheet.getCell('C37').value = 'Quarterly';
      sheet.getCell('A38').value = 'Reporting Office';
      sheet.getCell('C38').value = 'Registrar Office';
      // Sign-off section
      sheet.getCell('B43').value = 'Prepared by:';
      sheet.getCell('E43').value = 'Reviewed by:';
      sheet.getCell('I43').value = 'Approved by:';
      sheet.getCell('B45').value = 'John Doe';
      sheet.getCell('E45').value = 'Jane Smith';
      sheet.getCell('I45').value = 'Dr. Admin';

      const info = service.parseChmsuMonitoringAndSignOff(sheet);
      expect(info.monitoringFrequency).toBe('Quarterly');
      expect(info.reportingOffice).toBe('Registrar Office');
      expect(info.meansOfVerification).toBe('');
      expect(info.preparedBy).toBe('John Doe');
      expect(info.reviewedBy).toBe('Jane Smith');
      expect(info.approvedBy).toBe('Dr. Admin');
    });

    it('handles QM-style merged reviewed-and-approved', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A67').value = 'C. Monitoring';
      sheet.getCell('A69').value = 'Monitoring Frequency';
      sheet.getCell('C69').value = 'Quarterly';
      sheet.getCell('A79').value = 'Reporting Office';
      sheet.getCell('C79').value = 'Quality Management Office';
      sheet.getCell('B83').value = 'Prepared by:';
      sheet.getCell('E83').value = 'Reviewed and approved by:';
      sheet.getCell('B85').value = 'YRIKA MARIE R. DUARAN';
      sheet.getCell('E85').value = 'NORBERTO P. MANGULABNAN';

      const info = service.parseChmsuMonitoringAndSignOff(sheet);
      expect(info.monitoringFrequency).toBe('Quarterly');
      expect(info.reportingOffice).toBe('Quality Management Office');
      expect(info.meansOfVerification).toBe('');
      expect(info.preparedBy).toBe('YRIKA MARIE R. DUARAN');
      expect(info.reviewedBy).toBe('NORBERTO P. MANGULABNAN');
      expect(info.approvedBy).toBe('');
    });

    it('extracts means of verification from QM-style monitoring block', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A67').value = 'C. Monitoring';
      sheet.getCell('A69').value = 'Monitoring Frequency';
      sheet.getCell('C69').value = 'Quarterly';
      sheet.getCell('A70').value = 'Means of Verification';
      sheet.getCell('C70').value = 'ISO 9001:2015 Clause 8.2';
      sheet.getCell('A71').value = 'Means of Verification';
      sheet.getCell('C71').value = 'QMS Manual Section 4.1';
      sheet.getCell('A79').value = 'Reporting Office';
      sheet.getCell('C79').value = 'Quality Management Office';

      const info = service.parseChmsuMonitoringAndSignOff(sheet);
      expect(info.monitoringFrequency).toBe('Quarterly');
      expect(info.meansOfVerification).toContain('ISO 9001:2015 Clause 8.2');
      expect(info.meansOfVerification).toContain('QMS Manual Section 4.1');
      expect(info.reportingOffice).toBe('Quality Management Office');
    });

    it('returns empty strings for missing fields', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.getCell('A1').value = 'RESULTS-BASED ACTION PLAN';

      const info = service.parseChmsuMonitoringAndSignOff(sheet);
      expect(info.monitoringFrequency).toBe('');
      expect(info.reportingOffice).toBe('');
      expect(info.meansOfVerification).toBe('');
      expect(info.preparedBy).toBe('');
      expect(info.reviewedBy).toBe('');
      expect(info.approvedBy).toBe('');
    });

    it('returns empty from trimmed PMU fixture (monitoring section truncated)', async () => {
      const buf = await loadFixture('PMU-FINAL RESULTS-BASED ACTION PLAN 2026.trimmed.xlsx');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const sheet = workbook.getWorksheet('Sheet1');
      const info = service.parseChmsuMonitoringAndSignOff(sheet);
      // Trimmed fixture only has R1-R25, monitoring starts at R34
      expect(info.monitoringFrequency).toBe('');
      expect(info.preparedBy).toBe('');
    });
  });

  describe('parseWorkbook (format branching)', () => {
    it('parses a valid CHMSU single-sheet workbook', async () => {
      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const result = await service.parseWorkbook(buf);

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].planRef).toBeTruthy();
      expect(result.plans[0].planRef).toContain('Quality_Management');
      expect(result.plans[0].planningYear).toBe(2026);
      expect(result.plans[0].campus).toBe('Campus-wide');

      expect(result.goals.length).toBeGreaterThan(0);
      expect(result.goals[0].goalRef).toBeTruthy();
      expect(result.goals[0].planRef).toBe(result.plans[0].planRef);
      expect(result.goals[0].resultLevel).toBeTruthy();
      expect(result.objectives.length).toBeGreaterThan(0);
      expect(result.objectives.every((objective) =>
        result.goals.some((goal) => goal.goalRef === objective.goalRef),
      )).toBe(true);
    });

    it('parses a valid legacy multi-sheet workbook', async () => {
      const buffer = await makeWorkbookBuffer();
      const result = await service.parseWorkbook(buffer);

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].planRef).toBe('P1');
      expect(result.goals).toHaveLength(1);
      expect(result.objectives).toHaveLength(1);
    });

    it('returns empty data for unknown format', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('RandomData');
      const buffer = await workbook.xlsx.writeBuffer();
      const result = await service.parseWorkbook(buffer as never);

      expect(result.plans).toEqual([]);
      expect(result.goals).toEqual([]);
      expect(result.objectives).toEqual([]);
    });
  });

  describe('importExcel with CHMSU format', () => {
    it('imports a CHMSU single-sheet workbook successfully', async () => {
      officesService.findByName.mockResolvedValue({ id: 'off-1', name: 'Quality Management' });
      prisma.plan.findUnique.mockResolvedValue(null);

      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const result = await service.importExcel(buf, mockUser);

      expect(result.plansCreated).toBe(1);
      expect(result.goalsCreated).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
    });

    it('returns error for unknown workbook format', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('RandomData');
      const buffer = await workbook.xlsx.writeBuffer();
      const result = await service.importExcel(buffer as never, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors[0]).toContain('Unknown');
    });

    it('returns error when office from CHMSU workbook not found', async () => {
      officesService.findByName.mockResolvedValue(null);
      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const result = await service.importExcel(buf, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors[0]).toContain('not found');
    });

    it('returns error when plan already exists for office + year', async () => {
      officesService.findByName.mockResolvedValue({ id: 'off-1', name: 'Quality Management' });
      prisma.plan.findUnique.mockResolvedValue({ id: 'existing-plan' });
      const buf = await loadFixture('QM-CY-2026-BASED ACTION PLAN.trimmed.xlsx');
      const result = await service.importExcel(buf, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors[0]).toContain('already exists');
    });
  });

  describe('regression fixtures (AUD-17-02-h)', () => {
    const regressionFixtures = [
      { name: 'regression-pmu-final-results-based-action-plan-2026.xlsx', office: 'Project Management Unit' },
      { name: 'regression-qm-cy-2026-based-action-plan.xlsx', office: 'Quality Management' },
      { name: 'regression-final-ict-rbap-2026-03022026.xlsx', office: 'Information Technology' },
    ];

    for (const fx of regressionFixtures) {
      it(`parses ${fx.name} with correct format, basic info, and non-zero goals`, async () => {
        const buf = await loadFixture(fx.name);
        const result = await service.parseWorkbook(buf);

        expect(result.plans).toHaveLength(1);
        expect(result.plans[0].office).toContain(fx.office);
        expect(result.plans[0].planningYear).toBe(2026);
        expect(result.goals.length).toBeGreaterThan(0);
        expect(result.goals.every(g => g.resultLevel)).toBe(true);
        expect(result.objectives.length).toBeGreaterThan(0);
      });
    }

    it('preserves the ICT Outcome-to-Output hierarchy and matrix fields', async () => {
      const result = await service.parseWorkbook(
        await fs.promises.readFile(
          path.resolve(__dirname, '../../../Final-ICT-RBAP-2026-03022026.xlsx'),
        ),
      );
      const outcome = result.goals.find((goal) => goal.resultLevel === 'Outcome A');

      expect(outcome).toBeDefined();
      const outputs = result.objectives.filter(
        (objective) => objective.goalRef === outcome?.goalRef,
      );
      expect(outputs.map((output) => output.resultLevel)).toEqual([
        'Output A.1',
        'Output A.2',
      ]);
      expect(outputs.every((output) => output.meansOfVerification)).toBe(true);
      expect(outcome?.budgetDeficit).toBeGreaterThan(0);
    });
  });

  describe('parseWorkbook', () => {
    it('parses a valid workbook with all three sheets', async () => {
      const buffer = await makeWorkbookBuffer();
      const result = await service.parseWorkbook(buffer);

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].planRef).toBe('P1');
      expect(result.plans[0].office).toBe('Main Campus');
      expect(result.plans[0].planningYear).toBe(2026);

      expect(result.goals).toHaveLength(1);
      expect(result.goals[0].goalRef).toBe('G1');
      expect(result.goals[0].planRef).toBe('P1');
      expect(result.goals[0].keyPerformanceIndicator).toBe('KPI 1');
      expect(result.goals[0].budgetRequirements).toBe(50000);

      expect(result.objectives).toHaveLength(1);
      expect(result.objectives[0].objectiveRef).toBe('O1');
      expect(result.objectives[0].goalRef).toBe('G1');
      expect(result.objectives[0].budgetAllocation).toBe(20000);
    });

    it('returns empty arrays for missing sheets', async () => {
      const buffer = await makeEmptyPlansBuffer();
      const result = await service.parseWorkbook(buffer);

      expect(result.plans).toEqual([]);
      expect(result.goals).toEqual([]);
      expect(result.objectives).toEqual([]);
    });

    it('skips empty rows', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Plans');
      sheet.addRow([
        'Plan Ref',
        'Office',
        'Planning Year',
        'Campus',
        'Program/Project/Activity/KRA',
        'Strategic Alignment',
        'Breakthrough Goals',
        'Strategic Objectives',
        'Monitoring Frequency',
        'Reporting Office',
      ]);
      sheet.addRow([
        'P1',
        'Office 1',
        2026,
        'Campus 1',
        'KRA 1',
        'SA 1',
        'BG 1',
        'SO 1',
        'Quarterly',
        'RO 1',
      ]);
      sheet.addRow([]);
      sheet.addRow([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await service.parseWorkbook(buffer as never);

      expect(result.plans).toHaveLength(1);
    });

    it('uses default monitoring frequency when empty', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Plans');
      sheet.addRow([
        'Plan Ref',
        'Office',
        'Planning Year',
        'Campus',
        'Program/Project/Activity/KRA',
        'Strategic Alignment',
        'Breakthrough Goals',
        'Strategic Objectives',
        'Monitoring Frequency',
        'Reporting Office',
      ]);
      sheet.addRow([
        'P1',
        'Office 1',
        2026,
        'Campus 1',
        'KRA 1',
        'SA 1',
        'BG 1',
        'SO 1',
        '',
        'RO 1',
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await service.parseWorkbook(buffer as never);

      expect(result.plans[0].monitoringFrequency).toBe('Quarterly');
    });
  });

  describe('importExcel', () => {
    it('creates plans, goals, and objectives from a valid workbook', async () => {
      const buffer = await makeWorkbookBuffer();
      const result = await service.importExcel(buffer, mockUser);

      expect(result.plansCreated).toBe(1);
      expect(result.goalsCreated).toBe(1);
      expect(result.objectivesCreated).toBe(1);
      expect(result.errors).toEqual([]);
      expect(officesService.findByName).toHaveBeenCalledWith('Main Campus');
      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: {
          officeId_planningYear: { officeId: 'off-1', planningYear: 2026 },
        },
        select: { id: true },
      });
    });

    it('returns error when no plan rows found', async () => {
      const buffer = await makeEmptyPlansBuffer();
      const result = await service.importExcel(buffer, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors).toContain('No plan rows found in the spreadsheet');
    });

    it('returns error when office is not found', async () => {
      officesService.findByName.mockResolvedValue(null);
      const buffer = await makeWorkbookBuffer();
      const result = await service.importExcel(buffer, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors[0]).toContain('not found');
    });

    it('returns error when plan already exists for office + year', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'existing-plan' });
      const buffer = await makeWorkbookBuffer();
      const result = await service.importExcel(buffer, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors[0]).toContain('already exists');
    });

    it('returns error when plan ref is missing', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Plans');
      sheet.addRow([
        'Plan Ref',
        'Office',
        'Planning Year',
        'Campus',
        'Program/Project/Activity/KRA',
        'Strategic Alignment',
        'Breakthrough Goals',
        'Strategic Objectives',
        'Monitoring Frequency',
        'Reporting Office',
      ]);
      sheet.addRow([
        '',
        'Main Campus',
        2026,
        'Campus',
        'KRA',
        'SA',
        'BG',
        'SO',
        'Quarterly',
        '',
      ]);
      workbook.addWorksheet('Goals');
      workbook.addWorksheet('Objectives');
      const buffer = await workbook.xlsx.writeBuffer();
      const result = await service.importExcel(buffer as never, mockUser);

      expect(result.plansCreated).toBe(0);
      expect(result.errors[0]).toContain('missing Plan Ref');
    });
  });
});
