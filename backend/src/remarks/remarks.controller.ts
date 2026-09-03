import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RemarksService } from './remarks.service';
import { CreateRemarkDto } from './dto/create-remark.dto';
import { QueryRemarksDto } from './dto/query-remarks.dto';

@ApiTags('Remarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('goals/:goalId/remarks')
export class RemarksController {
  constructor(private readonly remarksService: RemarksService) {}

  @ApiOperation({ summary: 'Post a remark on a goal' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('goalId') goalId: string,
    @Body() dto: CreateRemarkDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.remarksService.create(goalId, req.user, dto);
  }

  @ApiOperation({ summary: 'List remarks for a goal' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get()
  async findAll(
    @Param('goalId') goalId: string,
    @Query() query: QueryRemarksDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.remarksService.findAll(goalId, req.user, query);
  }

  @ApiOperation({ summary: 'Delete a remark' })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Delete(':remarkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('goalId') goalId: string,
    @Param('remarkId') remarkId: string,
    @Req() req: { user: AuthenticatedUser },
  ) {
    await this.remarksService.delete(goalId, remarkId, req.user);
  }
}
