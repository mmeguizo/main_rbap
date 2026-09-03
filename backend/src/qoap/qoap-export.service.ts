/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { QoapService } from './qoap.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require('pdfmake');

pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const DOCUMENT_CODE = 'F.25-QM-CHMSU';
const REVISION_NUMBER = '0';
const EFFECTIVITY_DATE = 'February 19, 2026';
const CONTENT_REVISION_NUMBER = '0';
const LAST_REVISION_DATE = 'N/A';

type ExportQoap = Awaited<ReturnType<QoapService['findOne']>>;

@Injectable()
export class QoapExportService {
  constructor(private readonly qoapService: QoapService) {}

  async exportPdf(qoapId: string, user: AuthenticatedUser): Promise<Buffer> {
    const qoap = await this.qoapService.findOne(qoapId, user);
    const documentDefinition = this.buildPdfDefinition(qoap);
    const pdfDoc = pdfMake.createPdf(documentDefinition);
    return pdfDoc.getBuffer();
  }

  async exportExcel(qoapId: string, user: AuthenticatedUser): Promise<Buffer> {
    const qoap = await this.qoapService.findOne(qoapId, user);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CHMSU - QM';
    workbook.created = new Date();
    this.buildExcelSheet(workbook, qoap);
    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw as unknown as ArrayBuffer);
  }

  private buildPdfDefinition(qoap: ExportQoap) {
    const reportingOffice = qoap.goal.plan.reportingOffice ?? qoap.office.name;
    const frequency = this.frequencyLabel(qoap.goal.plan.monitoringFrequency);
    const rows = [
      [
        this.cell(
          `${qoap.goal.plan.breakthroughGoals}\n\n${qoap.goal.plan.strategicObjectives}`,
        ),
        this.cell(qoap.functionalObjective),
        this.cell(qoap.indicators),
        this.cell(qoap.indicatorFormula),
        this.cell(qoap.goal.keyActions),
        this.cell(qoap.goal.target),
        this.cell(qoap.goal.timeline),
        this.cell(qoap.goal.responsibleOfficePerson),
        this.cell(qoap.resources),
        this.cell(frequency),
        this.cell(qoap.intendedOutcomes),
      ],
    ];

    return {
      pageSize: 'A3',
      pageOrientation: 'landscape',
      pageMargins: [18, 18, 18, 18],
      defaultStyle: { font: 'Helvetica', fontSize: 7 },
      content: [
        {
          table: {
            widths: ['*', 150, 120, 130, 185, 55, 80, 95, 90, 70, 130],
            body: [
              [
                {
                  text: 'QUALITY OBJECTIVES AND ACTION PLAN (QOAP)',
                  colSpan: 7,
                  bold: true,
                  fontSize: 18,
                  margin: [8, 18, 8, 18],
                },
                {},
                {},
                {},
                {},
                {},
                {},
                {
                  table: {
                    widths: [105, 110],
                    body: [
                      [{ text: 'Document Code:', bold: true }, DOCUMENT_CODE],
                      [
                        { text: 'Revision Number:', bold: true },
                        REVISION_NUMBER,
                      ],
                      [
                        { text: 'Date of Effectivity:', bold: true },
                        EFFECTIVITY_DATE,
                      ],
                      [{ text: 'Page No.:', bold: true }, 'Page 1 of 1'],
                    ],
                  },
                  colSpan: 4,
                },
                {},
                {},
                {},
              ],
              [
                {
                  text: reportingOffice.toUpperCase(),
                  colSpan: 9,
                  bold: true,
                  fontSize: 15,
                  alignment: 'center',
                  fillColor: '#E2F0D9',
                  margin: [6, 8, 6, 8],
                },
                {},
                {},
                {},
                {},
                {},
                {},
                {},
                {},
                {
                  text: `CY ${qoap.goal.plan.planningYear}`,
                  colSpan: 2,
                  bold: true,
                  fontSize: 13,
                  alignment: 'center',
                  fillColor: '#E2F0D9',
                },
                {},
              ],
              [
                { text: 'Content Revision No.:', bold: true, colSpan: 2 },
                {},
                CONTENT_REVISION_NUMBER,
                { text: 'Effectivity Date:', bold: true },
                EFFECTIVITY_DATE,
                { text: 'Last Revision Date:', bold: true },
                LAST_REVISION_DATE,
                { text: 'Status:', bold: true },
                'CONTROLLED',
                {},
                {},
              ],
              [
                this.headerCell('Breakthrough Goals and Strategic Objectives'),
                this.headerCell('Functional Objectives'),
                this.headerCell('Indicators'),
                this.headerCell('Formula'),
                this.headerCell('Actions (Programs/Activities/Projects)'),
                this.headerCell('Target/s'),
                this.headerCell('Target Completion Date'),
                this.headerCell('Responsible Persons & Partners'),
                this.headerCell('Resources'),
                this.headerCell('Frequency of Monitoring'),
                this.headerCell('Intended Outcomes'),
              ],
              ...rows,
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => '#333333',
            vLineColor: () => '#333333',
          },
        },
        {
          margin: [0, 18, 0, 0],
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'Prepared by:', bold: true },
                { text: 'Verified by:', bold: true },
                { text: 'Approved by:', bold: true },
              ],
              [
                { text: '\n\n\n', alignment: 'center' },
                { text: '\n\n\n', alignment: 'center' },
                { text: '\n\n\n', alignment: 'center' },
              ],
              [
                { text: 'Unit Head', italics: true, alignment: 'center' },
                {
                  text: 'Director for Quality Management',
                  italics: true,
                  alignment: 'center',
                },
                {
                  text: 'University President',
                  italics: true,
                  alignment: 'center',
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => '#333333',
            vLineColor: () => '#333333',
          },
        },
      ],
    };
  }

  private buildExcelSheet(workbook: ExcelJS.Workbook, qoap: ExportQoap) {
    const sheet = workbook.addWorksheet('QOAP', {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true },
    });
    const reportingOffice = qoap.goal.plan.reportingOffice ?? qoap.office.name;
    const frequency = this.frequencyLabel(qoap.goal.plan.monitoringFrequency);
    const border = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };
    const greenFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFE2F0D9' },
    };

    sheet.columns = [
      { key: 'breakthrough', width: 28 },
      { key: 'functional', width: 25 },
      { key: 'indicators', width: 25 },
      { key: 'formula', width: 25 },
      { key: 'actions', width: 36 },
      { key: 'target', width: 16 },
      { key: 'completion', width: 20 },
      { key: 'responsible', width: 25 },
      { key: 'resources', width: 24 },
      { key: 'frequency', width: 18 },
      { key: 'outcomes', width: 30 },
    ];

    sheet.mergeCells('A1:H2');
    sheet.getCell('A1').value = 'QUALITY OBJECTIVES AND ACTION PLAN (QOAP)';
    sheet.getCell('A1').font = { bold: true, size: 18 };
    sheet.getCell('A1').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };
    sheet.mergeCells('I1:K1');
    sheet.getCell('I1').value = `Document Code: ${DOCUMENT_CODE}`;
    sheet.mergeCells('I2:K2');
    sheet.getCell('I2').value = `Revision Number: ${REVISION_NUMBER}`;
    sheet.mergeCells('A3:J3');
    sheet.getCell('A3').value = reportingOffice.toUpperCase();
    sheet.getCell('A3').font = { bold: true, size: 15 };
    sheet.getCell('A3').alignment = { horizontal: 'center' };
    sheet.getCell('A3').fill = greenFill;
    sheet.getCell('K3').value = `CY ${qoap.goal.plan.planningYear}`;
    sheet.getCell('K3').font = { bold: true, size: 13 };
    sheet.getCell('K3').alignment = { horizontal: 'center' };
    sheet.getCell('K3').fill = greenFill;
    sheet.mergeCells('A4:K4');
    sheet.getCell('A4').value =
      `Content Revision No.: ${CONTENT_REVISION_NUMBER}    Effectivity Date: ${EFFECTIVITY_DATE}    Last Revision Date: ${LAST_REVISION_DATE}    Status: CONTROLLED`;

    const header = sheet.addRow([
      'Breakthrough Goals and Strategic Objectives',
      'Functional Objectives',
      'Indicators',
      'Formula',
      'Actions (Programs/Activities/Projects)',
      'Target/s',
      'Target Completion Date',
      'Responsible Persons & Partners',
      'Resources',
      'Frequency of Monitoring',
      'Intended Outcomes',
    ]);
    header.font = { bold: true };
    header.alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: 'center',
    };
    header.fill = greenFill;
    header.height = 42;

    const row = sheet.addRow([
      `${qoap.goal.plan.breakthroughGoals}\n\n${qoap.goal.plan.strategicObjectives}`,
      qoap.functionalObjective,
      qoap.indicators,
      qoap.indicatorFormula,
      qoap.goal.keyActions,
      qoap.goal.target,
      qoap.goal.timeline,
      qoap.goal.responsibleOfficePerson,
      qoap.resources,
      frequency,
      qoap.intendedOutcomes,
    ]);
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = 150;

    const approvalHeader = sheet.addRow([
      'Prepared by:',
      '',
      '',
      'Verified by:',
      '',
      '',
      'Approved by:',
      '',
      '',
    ]);
    approvalHeader.font = { bold: true };
    approvalHeader.height = 20;
    sheet.mergeCells(`A${approvalHeader.number}:C${approvalHeader.number}`);
    sheet.mergeCells(`D${approvalHeader.number}:F${approvalHeader.number}`);
    sheet.mergeCells(`G${approvalHeader.number}:K${approvalHeader.number}`);

    const approvalSpace = sheet.addRow([]);
    approvalSpace.height = 45;
    sheet.mergeCells(`A${approvalSpace.number}:C${approvalSpace.number}`);
    sheet.mergeCells(`D${approvalSpace.number}:F${approvalSpace.number}`);
    sheet.mergeCells(`G${approvalSpace.number}:K${approvalSpace.number}`);

    const approvalNames = sheet.addRow([
      'Unit Head',
      '',
      '',
      'Director for Quality Management',
      '',
      '',
      'University President',
      '',
      '',
    ]);
    approvalNames.font = { italic: true };
    approvalNames.alignment = { horizontal: 'center' };
    sheet.mergeCells(`A${approvalNames.number}:C${approvalNames.number}`);
    sheet.mergeCells(`D${approvalNames.number}:F${approvalNames.number}`);
    sheet.mergeCells(`G${approvalNames.number}:K${approvalNames.number}`);

    sheet.eachRow((currentRow) => {
      currentRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = border;
      });
    });
    sheet.views = [{ state: 'frozen', ySplit: 5 }];
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 0;
  }

  private headerCell(text: string) {
    return {
      text,
      bold: true,
      alignment: 'center',
      fillColor: '#E2F0D9',
      fontSize: 7,
    };
  }

  private cell(text: string) {
    return { text, fontSize: 7, margin: [3, 5, 3, 5] };
  }

  private frequencyLabel(value: string) {
    const normalized = value.trim().toUpperCase();
    return (
      {
        MONTHLY: 'Monthly',
        QUARTERLY: 'Quarterly',
        BIANNUAL: 'Biannual',
        BIANNUALLY: 'Biannual',
        ANNUAL: 'Annual',
        ANNUALLY: 'Annual',
      }[normalized] ?? value
    );
  }
}
