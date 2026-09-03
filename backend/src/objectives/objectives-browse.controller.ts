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
import { QueryObjectivesDto } from './dto/query-objectives.dto';
import { ObjectivesService } from './objectives.service';

@ApiTags('Objectives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, RbapWorkspaceGuard)
@Controller('objectives')
export class ObjectivesBrowseController {
  constructor(private readonly objectivesService: ObjectivesService) {}

  @ApiOperation({
    summary:
      'List objectives visible to the signed-in user without requiring goal and plan ids.',
  })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({
    name: 'officeId',
    required: false,
    example: 'cmnzr74pb0000i4v8sl99f7je',
  })
  @ApiQuery({ name: 'planId', required: false, example: 'cmplan123456789' })
  @ApiQuery({ name: 'goalId', required: false, example: 'cmgoal123456789' })
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
    @Query() q: QueryObjectivesDto,
  ) {
    return this.objectivesService.findAllVisible(req.user, q);
  }

  @ApiOperation({
    summary:
      'Get one objective visible to the signed-in user without requiring goal and plan ids.',
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.objectivesService.findOneVisible(id, req.user);
  }
}
