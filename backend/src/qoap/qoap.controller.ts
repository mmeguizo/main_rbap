import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateQoapDto } from './dto/create-qoap.dto';
import { UpdateQoapDto } from './dto/update-qoap.dto';
import { QueryQoapDto } from './dto/query-qoap.dto';
import { QoapService } from './qoap.service';
import { QoapExportService } from './qoap-export.service';

@ApiTags('Qoap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.OFFICE_HEAD,
  Role.DIRECTORS,
  Role.VICE_PRESIDENTS,
  Role.PRESIDENTS,
  Role.ADMIN,
)
@Controller('qoap')
export class QoapController {
  constructor(
    private readonly qoapService: QoapService,
    private readonly qoapExportService: QoapExportService,
  ) {}

  @ApiOperation({ summary: 'Create a QOAP extending an RBAP Goal.' })
  @ApiBody({ type: CreateQoapDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateQoapDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qoapService.create(dto, req.user);
  }

  @ApiOperation({
    summary: 'List QOAPs merged with their parent RBAP Goal/Plan context.',
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryQoapDto,
  ) {
    return this.qoapService.findAll(req.user, q);
  }

  @ApiOperation({
    summary: 'List RBAP Goals that do not yet have a QOAP.',
  })
  @Get('available-goals')
  @HttpCode(HttpStatus.OK)
  async findAvailableGoals(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryQoapDto,
  ) {
    return this.qoapService.findAvailableGoals(req.user, q);
  }

  @ApiOperation({ summary: 'Export one QOAP in the official PDF layout.' })
  @ApiParam({ name: 'id', description: 'QOAP ID' })
  @ApiProduces('application/pdf')
  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
    @Res() res: Response,
  ) {
    const buffer = await this.qoapExportService.exportPdf(id, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="qoap-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Export one QOAP as an Excel workbook.' })
  @ApiParam({ name: 'id', description: 'QOAP ID' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Get(':id/export/excel')
  async exportExcel(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
    @Res() res: Response,
  ) {
    const buffer = await this.qoapExportService.exportExcel(id, req.user);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="qoap-${id}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get one QOAP by id if it is in scope.' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qoapService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'Update QM-only fields of a QOAP.' })
  @ApiBody({ type: UpdateQoapDto })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQoapDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qoapService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Delete a QOAP.' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qoapService.delete(id, req.user);
  }
}
