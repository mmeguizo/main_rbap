import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateQomDto } from './dto/create-qom.dto';
import { UpdateQomDto } from './dto/update-qom.dto';
import { QueryQomDto } from './dto/query-qom.dto';
import { QomService } from './qom.service';

@ApiTags('Qom')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OFFICE_HEAD, Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
@Controller('qoap/:qoapId/qom')
export class QomController {
  constructor(private readonly qomService: QomService) {}

  @ApiOperation({ summary: 'Create a monitoring record under a QOAP.' })
  @ApiBody({ type: CreateQomDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('qoapId') qoapId: string,
    @Body() dto: CreateQomDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qomService.create(qoapId, dto, req.user);
  }

  @ApiOperation({ summary: 'List a QOAP monitoring history.' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Param('qoapId') qoapId: string,
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryQomDto,
  ) {
    return this.qomService.findAll(qoapId, req.user, q);
  }

  @ApiOperation({ summary: 'Get one QOM by id if it is in scope.' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('qoapId') qoapId: string,
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qomService.findOne(qoapId, id, req.user);
  }

  @ApiOperation({ summary: 'Update a QOM monitoring record.' })
  @ApiBody({ type: UpdateQomDto })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('qoapId') qoapId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQomDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.qomService.update(qoapId, id, dto, req.user);
  }
}
