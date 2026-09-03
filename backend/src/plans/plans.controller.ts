import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbapWorkspaceGuard } from '../auth/guards/rbap-workspace.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlanDashboardDto } from './dto/query-plan-dashboard.dto';
import { QueryPlansDto } from './dto/query-plans.dto';
import { QueryPlanReportsDto } from './dto/query-plan-reports.dto';
import { QueryExcelExportDto } from './dto/query-excel-export.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import type { Response } from 'express';
import { PlansService } from './plans.service';
import { PdfExportService } from './pdf-export.service';
import { ExcelExportService } from './excel-export.service';
import { ExcelImportService } from './excel-import.service';
import { UpdatePlanMonitoringDto } from './dto/update-plan-monitoring.dto';
import { CreatePlanRemarkDto } from './dto/create-plan-remark.dto';
import { QueryRemarksDto } from '../remarks/dto/query-remarks.dto';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, RbapWorkspaceGuard)
@Controller('plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly pdfExportService: PdfExportService,
    private readonly excelExportService: ExcelExportService,
    private readonly excelImportService: ExcelImportService,
  ) {}

  @ApiOperation({
    summary: 'Create an annual RBAP plan for the signed-in office.',
  })
  @ApiBody({ type: CreatePlanDto })
  @Roles(
    Role.ADMIN,
    Role.OFFICE_HEAD,
    Role.DIRECTORS,
    Role.VICE_PRESIDENTS,
    Role.PRESIDENTS,
  )
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePlanDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.create(dto, req.user);
  }

  @ApiOperation({ summary: 'List RBAP plans visible to the signed-in user.' })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({
    name: 'officeId',
    required: false,
    example: 'cmnzr74pb0000i4v8sl99f7je',
  })
  @ApiQuery({ name: 'planningYear', required: false, example: 2026 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED'],
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryPlansDto,
  ) {
    return this.plansService.findAll(req.user, q);
  }

  @ApiOperation({
    summary:
      'Get dashboard summary counts for plans visible to the signed-in user.',
  })
  @ApiQuery({
    name: 'officeId',
    required: false,
    example: 'cmnzr74pb0000i4v8sl99f7je',
  })
  @ApiQuery({ name: 'planningYear', required: false, example: 2026 })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryPlanDashboardDto,
  ) {
    return this.plansService.getSummary(req.user, q);
  }

  @ApiOperation({
    summary: 'Get a paginated printable monitoring and target achievement report.',
  })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({ name: 'officeId', required: false })
  @ApiQuery({ name: 'planningYear', required: false, example: 2026 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED'],
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get('reports')
  @HttpCode(HttpStatus.OK)
  async getReports(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryPlanReportsDto,
  ) {
    return this.plansService.getReports(req.user, q);
  }

  @ApiOperation({
    summary: 'List submitted plans assigned to the signed-in reviewer.',
  })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({
    name: 'officeId',
    required: false,
    example: 'cmnzr74pb0000i4v8sl99f7je',
  })
  @ApiQuery({ name: 'planningYear', required: false, example: 2026 })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS)
  @Get('pending-approvals')
  @HttpCode(HttpStatus.OK)
  async findPendingApprovals(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryPlanDashboardDto,
  ) {
    return this.plansService.findPendingApprovals(req.user, q);
  }

  @ApiOperation({ summary: 'Get one RBAP plan by id if it is in scope.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'Get the complete A/B/C RBAP document for a plan.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id/document')
  @HttpCode(HttpStatus.OK)
  async getDocument(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.getDocument(id, req.user);
  }

  @ApiOperation({ summary: 'List remarks and feedback for a plan.' })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id/remarks')
  @HttpCode(HttpStatus.OK)
  async findRemarks(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
    @Query() query: QueryRemarksDto,
  ) {
    return this.plansService.findRemarks(id, req.user, query);
  }

  @ApiOperation({ summary: 'Add a remark or feedback to a plan.' })
  @ApiBody({ type: CreatePlanRemarkDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Post(':id/remarks')
  @HttpCode(HttpStatus.CREATED)
  async createRemark(
    @Param('id') id: string,
    @Body() dto: CreatePlanRemarkDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.createRemark(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Create or update RBAP monitoring metadata and signatories.' })
  @ApiBody({ type: UpdatePlanMonitoringDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Patch(':id/monitoring')
  @HttpCode(HttpStatus.OK)
  async updateMonitoring(
    @Param('id') id: string,
    @Body() dto: UpdatePlanMonitoringDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.updateMonitoring(id, dto, req.user);
  }

  @ApiOperation({
    summary: 'Update a draft RBAP plan for the owning office.',
  })
  @ApiBody({ type: UpdatePlanDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Delete a draft RBAP plan for the owning office.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.delete(id, req.user);
  }

  @ApiOperation({ summary: 'Submit a draft RBAP plan for supervisor review.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Patch(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.submit(id, req.user);
  }

  @ApiOperation({
    summary: 'Approve a submitted plan assigned to the signed-in reviewer.',
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.approve(id, req.user);
  }

  @ApiOperation({
    summary: 'Return a submitted plan to its owner for revision with feedback.',
  })
  @ApiBody({ type: CreatePlanRemarkDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS)
  @Patch(':id/return')
  @HttpCode(HttpStatus.OK)
  async returnPlan(
    @Param('id') id: string,
    @Body() dto: CreatePlanRemarkDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.plansService.returnPlan(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Export a plan as PDF.' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiProduces('application/pdf')
  @Roles(Role.OFFICE_HEAD, Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
    @Res() res: Response,
  ) {
    const buffer = await this.pdfExportService.exportPdf(id, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="plan-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Export one RBAP plan as a faithful A/B/C workbook.' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Roles(Role.OFFICE_HEAD, Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Get(':id/export/document')
  async exportDocument(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
    @Res() res: Response,
  ) {
    const buffer = await this.excelExportService.exportDocument(id, req.user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rbap-plan-${id}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Export filtered plans as Excel (.xlsx).' })
  @ApiQuery({ name: 'officeId', required: false })
  @ApiQuery({ name: 'planningYear', required: false, example: 2026 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED'],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Roles(Role.OFFICE_HEAD, Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Get('export/excel')
  async exportExcel(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryExcelExportDto,
    @Res() res: Response,
  ) {
    const buffer = await this.excelExportService.exportExcel(req.user, q);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rbap-plans-export.xlsx"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Import plans from an Excel (.xlsx) file.' })
  @ApiProduces('application/json')
  @Roles(Role.OFFICE_HEAD, Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @Post('import/excel')
  @HttpCode(HttpStatus.CREATED)
  async importExcel(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        ],
        fileIsRequired: true,
      }),
    )
    file: UploadedFile,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.excelImportService.importExcel(file.buffer, req.user);
  }
}
