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
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, RbapWorkspaceGuard)
@Controller('plans/:planId/goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @ApiOperation({ summary: 'Create a goal or outcome under a plan.' })
  @ApiBody({ type: CreateGoalDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('planId') planId: string,
    @Body() dto: CreateGoalDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.goalsService.create(planId, dto, req.user);
  }

  @ApiOperation({ summary: 'List goals under a plan if the plan is in scope.' })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Param('planId') planId: string,
    @Req() req: { user: AuthenticatedUser },
    @Query() q: PaginationDto,
  ) {
    return this.goalsService.findAll(planId, req.user, q.take, q.skip);
  }

  @ApiOperation({ summary: 'Get one goal under a plan.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('planId') planId: string,
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.goalsService.findOne(planId, id, req.user);
  }

  @ApiOperation({ summary: 'Update a goal under a draft plan.' })
  @ApiBody({ type: UpdateGoalDto })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('planId') planId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.goalsService.update(planId, id, dto, req.user);
  }

  @ApiOperation({ summary: 'Delete a goal under a draft plan.' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('planId') planId: string,
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.goalsService.delete(planId, id, req.user);
  }
}
