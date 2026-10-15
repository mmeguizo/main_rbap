import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import * as ExcelJS from 'exceljs';
import { QueryExcelExportDto } from './dto/query-excel-export.dto';

const documentPlanSelect = {
  id: true,
  planningYear: true,
  campus: true,
  programProjectActivityKRA: true,
  strategicAlignment: true,
  breakthroughGoals: true,
  strategicObjectives: true,
  datePrepared: true,
  monitoringFrequency: true,
  reportingOffice: true,
  office: { select: { id: true, name: true } },
  monitoring: {
    select: {
      frequency: true,
      reportingOffice: true,
      preparedBy: true,
      reviewedBy: true,
      approvedBy: true,
    },
  },
  goals: {
    orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      code: true,
      resultLevel: true,
      targetResult: true,
      keyActions: true,
      keyRisk: true,
      mitigationMeasures: true,
      keyPerformanceIndicator: true,
      target: true,
      responsibleOfficePerson: true,
      timeline: true,
      fundSource: true,
      budgetRequirements: true,
      budgetAllocation: true,
      budgetDeficit: true,
      meansOfVerification: true,
      objectives: {
        orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        select: {
          code: true,
          resultLevel: true,
          targetResult: true,
          keyActions: true,
          keyRisk: true,
          mitigationMeasures: true,
          keyPerformanceIndicator: true,
          target: true,
          responsibleOfficePerson: true,
          timeline: true,
          fundSource: true,
          budgetRequirements: true,
          budgetAllocation: true,
          budgetDeficit: true,
          meansOfVerification: true,
        },
      },
    },
  },
};

interface PlanForExport {
  id: string;
  planningYear: number;
  campus: string;
  programProjectActivityKRA: string;
  strategicAlignment: string;
  breakthroughGoals: string;
  strategicObjectives: string;
  datePrepared: Date | null;
  monitoringFrequency: string;
  reportingOffice: string | null;
  office: { id: string; name: string };
  monitoring: {
    frequency: string;
    reportingOffice: string | null;
    preparedBy: string | null;
    reviewedBy: string | null;
    approvedBy: string | null;
  } | null;
  goals: Array<{
    code: string | null;
    resultLevel: string;
    targetResult: string;
    keyActions: string;
    keyRisk: string;
    mitigationMeasures: string;
    keyPerformanceIndicator: string;
    target: string;
    responsibleOfficePerson: string;
    timeline: string;
    fundSource: string | null;
    budgetRequirements: any;
    budgetAllocation: any;
    budgetDeficit: any;
    meansOfVerification: string;
    objectives: Array<{
      code: string | null;
      resultLevel: string;
      targetResult: string;
      keyActions: string;
      keyRisk: string;
      mitigationMeasures: string;
      keyPerformanceIndicator: string;
      target: string;
      responsibleOfficePerson: string;
      timeline: string;
      fundSource: string | null;
      budgetRequirements: any;
      budgetAllocation: any;
      budgetDeficit: any;
      meansOfVerification: string;
    }>;
  }>;
}

@Injectable()
export class ExcelExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
  ) {}

  async exportExcel(
    user: AuthenticatedUser,
    filters: QueryExcelExportDto,
  ): Promise<Buffer> {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('No plans found for your scope.');
    }

    if (filters.officeId && !officeIds.includes(filters.officeId)) {
      throw new NotFoundException('You cannot export plans for that office.');
    }

    const where: Record<string, unknown> = {
      officeId: { in: filters.officeId ? [filters.officeId] : officeIds },
      ...(filters.planningYear !== undefined && {
        planningYear: filters.planningYear,
      }),
      ...(filters.status !== undefined && { status: filters.status }),
    };

    if (filters.planIds) {
      const ids = filters.planIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    }

    if (filters.search) {
      where.OR = [
        {
          programProjectActivityKRA: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          strategicAlignment: { contains: filters.search, mode: 'insensitive' },
        },
      ];
    }

    const plans = (await this.prisma.plan.findMany({
      where,
      orderBy: [{ planningYear: 'desc' }, { createdAt: 'desc' }],
      select: documentPlanSelect,
    })) as unknown as PlanForExport[];

    if (plans.length === 0) {
      throw new NotFoundException('No plans found for your scope.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CHMSU - RBAP IDM';
    workbook.created = new Date();

    const usedNames = new Set<string>();

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      let baseName = `${plan.office?.name || 'Plan'} ${plan.planningYear}`
        .replace(/[\*\?:\\\/\[\]]/g, ' ')
        .trim()
        .slice(0, 25);
      if (!baseName) baseName = `Plan ${i + 1}`;

      let sheetName = baseName;
      let counter = 1;
      while (usedNames.has(sheetName.toLowerCase())) {
        sheetName = `${baseName.slice(0, 22)} (${counter++})`;
      }
      usedNames.add(sheetName.toLowerCase());

      const sheet = workbook.addWorksheet(sheetName);
      this.populatePlanSheet(sheet, plan);
    }

    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw as unknown as ArrayBuffer);
  }

  async exportDocument(planId: string, user: AuthenticatedUser): Promise<Buffer> {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);
    const plan = (await this.prisma.plan.findFirst({
      where: { id: planId, officeId: { in: officeIds } },
      select: documentPlanSelect,
    })) as unknown as PlanForExport;
    if (!plan) throw new NotFoundException('Plan not found.');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CHMSU - RBAP IDM';
    const sheet = workbook.addWorksheet('Sheet1');
    this.populatePlanSheet(sheet, plan);

    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw as unknown as ArrayBuffer);
  }

  private populatePlanSheet(sheet: ExcelJS.Worksheet, plan: PlanForExport): void {
    // 14 columns matching ict_sample.xlsx exactly
    sheet.columns = [
      { width: 18.86 }, // A: Result Level
      { width: 24.71 }, // B: Target Result (SMART)
      { width: 23.0 },  // C: Key Actions/Activities
      { width: 24.71 }, // D: Key Risk
      { width: 24.14 }, // E: Mitigation/Control Measures
      { width: 25.86 }, // F: Key Performance Output/Outcome Indicators
      { width: 22.29 }, // G: Target
      { width: 18.0 },  // H: Responsible Office/Person
      { width: 21.43 }, // I: Timeline
      { width: 14.0 },  // J: Fund Source
      { width: 15.71 }, // K: Budget Requirements
      { width: 13.43 }, // L: Budget Allocation
      { width: 15.0 },  // M: Budget Deficit
      { width: 17.14 }, // N: Means of Verification (MOV)
    ];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerSageFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFD9' },
    };

    // Row 1: Title
    const r1 = sheet.addRow(['RESULTS-BASED ACTION PLAN']);
    r1.font = { bold: true, size: 14, name: 'Calibri' };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r1.number}:N${r1.number}`);

    // Row 2: Subtitle
    const r2 = sheet.addRow([`For FY ${plan.planningYear}`]);
    r2.font = { bold: true, size: 14, name: 'Calibri' };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r2.number}:N${r2.number}`);

    // Row 3: Empty
    sheet.addRow([]);

    // Row 4: Section A Title
    const r4 = sheet.addRow([' A.\tBASIC INFORMATION']);
    r4.font = { bold: true, size: 11, name: 'Calibri' };

    // Row 5: Section A Header
    const r5 = sheet.addRow(['ITEM', '', 'DETAILS']);
    r5.font = { bold: true, size: 11, name: 'Calibri' };
    sheet.mergeCells(`A${r5.number}:B${r5.number}`);
    sheet.mergeCells(`C${r5.number}:N${r5.number}`);
    for (let c = 1; c <= 14; c++) {
      const cell = r5.getCell(c);
      cell.fill = headerSageFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Section A Items
    const basicInfoItems = [
      ['Campus', plan.campus || ''],
      ['Office/Unit', plan.office?.name || ''],
      ['Program/Project/Activity/KRA', plan.programProjectActivityKRA || ''],
      ['Strategic Alignment/Planning Document', plan.strategicAlignment || ''],
      ['Breakthrough Goals', plan.breakthroughGoals || ''],
      ['Strategic Objectives', plan.strategicObjectives || ''],
      ['Planning Year', plan.planningYear],
      [
        'Date Prepared',
        plan.datePrepared
          ? plan.datePrepared instanceof Date
            ? plan.datePrepared.toISOString().split('T')[0]
            : String(plan.datePrepared).split('T')[0]
          : '',
      ],
    ];

    basicInfoItems.forEach(([label, detail]) => {
      const row = sheet.addRow([label, '', detail]);
      row.font = { size: 11, name: 'Calibri' };
      sheet.mergeCells(`A${row.number}:B${row.number}`);
      sheet.mergeCells(`C${row.number}:N${row.number}`);
      for (let c = 1; c <= 14; c++) {
        const cell = row.getCell(c);
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });

    // Row 14: Empty
    sheet.addRow([]);

    // Row 15: Section B Title
    const r15 = sheet.addRow(['B. RESULTS-BASED ACTION PLAN MATRIX']);
    r15.font = { bold: true, size: 11, name: 'Calibri' };

    // Row 16: Section B Header (14 columns)
    const matrixHeaders = [
      'Result Level',
      'Target Result (SMART)',
      'Key Actions/Activities',
      'Key Risk',
      'Mitigation/Control Measures',
      'Key Performance Output/Outcome Indicators',
      'Target',
      'Responsible Office/Person',
      'Timeline',
      'Fund Source',
      'Budget Requirements',
      'Budget Allocation',
      'Budget Deficit',
      'Means of Verification (MOV)',
    ];
    const r16 = sheet.addRow(matrixHeaders);
    r16.height = 31.5;
    r16.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF000000' } };
    for (let c = 1; c <= 14; c++) {
      const cell = r16.getCell(c);
      cell.fill = headerSageFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    // Results Matrix Rows
    (plan.goals || []).forEach((goal, gIndex) => {
      const letter = String.fromCharCode(65 + (gIndex % 26));
      const outcomeCode = goal.resultLevel || goal.code || `Outcome ${letter}`;
      const gReq = Number(goal.budgetRequirements) || 0;
      const gAlloc = Number(goal.budgetAllocation) || 0;

      const gRow = sheet.addRow([
        outcomeCode,
        goal.targetResult,
        goal.keyActions,
        goal.keyRisk,
        goal.mitigationMeasures,
        goal.keyPerformanceIndicator,
        goal.target,
        goal.responsibleOfficePerson,
        goal.timeline,
        goal.fundSource ?? '',
        gReq,
        gAlloc,
        '', // Deficit formula will be set below
        goal.meansOfVerification,
      ]);

      const gRowNum = gRow.number;
      gRow.getCell(13).value = {
        formula: `K${gRowNum}-L${gRowNum}`,
        result: gReq - gAlloc,
      };

      for (let c = 1; c <= 14; c++) {
        const cell = gRow.getCell(c);
        cell.font = { size: 11, name: 'Calibri' };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'top', wrapText: true };
        if (c >= 11 && c <= 13) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'top', horizontal: 'right' };
        }
      }

      // Child objectives (Outputs)
      (goal.objectives || []).forEach((obj, oIndex) => {
        const outputCode =
          obj.resultLevel || obj.code || `Output ${letter}.${oIndex + 1}`;
        const oReq = Number(obj.budgetRequirements) || 0;
        const oAlloc = Number(obj.budgetAllocation) || 0;

        const oRow = sheet.addRow([
          outputCode,
          obj.targetResult,
          obj.keyActions,
          obj.keyRisk,
          obj.mitigationMeasures,
          obj.keyPerformanceIndicator,
          obj.target,
          obj.responsibleOfficePerson,
          obj.timeline,
          obj.fundSource ?? '',
          oReq,
          oAlloc,
          '',
          obj.meansOfVerification,
        ]);

        const oRowNum = oRow.number;
        oRow.getCell(13).value = {
          formula: `K${oRowNum}-L${oRowNum}`,
          result: oReq - oAlloc,
        };

        for (let c = 1; c <= 14; c++) {
          const cell = oRow.getCell(c);
          cell.font = { size: 11, name: 'Calibri' };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'top', wrapText: true };
          if (c >= 11 && c <= 13) {
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'top', horizontal: 'right' };
          }
        }
      });
    });

    // Empty buffer rows before monitoring
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);

    // Section C: Monitoring
    const rMonTitle = sheet.addRow(['C. MONITORING']);
    rMonTitle.font = { bold: true, size: 11, name: 'Calibri' };

    sheet.addRow([]);

    const rMonHeader = sheet.addRow(['ITEM', '', 'DETAILS']);
    rMonHeader.font = { bold: true, size: 11, name: 'Calibri' };
    sheet.mergeCells(`A${rMonHeader.number}:B${rMonHeader.number}`);
    sheet.mergeCells(`C${rMonHeader.number}:N${rMonHeader.number}`);
    for (let c = 1; c <= 14; c++) {
      const cell = rMonHeader.getCell(c);
      cell.fill = headerSageFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    const monitoring = plan.monitoring;
    const monitoringItems = [
      ['Monitoring Frequency', monitoring?.frequency ?? plan.monitoringFrequency ?? 'Quarterly'],
      ['Reporting Office', monitoring?.reportingOffice ?? plan.reportingOffice ?? ''],
    ];

    monitoringItems.forEach(([label, detail]) => {
      const row = sheet.addRow([label, '', detail]);
      row.font = { size: 11, name: 'Calibri' };
      sheet.mergeCells(`A${row.number}:B${row.number}`);
      sheet.mergeCells(`C${row.number}:N${row.number}`);
      for (let c = 1; c <= 14; c++) {
        const cell = row.getCell(c);
        cell.border = thinBorder;
        cell.alignment = { vertical: 'top', wrapText: true };
      }
    });

    // 4 empty rows before signatures
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);

    // Signatures block matching ict_sample.xlsx (B43, E43, I43)
    const sigLabelRow = sheet.addRow(['', 'Prepared by:\t', '', '', 'Reviewed by:', '', '', '', 'Approved by:']);
    sigLabelRow.font = { bold: true, size: 11, name: 'Calibri' };

    sheet.addRow([]); // Blank line for signature

    const sigNameRow = sheet.addRow([
      '',
      monitoring?.preparedBy ?? '',
      '',
      '',
      monitoring?.reviewedBy ?? ' ',
      '',
      '',
      '',
      monitoring?.approvedBy ?? '',
    ]);
    sigNameRow.font = { bold: true, size: 11, name: 'Calibri' };

    const sigTitleRow = sheet.addRow([
      '',
      'Division/Unit Head/Dean',
      '',
      '',
      'Vice President',
      '',
      '',
      '',
      'SUC III President',
    ]);
    sigTitleRow.font = { size: 10, name: 'Calibri' };
  }
}
