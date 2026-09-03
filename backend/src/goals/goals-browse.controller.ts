import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { QueryGoalsDto } from './dto/query-goals.dto';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, RbapWorkspaceGuard)
@Controller('goals')
export class GoalsBrowseController {
  constructor(private readonly goalsService: GoalsService) {}

  @ApiOperation({
    summary:
      'List goals visible to the signed-in user without requiring a plan id.',
  })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({
    name: 'officeId',
    required: false,
    example: 'cmnzr74pb0000i4v8sl99f7je',
  })
  @ApiQuery({ name: 'planId', required: false, example: 'cmplan123456789' })
  @ApiQuery({ name: 'planningYear', required: false, example: 2026 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query() q: QueryGoalsDto,
  ) {
    return this.goalsService.findAllVisible(req.user, q);
  }

  @ApiOperation({
    summary:
      'Get one goal visible to the signed-in user without requiring a plan id.',
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.goalsService.findOneVisible(id, req.user);
  }
}
