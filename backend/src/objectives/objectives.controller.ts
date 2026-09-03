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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbapWorkspaceGuard } from '../auth/guards/rbap-workspace.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaginationDto } from '../offices/dto/pagination.dto';
import { CreateObjectiveDto } from './dto/create-objective.dto';
import { UpdateObjectiveDto } from './dto/update-objective.dto';
import { UpdateObjectiveProgressDto } from './dto/update-objective-progress.dto';
import { ObjectivesService } from './objectives.service';

@ApiTags('Objectives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, RbapWorkspaceGuard)
@Controller('plans/:planId/goals/:goalId/objectives')
export class ObjectivesController {
  constructor(private readonly objectivesService: ObjectivesService) {}

  @ApiOperation({ summary: 'Create an objective or output under a goal.' })
  @ApiBody({ type: CreateObjectiveDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('planId') planId: string,
    @Param('goalId') goalId: string,
    @Body() dto: CreateObjectiveDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.objectivesService.create(planId, goalId, dto, req.user);
  }

  @ApiOperation({
    summary: 'List objectives under a goal if the plan is in scope.',
  })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Param('planId') planId: string,
    @Param('goalId') goalId: string,
    @Req() req: { user: AuthenticatedUser },
    @Query() q: PaginationDto,
  ) {
    return this.objectivesService.findAll(
      planId,
      goalId,
      req.user,
      q.take,
      q.skip,
    );
  }

  @ApiOperation({ summary: 'Get one objective under a goal.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('planId') planId: string,
    @Param('goalId') goalId: string,
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.objectivesService.findOne(planId, goalId, id, req.user);
  }

  @ApiOperation({ summary: 'Update an objective under a draft plan.' })
  @ApiBody({ type: UpdateObjectiveDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('planId') planId: string,
    @Param('goalId') goalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateObjectiveDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.objectivesService.update(planId, goalId, id, dto, req.user);
  }

  @ApiOperation({
    summary: 'Update objective progress on an approved plan.',
  })
  @ApiBody({ type: UpdateObjectiveProgressDto })
  @Roles(Role.ADMIN, Role.OFFICE_HEAD)
  @Patch(':id/progress')
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @Param('planId') planId: string,
    @Param('goalId') goalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateObjectiveProgressDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.objectivesService.updateProgress(
      planId,
      goalId,
      id,
      dto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Delete an objective under a draft plan.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('planId') planId: string,
    @Param('goalId') goalId: string,
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.objectivesService.delete(planId, goalId, id, req.user);
  }
}
