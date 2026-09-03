import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require('pdfmake');

pdfMake.setLocalAccessPolicy(() => true);
pdfMake.setUrlAccessPolicy(() => true);
pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const planPdfSelect = {
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
  status: true,
  submittedAt: true,
  approvedAt: true,
  office: {
    select: { id: true, name: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
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
export class PdfExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
  ) {}

  async exportPdf(planId: string, user: AuthenticatedUser): Promise<Buffer> {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('Plan not found.');
    }

    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, officeId: { in: officeIds } },
      select: planPdfSelect,
    });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    const docDefinition = this.buildDocDefinition(plan);
    const pdfDoc = pdfMake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }

  private buildDocDefinition(plan: {
    planningYear: number;
    campus: string | null;
    programProjectActivityKRA: string;
    strategicAlignment: string;
    breakthroughGoals: string;
    strategicObjectives: string;
    datePrepared: Date | null;
    monitoringFrequency: string;
    reportingOffice: string | null;
    status: string;
    office: { name: string };
    createdBy: { name: string };
    goals: Array<{
      resultLevel: string;
      targetResult: string;
      keyPerformanceIndicator: string;
      target: string;
      budgetRequirements: { toNumber: () => number };
      budgetAllocation: { toNumber: () => number };
      status: string;
      objectives: Array<{
        resultLevel: string;
        targetResult: string;
        keyPerformanceIndicator: string;
        target: string;
        budgetRequirements: { toNumber: () => number };
        budgetAllocation: { toNumber: () => number };
        status: string;
      }>;
    }>;
  }) {
    const header = () => ({
      columns: [
        {
          text: [
            {
              text: 'CARLOS HILADO MEMORIAL STATE UNIVERSITY\n',
              bold: true,
              fontSize: 14,
              alignment: 'center',
            },
            {
              text: 'RESULTS-BASED ACTION PLAN (RBAP)\n',
              bold: true,
              fontSize: 11,
              alignment: 'center',
            },
            { text: 'Office: ', bold: true, fontSize: 9 },
            { text: `${plan.office.name}\n`, fontSize: 9 },
            { text: `Planning Year: `, bold: true, fontSize: 9 },
            { text: `${plan.planningYear}\n`, fontSize: 9 },
          ],
          alignment: 'center',
          margin: [0, 0, 0, 10],
        },
      ],
    });

    const metadataSection = () => ({
      layout: 'noBorders',
      table: {
        widths: ['30%', '70%'],
        body: [
          ['Office:', plan.office.name],
          ['Planning Year:', String(plan.planningYear)],
          ['Campus:', plan.campus ?? 'N/A'],
          ['Status:', plan.status],
          ['Reporting Office:', plan.reportingOffice ?? 'N/A'],
          ['Monitoring Frequency:', plan.monitoringFrequency ?? 'N/A'],
          [
            'Date Prepared:',
            plan.datePrepared
              ? new Date(plan.datePrepared).toLocaleDateString()
              : 'N/A',
          ],
          ['Prepared By:', plan.createdBy.name],
        ],
      },
    });

    const descriptionSection = () => {
      const rows: object[] = [];
      if (plan.programProjectActivityKRA) {
        rows.push([
          { text: 'Program/Project/Activity/KRA', bold: true },
          plan.programProjectActivityKRA,
        ]);
      }
      if (plan.strategicAlignment) {
        rows.push([
          { text: 'Strategic Alignment', bold: true },
          plan.strategicAlignment,
        ]);
      }
      if (plan.breakthroughGoals) {
        rows.push([
          { text: 'Breakthrough Goals', bold: true },
          plan.breakthroughGoals,
        ]);
      }
      if (plan.strategicObjectives) {
        rows.push([
          { text: 'Strategic Objectives', bold: true },
          plan.strategicObjectives,
        ]);
      }

      if (rows.length === 0) return null;

      return {
        layout: 'noBorders',
        table: {
          widths: ['30%', '70%'],
          body: rows,
        },
      };
    };

    const goalsTable = () => {
      const goalRows = plan.goals
        .map((g, i) => {
          const budgetReq =
            typeof g.budgetRequirements === 'object'
              ? Number(g.budgetRequirements)
              : Number(g.budgetRequirements);

          const goalHeader: object[] = [
            {
              text: `${i + 1}. ${g.resultLevel}`,
              bold: true,
              fontSize: 9,
              colSpan: 4,
            },
            {},
            {},
            {},
          ];
          const goalDetails: object[] = [
            { text: 'Target Result:', bold: true, fontSize: 8 },
            { text: g.targetResult, fontSize: 8, colSpan: 3 },
            {},
            {},
          ];
          const goalKpi: object[] = [
            { text: 'KPI:', bold: true, fontSize: 8 },
            { text: g.keyPerformanceIndicator, fontSize: 8, colSpan: 3 },
            {},
            {},
          ];
          const goalTarget: object[] = [
            { text: 'Target:', bold: true, fontSize: 8 },
            { text: g.target, fontSize: 8 },
            { text: 'Budget:', bold: true, fontSize: 8 },
            { text: `PHP ${budgetReq.toLocaleString()}`, fontSize: 8 },
          ];
          const goalStatus: object[] = [
            { text: 'Status:', bold: true, fontSize: 8 },
            { text: g.status.replace(/_/g, ' '), fontSize: 8, colSpan: 3 },
            {},
            {},
          ];

          const rows: object[][] = [
            goalHeader,
            goalDetails,
            goalKpi,
            goalTarget,
            goalStatus,
          ];

          if (g.objectives.length > 0) {
            rows.push([
              {
                text: `Objectives (${g.objectives.length}):`,
                bold: true,
                fontSize: 8,
                colSpan: 4,
                margin: [0, 5, 0, 0],
              },
              {},
              {},
              {},
            ]);
            g.objectives.forEach((o, oi) => {
              const oBudget =
                typeof o.budgetRequirements === 'object'
                  ? Number(o.budgetRequirements)
                  : Number(o.budgetRequirements);
              rows.push([
                {
                  text: `  ${oi + 1}. ${o.resultLevel}`,
                  fontSize: 8,
                  colSpan: 4,
                },
                {},
                {},
                {},
              ]);
              rows.push([
                { text: '     Target:', bold: true, fontSize: 7 },
                { text: o.targetResult, fontSize: 7, colSpan: 3 },
                {},
                {},
              ]);
              rows.push([
                { text: '     KPI:', bold: true, fontSize: 7 },
                { text: o.keyPerformanceIndicator, fontSize: 7 },
                { text: 'Budget:', bold: true, fontSize: 7 },
                { text: `PHP ${oBudget.toLocaleString()}`, fontSize: 7 },
              ]);
              rows.push([
                { text: '     Status:', bold: true, fontSize: 7 },
                { text: o.status.replace(/_/g, ' '), fontSize: 7, colSpan: 3 },
                {},
                {},
              ]);
            });
          }

          return rows;
        })
        .flat();

      if (goalRows.length === 0) {
        return {
          text: 'No goals defined for this plan.',
          fontSize: 9,
          italics: true,
        };
      }

      return {
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#999999',
          vLineColor: () => '#999999',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        table: {
          headerRows: 0,
          widths: ['50%', '20%', '15%', '15%'],
          body: goalRows,
        },
      };
    };

    const content: object[] = [
      header(),
      {
        text: 'Plan Information',
        bold: true,
        fontSize: 12,
        margin: [0, 10, 0, 5],
        decoration: 'underline',
      },
      metadataSection(),
    ];

    const desc = descriptionSection();
    if (desc) {
      content.push(
        {
          text: 'Strategic Context',
          bold: true,
          fontSize: 12,
          margin: [0, 15, 0, 5],
          decoration: 'underline',
        },
        desc,
      );
    }

    content.push(
      {
        text: 'Goals and Objectives',
        bold: true,
        fontSize: 12,
        margin: [0, 15, 0, 5],
        decoration: 'underline',
      },
      goalsTable(),
    );

    content.push({
      text: `\n\nGenerated on: ${new Date().toLocaleDateString()} | CHMSU - RBAP IDM`,
      fontSize: 7,
      italics: true,
      alignment: 'center',
      color: '#888888',
    });

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content,
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9,
      },
    };
  }
}
