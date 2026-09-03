import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PlanStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const excelPlanSelect = {
  id: true,
  planningYear: true,
  campus: true,
  programProjectActivityKRA: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  createdAt: true,
  office: {
    select: { id: true, name: true },
  },
  createdBy: {
    select: { id: true, name: true },
  },
  goals: {
    select: {
      id: true,
      resultLevel: true,
      targetResult: true,
      keyPerformanceIndicator: true,
      target: true,
      budgetRequirements: true,
      budgetAllocation: true,
      status: true,
      objectives: {
        select: {
          id: true,
          resultLevel: true,
          targetResult: true,
          keyPerformanceIndicator: true,
          target: true,
          budgetRequirements: true,
          budgetAllocation: true,
          status: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ExcelExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
  ) {}

  async exportExcel(
    user: AuthenticatedUser,
    filters: {
      officeId?: string;
      planningYear?: number;
      status?: PlanStatus;
      search?: string;
    },
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

    const plans = await this.prisma.plan.findMany({
      where,
      orderBy: [{ planningYear: 'desc' }, { createdAt: 'desc' }],
      select: excelPlanSelect,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CHMSU - RBAP IDM';
    workbook.created = new Date();

    this.addPlansSheet(workbook, plans);
    this.addGoalsSheet(workbook, plans);
    this.addObjectivesSheet(workbook, plans);

    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw as unknown as ArrayBuffer);
  }

  async exportDocument(planId: string, user: AuthenticatedUser): Promise<Buffer> {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, officeId: { in: officeIds } },
      select: {
        id: true, planningYear: true, campus: true, programProjectActivityKRA: true,
        strategicAlignment: true, breakthroughGoals: true, strategicObjectives: true,
        datePrepared: true, monitoringFrequency: true, reportingOffice: true,
        office: { select: { name: true } },
        monitoring: { select: { frequency: true, reportingOffice: true, preparedBy: true, reviewedBy: true, approvedBy: true } },
        goals: {
          orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
          select: {
            code: true, resultLevel: true, targetResult: true, keyActions: true, keyRisk: true,
            mitigationMeasures: true, keyPerformanceIndicator: true, target: true,
            responsibleOfficePerson: true, timeline: true, fundSource: true,
            budgetRequirements: true, budgetAllocation: true, budgetDeficit: true,
            meansOfVerification: true,
            objectives: {
              orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
              select: {
                code: true, resultLevel: true, targetResult: true, keyActions: true, keyRisk: true,
                mitigationMeasures: true, keyPerformanceIndicator: true, target: true,
                responsibleOfficePerson: true, timeline: true, fundSource: true,
                budgetRequirements: true, budgetAllocation: true, budgetDeficit: true,
                meansOfVerification: true,
              },
            },
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('Plan not found.');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CHMSU - RBAP IDM';
    const sheet = workbook.addWorksheet('RBAP Document');
    sheet.columns = [
      { width: 28 }, { width: 32 }, { width: 32 }, { width: 32 }, { width: 28 },
      { width: 28 }, { width: 28 }, { width: 28 }, { width: 22 }, { width: 18 },
      { width: 18 }, { width: 18 }, { width: 18 }, { width: 28 }, { width: 32 },
    ];
    const title = sheet.addRow(['RBAP RESULTS-BASED ACTION PLAN']);
    title.font = { bold: true, size: 14 };
    sheet.mergeCells(`A${title.number}:O${title.number}`);
    sheet.addRow(['A. BASIC INFORMATION']);
    [
      ['Campus', plan.campus], ['Office / Unit', plan.office.name],
      ['Program / Project / Activity / KRA', plan.programProjectActivityKRA],
      ['Strategic Alignment', plan.strategicAlignment], ['Breakthrough Goals', plan.breakthroughGoals],
      ['Strategic Objectives', plan.strategicObjectives], ['Planning Year', plan.planningYear],
      ['Date Prepared', plan.datePrepared?.toISOString().split('T')[0] ?? ''],
    ].forEach((row) => sheet.addRow(row));
    sheet.addRow([]);
    const section = sheet.addRow(['B. RESULTS MATRIX']);
    section.font = { bold: true };
    const headers = ['Code', 'Result Level', 'Target Result', 'Key Actions', 'Key Risk', 'Mitigation / Control', 'KPI', 'Target', 'Responsible Office / Person', 'Timeline', 'Fund Source', 'Budget Requirements', 'Budget Allocation', 'Budget Deficit', 'MOV'];
    const header = sheet.addRow(headers);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    type DocumentRow = Omit<typeof plan.goals[number], 'objectives'>;
    const addRow = (row: DocumentRow, fallbackCode: string) => sheet.addRow([
      row.code ?? fallbackCode, row.resultLevel, row.targetResult, row.keyActions, row.keyRisk,
      row.mitigationMeasures, row.keyPerformanceIndicator, row.target, row.responsibleOfficePerson,
      row.timeline, row.fundSource ?? '', Number(row.budgetRequirements), Number(row.budgetAllocation),
      Number(row.budgetDeficit), row.meansOfVerification,
    ]);
    plan.goals.forEach((goal, index) => {
      const code = goal.code ?? `Outcome ${String.fromCharCode(65 + index)}`;
      addRow(goal, code);
      goal.objectives.forEach((objective, childIndex) => addRow(objective, `${code}.${childIndex + 1}`));
    });
    sheet.addRow([]);
    const monitoringTitle = sheet.addRow(['C. MONITORING']);
    monitoringTitle.font = { bold: true };
    const monitoring = plan.monitoring;
    [
      ['Frequency', monitoring?.frequency ?? plan.monitoringFrequency],
      ['Reporting Office', monitoring?.reportingOffice ?? plan.reportingOffice ?? ''],
      ['Prepared By', monitoring?.preparedBy ?? ''],
      ['Reviewed By', monitoring?.reviewedBy ?? ''],
      ['Approved By', monitoring?.approvedBy ?? ''],
    ].forEach((row) => sheet.addRow(row));
    sheet.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw as unknown as ArrayBuffer);
  }

  private addPlansSheet(
    workbook: ExcelJS.Workbook,
    plans: Array<{
      id: string;
      planningYear: number;
      campus: string | null;
      programProjectActivityKRA: string;
      status: string;
      submittedAt: Date | null;
      approvedAt: Date | null;
      createdAt: Date;
      office: { name: string };
      createdBy: { name: string };
      goals: Array<{
        budgetRequirements: { toNumber: () => number };
        budgetAllocation: { toNumber: () => number };
      }>;
    }>,
  ) {
    const sheet = workbook.addWorksheet('Plans');

    sheet.columns = [
      { header: 'Plan ID', key: 'id', width: 28 },
      { header: 'Office', key: 'office', width: 30 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Program/Project/Activity/KRA', key: 'kra', width: 40 },
      { header: 'Campus', key: 'campus', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Budget Requirements', key: 'budgetReq', width: 20 },
      { header: 'Budget Allocation', key: 'budgetAlloc', width: 20 },
      { header: 'Created By', key: 'createdBy', width: 25 },
      { header: 'Submitted At', key: 'submittedAt', width: 18 },
      { header: 'Approved At', key: 'approvedAt', width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    plans.forEach((plan) => {
      const budgetReq = plan.goals.reduce(
        (sum: number, g: { budgetRequirements: { toNumber: () => number } }) =>
          sum + Number(g.budgetRequirements),
        0,
      );
      const budgetAlloc = plan.goals.reduce(
        (sum: number, g: { budgetAllocation: { toNumber: () => number } }) =>
          sum + Number(g.budgetAllocation),
        0,
      );

      sheet.addRow({
        id: plan.id,
        office: plan.office.name,
        year: plan.planningYear,
        kra: plan.programProjectActivityKRA,
        campus: plan.campus ?? '',
        status: plan.status,
        budgetReq,
        budgetAlloc,
        createdBy: plan.createdBy.name,
        submittedAt: plan.submittedAt
          ? plan.submittedAt.toISOString().split('T')[0]
          : '',
        approvedAt: plan.approvedAt
          ? plan.approvedAt.toISOString().split('T')[0]
          : '',
      });
    });
  }

  private addGoalsSheet(
    workbook: ExcelJS.Workbook,
    plans: Array<{
      id: string;
      planningYear: number;
      office: { name: string };
      programProjectActivityKRA: string;
      goals: Array<{
        id: string;
        resultLevel: string;
        targetResult: string;
        keyPerformanceIndicator: string;
        target: string;
        budgetRequirements: { toNumber: () => number };
        budgetAllocation: { toNumber: () => number };
        status: string;
      }>;
    }>,
  ) {
    const sheet = workbook.addWorksheet('Goals');

    sheet.columns = [
      { header: 'Goal ID', key: 'id', width: 28 },
      { header: 'Plan ID', key: 'planId', width: 28 },
      { header: 'Office', key: 'office', width: 30 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Plan KRA', key: 'planKra', width: 35 },
      { header: 'Result Level', key: 'resultLevel', width: 30 },
      { header: 'Target Result', key: 'targetResult', width: 35 },
      { header: 'KPI', key: 'kpi', width: 30 },
      { header: 'Target', key: 'target', width: 20 },
      { header: 'Budget Requirements', key: 'budgetReq', width: 20 },
      { header: 'Budget Allocation', key: 'budgetAlloc', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    plans.forEach((plan) => {
      plan.goals.forEach((goal) => {
        sheet.addRow({
          id: goal.id,
          planId: plan.id,
          office: plan.office.name,
          year: plan.planningYear,
          planKra: plan.programProjectActivityKRA,
          resultLevel: goal.resultLevel,
          targetResult: goal.targetResult,
          kpi: goal.keyPerformanceIndicator,
          target: goal.target,
          budgetReq: Number(goal.budgetRequirements),
          budgetAlloc: Number(goal.budgetAllocation),
          status: goal.status,
        });
      });
    });
  }

  private addObjectivesSheet(
    workbook: ExcelJS.Workbook,
    plans: Array<{
      id: string;
      planningYear: number;
      office: { name: string };
      goals: Array<{
        id: string;
        resultLevel: string;
        objectives: Array<{
          id: string;
          resultLevel: string;
          targetResult: string;
          keyPerformanceIndicator: string;
          target: string;
          budgetRequirements: { toNumber: () => number };
          budgetAllocation: { toNumber: () => number };
          status: string;
        }>;
      }>;
    }>,
  ) {
    const sheet = workbook.addWorksheet('Objectives');

    sheet.columns = [
      { header: 'Objective ID', key: 'id', width: 28 },
      { header: 'Goal ID', key: 'goalId', width: 28 },
      { header: 'Plan ID', key: 'planId', width: 28 },
      { header: 'Office', key: 'office', width: 30 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Goal', key: 'goal', width: 30 },
      { header: 'Result Level', key: 'resultLevel', width: 30 },
      { header: 'Target Result', key: 'targetResult', width: 35 },
      { header: 'KPI', key: 'kpi', width: 30 },
      { header: 'Target', key: 'target', width: 20 },
      { header: 'Budget Requirements', key: 'budgetReq', width: 20 },
      { header: 'Budget Allocation', key: 'budgetAlloc', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    plans.forEach((plan) => {
      plan.goals.forEach((goal) => {
        goal.objectives.forEach((obj) => {
          sheet.addRow({
            id: obj.id,
            goalId: goal.id,
            planId: plan.id,
            office: plan.office.name,
            year: plan.planningYear,
            goal: goal.resultLevel,
            resultLevel: obj.resultLevel,
            targetResult: obj.targetResult,
            kpi: obj.keyPerformanceIndicator,
            target: obj.target,
            budgetReq: Number(obj.budgetRequirements),
            budgetAlloc: Number(obj.budgetAllocation),
            status: obj.status,
          });
        });
      });
    });
  }
}
