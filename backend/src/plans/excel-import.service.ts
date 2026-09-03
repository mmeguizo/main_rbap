import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import * as ExcelJS from 'exceljs';

// Parsed row types
export interface ParsedPlanRow {
  planRef: string;
  office: string;
  planningYear: number;
  campus: string;
  programProjectActivityKRA: string;
  strategicAlignment: string;
  breakthroughGoals: string;
  strategicObjectives: string;
  monitoringFrequency: string;
  reportingOffice: string;
  monitoring?: {
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
  };
}

export interface ParsedGoalRow {
  goalRef: string;
  planRef: string;
  resultLevel: string;
  targetResult: string;
  keyActions: string;
  keyRisk: string;
  mitigationMeasures: string;
  keyPerformanceIndicator: string;
  target: string;
  responsibleOfficePerson: string;
  timeline: string;
  fundSource: string;
  budgetRequirements: number;
  budgetAllocation: number;
  budgetDeficit?: number;
  meansOfVerification: string;
  code?: string;
  displayOrder?: number;
}

export interface ParsedObjectiveRow {
  objectiveRef: string;
  goalRef: string;
  resultLevel: string;
  targetResult: string;
  keyActions: string;
  keyRisk: string;
  mitigationMeasures: string;
  keyPerformanceIndicator: string;
  target: string;
  responsibleOfficePerson: string;
  timeline: string;
  fundSource: string;
  budgetRequirements: number;
  budgetAllocation: number;
  budgetDeficit?: number;
  meansOfVerification: string;
  code?: string;
  displayOrder?: number;
}

export interface ParsedImportData {
  plans: ParsedPlanRow[];
  goals: ParsedGoalRow[];
  objectives: ParsedObjectiveRow[];
}

export interface ImportResult {
  plansCreated: number;
  goalsCreated: number;
  objectivesCreated: number;
  errors: string[];
}

const PLANS_COLUMNS = [
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
];

const GOALS_COLUMNS = [
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
];

const OBJECTIVES_COLUMNS = [
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
];

function extractResultCode(resultLevel: string): string | undefined {
  const match = resultLevel.match(
    /\b(?:outcome|output)\s+([a-z0-9]+(?:\.[a-z0-9]+)*)\b/i,
  );
  return match?.[1];
}

export type WorkbookFormat = 'legacy-multi-sheet' | 'chmsu-single-sheet' | 'unknown';

export interface ChmsuBasicInfo {
  campus: string;
  officeUnit: string;
  programProjectActivityKRA: string;
  strategicAlignment: string;
  breakthroughGoals: string;
  strategicObjectives: string;
  planningYear: number;
  datePrepared: Date | null;
}

const BASIC_INFO_LABELS: [string, keyof ChmsuBasicInfo][] = [
  ['Campus', 'campus'],
  ['Office/Unit', 'officeUnit'],
  ['Program/Project/Activity/KRA', 'programProjectActivityKRA'],
  ['Strategic Alignment', 'strategicAlignment'],
  ['Breakthrough Goals', 'breakthroughGoals'],
  ['Strategic Objectives', 'strategicObjectives'],
  ['Planning Year', 'planningYear'],
  ['Date Prepared', 'datePrepared'],
];

@Injectable()
export class ExcelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
  ) {}

  private cellText(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
      const cell = value as {
        richText?: Array<{ text?: string }>;
        result?: unknown;
        text?: string;
      };
      if (cell.richText) return cell.richText.map((part) => part.text ?? '').join('');
      if (cell.result !== undefined) return this.cellText(cell.result);
      if (cell.text !== undefined) return cell.text;
    }
    return String(value).trim();
  }

  parseChmsuBasicInfo(sheet: ExcelJS.Worksheet): ChmsuBasicInfo {
    const result: ChmsuBasicInfo = {
      campus: '',
      officeUnit: '',
      programProjectActivityKRA: '',
      strategicAlignment: '',
      breakthroughGoals: '',
      strategicObjectives: '',
      planningYear: 0,
      datePrepared: null,
    };

    for (let r = 4; r <= 20; r++) {
      const labelCell = sheet.getRow(r).getCell(1).value;
      if (labelCell === undefined || labelCell === null) continue;
      const label = String(labelCell).trim().toLowerCase();

      for (const [keyword, field] of BASIC_INFO_LABELS) {
        if (!label.includes(keyword.toLowerCase())) continue;

        const row = sheet.getRow(r);
        let rawValue: unknown;
        for (let c = 3; c <= row.cellCount; c++) {
          const v = row.getCell(c).value;
          if (v !== undefined && v !== null && v !== '') {
            rawValue = v;
            break;
          }
        }

        if (rawValue === undefined) break;

        if (field === 'planningYear') {
          const n = Number(rawValue);
          result.planningYear = isNaN(n) ? 0 : n;
        } else if (field === 'datePrepared') {
          if (rawValue instanceof Date) {
            result.datePrepared = rawValue;
          } else {
            const parsed = new Date(String(rawValue).trim());
            result.datePrepared = isNaN(parsed.getTime()) ? null : parsed;
          }
        } else {
          (result as any)[field] = String(rawValue).trim();
        }

        break;
      }
    }

    return result;
  }

  parseChmsuMatrixRows(sheet: ExcelJS.Worksheet): ParsedGoalRow[] {
    const rows: ParsedGoalRow[] = [];
    let headerRow = -1;
    let lastResultLevel = '';

    for (let r = 1; r <= sheet.rowCount; r++) {
      const cell = sheet.getRow(r).getCell(1).value;
      if (cell && String(cell).includes('Result Level')) {
        headerRow = r;
        break;
      }
    }
    if (headerRow === -1) return rows;

    for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const c1 = row.getCell(1).value;

      // Stop at monitoring section
      if (c1 && String(c1).match(/^C\.\s*MONITORING/i)) break;

      // Skip rich text artifacts
      if (c1 && String(c1) === '[object Object]') continue;

      // The CHMSU worksheet has 14 matrix columns, ending with MOV.
      const vals: (string | undefined)[] = [];
      for (let c = 1; c <= 14; c++) {
        const v = row.getCell(c).value;
        const text = this.cellText(v);
        vals.push(text || undefined);
      }

      // Skip empty rows (no data at all)
      if (vals.every(v => !v || v === '')) continue;

      // Skip rows with data only in C1 (section header artifacts, not real matrix rows)
      const hasDataBeyondC1 = vals.slice(1).some(v => v && v !== '');
      if (!hasDataBeyondC1) continue;

      // Carry forward result level from non-empty C1
      if (vals[0] && vals[0] !== '') {
        lastResultLevel = vals[0];
      }

      const get = (i: number): string => (vals[i] !== undefined ? vals[i] : '');
      const getNum = (i: number): number => {
        const s = vals[i];
        if (!s || s === '') return 0;
        const n = Number(s.replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? 0 : n;
      };

      rows.push({
        goalRef: '',
        planRef: '',
        resultLevel: lastResultLevel,
        code: extractResultCode(lastResultLevel),
        displayOrder: rows.length,
        targetResult: get(1),
        keyActions: get(2),
        keyRisk: get(3),
        mitigationMeasures: get(4),
        keyPerformanceIndicator: get(5),
        target: get(6),
        responsibleOfficePerson: get(7),
        timeline: get(8),
        fundSource: get(9),
        budgetRequirements: getNum(10),
        budgetAllocation: getNum(11),
        budgetDeficit: getNum(12),
        meansOfVerification: get(13),
      });
    }

    return rows;
  }

  parseChmsuMonitoringAndSignOff(sheet: ExcelJS.Worksheet): {
    monitoringFrequency: string;
    reportingOffice: string;
    meansOfVerification: string;
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
  } {
    const result = {
      monitoringFrequency: '',
      reportingOffice: '',
      meansOfVerification: '',
      preparedBy: '',
      reviewedBy: '',
      approvedBy: '',
    };

    // Find monitoring section
    let monitoringStart = -1;
    for (let r = 1; r <= sheet.rowCount; r++) {
      const c1 = sheet.getRow(r).getCell(1).value;
      if (c1 && String(c1).match(/^C\.\s*MONITORING/i)) {
        monitoringStart = r;
        break;
      }
    }

    if (monitoringStart > 0) {
      for (let r = monitoringStart; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const c1 = row.getCell(1).value;
        const c1s = c1 ? String(c1).toLowerCase().trim() : '';
        const c3 = row.getCell(3).value;

        if (c1s.includes('monitoring frequency')) {
          result.monitoringFrequency = c3 ? String(c3).trim() : '';
        } else if (c1s.includes('means of verification')) {
          const mov = c3 ? String(c3).trim() : '';
          if (mov) {
            result.meansOfVerification = result.meansOfVerification
              ? `${result.meansOfVerification}\n${mov}`
              : mov;
          }
        } else if (c1s.includes('reporting office')) {
          result.reportingOffice = c3 ? String(c3).trim() : '';
        }
      }
    }

    // Find sign-off: search all rows for labels, then scan forward for non-empty name
    const roleTitles = ['division/unit head/dean', 'vice president', 'suc iii president'];
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= 9; c++) {
        const v = row.getCell(c).value;
        if (!v) continue;
        const s = String(v).toLowerCase().trim();

        let targetField: 'preparedBy' | 'reviewedBy' | 'approvedBy' | null = null;
        if (s.startsWith('prepared by')) targetField = 'preparedBy';
        else if (s.startsWith('reviewed')) targetField = 'reviewedBy';
        else if (s.startsWith('approved')) targetField = 'approvedBy';
        if (!targetField) continue;

        // Scan forward up to 3 rows for non-empty, non-role-title name
        for (let nr = r + 1; nr <= Math.min(r + 3, sheet.rowCount); nr++) {
          const nv = sheet.getRow(nr).getCell(c).value;
          if (nv === undefined || nv === null) continue;
          const name = String(nv).trim();
          if (!name || roleTitles.includes(name.toLowerCase())) continue;
          result[targetField] = name;
          break;
        }
      }
    }

    return result;
  }

  detectFormat(workbook: ExcelJS.Workbook): WorkbookFormat {
    const sheetNames = workbook.worksheets.map((ws) => ws.name);

    const hasLegacySheets =
      sheetNames.includes('Plans') &&
      sheetNames.includes('Goals') &&
      sheetNames.includes('Objectives');

    if (hasLegacySheets) {
      return 'legacy-multi-sheet';
    }

    const hasRbabTitle = workbook.worksheets.some((ws) => {
      const cell = ws.getCell('A1');
      const val = cell.value;
      return val !== undefined && val !== null && String(val).includes('RESULTS-BASED ACTION PLAN');
    });

    if (hasRbabTitle) {
      return 'chmsu-single-sheet';
    }

    return 'unknown';
  }

  async importExcel(
    buffer: Buffer,
    user: AuthenticatedUser,
  ): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const format = this.detectFormat(workbook);

    if (format === 'unknown') {
      return {
        plansCreated: 0,
        goalsCreated: 0,
        objectivesCreated: 0,
        errors: ['Unknown workbook format — only legacy multi-sheet and CHMSU single-sheet formats are supported'],
      };
    }

    const data = await this.parseWorkbook(buffer);
    const errors: string[] = [];

    if (data.plans.length === 0) {
      return {
        plansCreated: 0,
        goalsCreated: 0,
        objectivesCreated: 0,
        errors: ['No plan rows found in the spreadsheet'],
      };
    }

    // --- Validate plans ---
    const planRefToOfficeId = new Map<string, string>();
    const seenPlanRefs = new Set<string>();
    for (let i = 0; i < data.plans.length; i++) {
      const p = data.plans[i];
      const rowNum = i + 2;

      if (!p.planRef) {
        errors.push(`Row ${rowNum} (Plans): missing Plan Ref`);
        continue;
      }
      if (seenPlanRefs.has(p.planRef)) {
        errors.push(`Row ${rowNum} (Plans): duplicate Plan Ref "${p.planRef}"`);
        continue;
      }

      if (!p.office) {
        errors.push(`Row ${rowNum} (Plans): missing Office`);
        continue;
      }
      if (!p.planningYear) {
        errors.push(`Row ${rowNum} (Plans): missing Planning Year`);
        continue;
      }
      if (!p.campus) {
        errors.push(`Row ${rowNum} (Plans): missing Campus`);
        continue;
      }
      if (!p.programProjectActivityKRA) {
        errors.push(
          `Row ${rowNum} (Plans): missing Program/Project/Activity/KRA`,
        );
        continue;
      }

      const office = await this.officesService.findByName(p.office);
      if (!office) {
        errors.push(`Row ${rowNum} (Plans): Office "${p.office}" not found`);
        continue;
      }

      const existingPlan = await this.prisma.plan.findUnique({
        where: {
          officeId_planningYear: {
            officeId: office.id,
            planningYear: p.planningYear,
          },
        },
        select: { id: true },
      });
      if (existingPlan) {
        errors.push(
          `Row ${rowNum} (Plans): plan already exists for "${p.office}" in year ${p.planningYear}`,
        );
        continue;
      }

      planRefToOfficeId.set(p.planRef, office.id);
      seenPlanRefs.add(p.planRef);
    }

    if (errors.length > 0) {
      return { plansCreated: 0, goalsCreated: 0, objectivesCreated: 0, errors };
    }

    // --- Validate goals ---
    const validPlanRefs = new Set(data.plans.map((p) => p.planRef));
    const seenGoalRefs = new Set<string>();
    for (let i = 0; i < data.goals.length; i++) {
      const g = data.goals[i];
      const rowNum = i + 2;

      if (!g.goalRef) {
        errors.push(`Row ${rowNum} (Goals): missing Goal Ref`);
        continue;
      }
      if (seenGoalRefs.has(g.goalRef)) {
        errors.push(`Row ${rowNum} (Goals): duplicate Goal Ref "${g.goalRef}"`);
        continue;
      }
      if (!g.planRef) {
        errors.push(`Row ${rowNum} (Goals): missing Plan Ref`);
        continue;
      }
      if (!validPlanRefs.has(g.planRef)) {
        errors.push(
          `Row ${rowNum} (Goals): Plan Ref "${g.planRef}" not found in Plans sheet`,
        );
        continue;
      }
      if (!g.resultLevel) {
        errors.push(`Row ${rowNum} (Goals): missing Result Level`);
        continue;
      }
      if (!g.keyPerformanceIndicator) {
        errors.push(`Row ${rowNum} (Goals): missing KPI`);
        continue;
      }

      seenGoalRefs.add(g.goalRef);
    }

    if (errors.length > 0) {
      return { plansCreated: 0, goalsCreated: 0, objectivesCreated: 0, errors };
    }

    // --- Validate objectives ---
    const validGoalRefs = new Set(data.goals.map((g) => g.goalRef));
    const seenObjectiveRefs = new Set<string>();
    for (let i = 0; i < data.objectives.length; i++) {
      const o = data.objectives[i];
      const rowNum = i + 2;

      if (!o.objectiveRef) {
        errors.push(`Row ${rowNum} (Objectives): missing Objective Ref`);
        continue;
      }
      if (seenObjectiveRefs.has(o.objectiveRef)) {
        errors.push(
          `Row ${rowNum} (Objectives): duplicate Objective Ref "${o.objectiveRef}"`,
        );
        continue;
      }
      if (!o.goalRef) {
        errors.push(`Row ${rowNum} (Objectives): missing Goal Ref`);
        continue;
      }
      if (!validGoalRefs.has(o.goalRef)) {
        errors.push(
          `Row ${rowNum} (Objectives): Goal Ref "${o.goalRef}" not found in Goals sheet`,
        );
        continue;
      }
      if (!o.resultLevel) {
        errors.push(`Row ${rowNum} (Objectives): missing Result Level`);
        continue;
      }
      if (!o.keyPerformanceIndicator) {
        errors.push(`Row ${rowNum} (Objectives): missing KPI`);
        continue;
      }

      seenObjectiveRefs.add(o.objectiveRef);
    }

    if (errors.length > 0) {
      return { plansCreated: 0, goalsCreated: 0, objectivesCreated: 0, errors };
    }

    // --- Create in transaction ---
    const planRefToId = new Map<string, string>();
    const goalRefToId = new Map<string, string>();

    try {
      await this.prisma.$transaction(async (tx) => {
        // Create plans
        for (const p of data.plans) {
          const plan = await tx.plan.create({
            data: {
              officeId: planRefToOfficeId.get(p.planRef)!,
              createdById: user.id,
              planningYear: p.planningYear,
              campus: p.campus,
              programProjectActivityKRA: p.programProjectActivityKRA,
              strategicAlignment: p.strategicAlignment,
              breakthroughGoals: p.breakthroughGoals,
              strategicObjectives: p.strategicObjectives,
              monitoringFrequency: p.monitoringFrequency,
              reportingOffice: p.reportingOffice || null,
            },
            select: { id: true },
          });
          planRefToId.set(p.planRef, plan.id);

          if (p.monitoring) {
            await tx.planMonitoring.create({
              data: {
                planId: plan.id,
                frequency: p.monitoringFrequency,
                reportingOffice: p.reportingOffice || null,
                preparedBy: p.monitoring.preparedBy || null,
                reviewedBy: p.monitoring.reviewedBy || null,
                approvedBy: p.monitoring.approvedBy || null,
              },
              select: { id: true },
            });
          }
        }

        // Create goals
        for (const g of data.goals) {
          const goal = await tx.goal.create({
            data: {
              planId: planRefToId.get(g.planRef)!,
              officeId: planRefToOfficeId.get(g.planRef)!,
              createdById: user.id,
              resultLevel: g.resultLevel,
              targetResult: g.targetResult,
              keyActions: g.keyActions,
              keyRisk: g.keyRisk,
              mitigationMeasures: g.mitigationMeasures,
              keyPerformanceIndicator: g.keyPerformanceIndicator,
              target: g.target,
              responsibleOfficePerson: g.responsibleOfficePerson,
              timeline: g.timeline,
              fundSource: g.fundSource || null,
              budgetRequirements: g.budgetRequirements ?? 0,
              budgetAllocation: g.budgetAllocation ?? 0,
              budgetDeficit: g.budgetDeficit ?? 0,
              code: g.code ?? g.resultLevel,
              displayOrder: g.displayOrder ?? 0,
              meansOfVerification: g.meansOfVerification,
            },
            select: { id: true },
          });
          goalRefToId.set(g.goalRef, goal.id);
        }

        // Create objectives
        for (const o of data.objectives) {
          await tx.objective.create({
            data: {
              goalId: goalRefToId.get(o.goalRef)!,
              createdById: user.id,
              resultLevel: o.resultLevel,
              targetResult: o.targetResult,
              keyActions: o.keyActions,
              keyRisk: o.keyRisk,
              mitigationMeasures: o.mitigationMeasures,
              keyPerformanceIndicator: o.keyPerformanceIndicator,
              target: o.target,
              responsibleOfficePerson: o.responsibleOfficePerson,
              timeline: o.timeline,
              fundSource: o.fundSource || null,
              budgetRequirements: o.budgetRequirements ?? 0,
              budgetAllocation: o.budgetAllocation ?? 0,
              budgetDeficit: o.budgetDeficit ?? 0,
              code: o.code ?? o.resultLevel,
              displayOrder: o.displayOrder ?? 0,
              meansOfVerification: o.meansOfVerification,
            },
          });
        }
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Unknown error during import';
      errors.push(`Database error: ${message}`);
      return { plansCreated: 0, goalsCreated: 0, objectivesCreated: 0, errors };
    }

    return {
      plansCreated: data.plans.length,
      goalsCreated: data.goals.length,
      objectivesCreated: data.objectives.length,
      errors: [],
    };
  }

  async parseWorkbook(buffer: Buffer): Promise<ParsedImportData> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    const format = this.detectFormat(workbook);

    if (format === 'chmsu-single-sheet') {
      return this.parseChmsuWorkbook(workbook);
    }

    return {
      plans: this.parsePlansSheet(workbook),
      goals: this.parseGoalsSheet(workbook),
      objectives: this.parseObjectivesSheet(workbook),
    };
  }

  private parseChmsuWorkbook(workbook: ExcelJS.Workbook): ParsedImportData {
    const sheet = workbook.getWorksheet('Sheet1');
    if (!sheet) return { plans: [], goals: [], objectives: [] };

    const basicInfo = this.parseChmsuBasicInfo(sheet);
    const matrixRows = this.parseChmsuMatrixRows(sheet);
    const monitoring = this.parseChmsuMonitoringAndSignOff(sheet);

    if (!basicInfo.officeUnit || basicInfo.planningYear === 0) {
      return { plans: [], goals: [], objectives: [] };
    }

    const officeSlug = basicInfo.officeUnit.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const planRef = `${officeSlug}_${basicInfo.planningYear}`;

    const plan: ParsedPlanRow = {
      planRef,
      office: basicInfo.officeUnit,
      planningYear: basicInfo.planningYear,
      campus: basicInfo.campus,
      programProjectActivityKRA: basicInfo.programProjectActivityKRA,
      strategicAlignment: basicInfo.strategicAlignment,
      breakthroughGoals: basicInfo.breakthroughGoals,
      strategicObjectives: basicInfo.strategicObjectives,
      monitoringFrequency: monitoring.monitoringFrequency || 'Quarterly',
      reportingOffice: monitoring.reportingOffice || '',
    };

    if (monitoring.preparedBy || monitoring.reviewedBy || monitoring.approvedBy) {
      plan.monitoring = {
        preparedBy: monitoring.preparedBy,
        reviewedBy: monitoring.reviewedBy,
        approvedBy: monitoring.approvedBy,
      };
    }

    const goals: ParsedGoalRow[] = [];
    const objectives: ParsedObjectiveRow[] = [];
    let currentGoalRef: string | undefined;
    let goalOrder = 0;
    let objectiveOrder = 0;

    for (const row of matrixRows) {
      const resultLevel = row.resultLevel.trim();
      const isOutput = /^output\b/i.test(resultLevel);

      if (isOutput && currentGoalRef) {
        objectives.push({
          ...row,
          objectiveRef: `${planRef}-O${objectives.length + 1}`,
          goalRef: currentGoalRef,
          displayOrder: objectiveOrder++,
        });
        continue;
      }

      const goalRef = `${planRef}-G${goals.length + 1}`;
      goals.push({
        ...row,
        goalRef,
        planRef,
        displayOrder: goalOrder++,
      });
      currentGoalRef = goalRef;
      objectiveOrder = 0;
    }

    return { plans: [plan], goals, objectives };
  }

  private parsePlansSheet(workbook: ExcelJS.Workbook): ParsedPlanRow[] {
    const sheet = workbook.getWorksheet('Plans');
    if (!sheet) return [];

    const rows: ParsedPlanRow[] = [];
    const headerRow = sheet.getRow(1);
    const headerValues = headerRow.values as string[];

    const colMap = this.buildColumnMap(headerValues, PLANS_COLUMNS);
    if (Object.keys(colMap).length === 0) return rows;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as (string | undefined)[];
      if (!values.some((v) => v !== undefined && v !== null && v !== ''))
        return;

      const get = (key: string): string => {
        const idx = colMap[key];
        return idx !== undefined ? String(values[idx] ?? '').trim() : '';
      };
      const getNum = (key: string): number => {
        const idx = colMap[key];
        const v = values[idx];
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : Math.floor(n);
      };

      rows.push({
        planRef: get('Plan Ref'),
        office: get('Office'),
        planningYear: getNum('Planning Year'),
        campus: get('Campus'),
        programProjectActivityKRA: get('Program/Project/Activity/KRA'),
        strategicAlignment: get('Strategic Alignment'),
        breakthroughGoals: get('Breakthrough Goals'),
        strategicObjectives: get('Strategic Objectives'),
        monitoringFrequency: get('Monitoring Frequency') || 'Quarterly',
        reportingOffice: get('Reporting Office'),
      });
    });

    return rows;
  }

  private parseGoalsSheet(workbook: ExcelJS.Workbook): ParsedGoalRow[] {
    const sheet = workbook.getWorksheet('Goals');
    if (!sheet) return [];

    const rows: ParsedGoalRow[] = [];
    const headerRow = sheet.getRow(1);
    const headerValues = headerRow.values as string[];

    const colMap = this.buildColumnMap(headerValues, GOALS_COLUMNS);
    if (Object.keys(colMap).length === 0) return rows;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as (string | undefined)[];
      if (!values.some((v) => v !== undefined && v !== null && v !== ''))
        return;

      const get = (key: string): string => {
        const idx = colMap[key];
        return idx !== undefined ? String(values[idx] ?? '').trim() : '';
      };
      const getNum = (key: string): number => {
        const idx = colMap[key];
        const v = values[idx];
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };

      rows.push({
        goalRef: get('Goal Ref'),
        planRef: get('Plan Ref'),
        resultLevel: get('Result Level'),
        targetResult: get('Target Result'),
        keyActions: get('Key Actions'),
        keyRisk: get('Key Risk'),
        mitigationMeasures: get('Mitigation Measures'),
        keyPerformanceIndicator: get('KPI'),
        target: get('Target'),
        responsibleOfficePerson: get('Responsible Office/Person'),
        timeline: get('Timeline'),
        fundSource: get('Fund Source'),
        budgetRequirements: getNum('Budget Requirements'),
        budgetAllocation: getNum('Budget Allocation'),
        meansOfVerification: get('Means of Verification'),
      });
    });

    return rows;
  }

  private parseObjectivesSheet(
    workbook: ExcelJS.Workbook,
  ): ParsedObjectiveRow[] {
    const sheet = workbook.getWorksheet('Objectives');
    if (!sheet) return [];

    const rows: ParsedObjectiveRow[] = [];
    const headerRow = sheet.getRow(1);
    const headerValues = headerRow.values as string[];

    const colMap = this.buildColumnMap(headerValues, OBJECTIVES_COLUMNS);
    if (Object.keys(colMap).length === 0) return rows;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as (string | undefined)[];
      if (!values.some((v) => v !== undefined && v !== null && v !== ''))
        return;

      const get = (key: string): string => {
        const idx = colMap[key];
        return idx !== undefined ? String(values[idx] ?? '').trim() : '';
      };
      const getNum = (key: string): number => {
        const idx = colMap[key];
        const v = values[idx];
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };

      rows.push({
        objectiveRef: get('Objective Ref'),
        goalRef: get('Goal Ref'),
        resultLevel: get('Result Level'),
        targetResult: get('Target Result'),
        keyActions: get('Key Actions'),
        keyRisk: get('Key Risk'),
        mitigationMeasures: get('Mitigation Measures'),
        keyPerformanceIndicator: get('KPI'),
        target: get('Target'),
        responsibleOfficePerson: get('Responsible Office/Person'),
        timeline: get('Timeline'),
        fundSource: get('Fund Source'),
        budgetRequirements: getNum('Budget Requirements'),
        budgetAllocation: getNum('Budget Allocation'),
        meansOfVerification: get('Means of Verification'),
      });
    });

    return rows;
  }

  private buildColumnMap(
    headerValues: string[],
    expectedColumns: string[],
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (let i = 0; i < headerValues.length; i++) {
      const header = headerValues[i]?.toString().trim();
      if (header && expectedColumns.includes(header)) {
        map[header] = i;
      }
    }
    return map;
  }
}
