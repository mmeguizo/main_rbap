import {
  Controller,
  NotFoundException,
  BadRequestException,
  Get,
  Post,
  UseGuards,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { HttpCode, HttpStatus } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { AssignSupervisorDto } from './dto/assign-supervisor.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('User')
@Controller('user')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @ApiOperation({
    summary: 'Get all users ',
  })
  @ApiQuery({
    name: 'take',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    example: 0,
  })
  @Roles(Role.ADMIN)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUsers(
    @Query('take') take: number = 20,
    @Query('skip') skip: number = 0,
    @Query('search') search?: string,
  ) {
    return await this.usersService.findAll(take, skip, search);
  }

  @ApiOperation({
    summary: 'Get total user count',
  })
  @Roles(Role.ADMIN)
  @Get('count')
  @HttpCode(HttpStatus.OK)
  async getUserCount() {
    const count = await this.usersService.count();
    return { count };
  }

  @ApiOperation({
    summary: 'Get all users without office',
  })
  @Roles(Role.ADMIN)
  @Get('without-office')
  @HttpCode(HttpStatus.OK)
  async getAllusersWithoutOffice() {
    return await this.usersService.findAllWithoutOffice();
  }

  @ApiOperation({
    summary: 'Get user info by ID',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    example: 'cmnockzva00008cv8pmywwzs8',
  })
  @Roles(Role.ADMIN)
  @Get('user-id')
  async getUserInfoById(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }
    return await this.usersService.findAdminUserById(userId);
  }

  @ApiOperation({
    summary: 'Get user info by Email',
  })
  @ApiQuery({
    name: 'email',
    required: true,
    example: 'mark.meguizo@chmsu.edu.ph',
  })
  @Roles(Role.ADMIN)
  @Get('user-email')
  @HttpCode(HttpStatus.OK)
  async getUserInfoByEmail(@Query('email') email: string) {
    return await this.usersService.findAdminUserByEmail(email);
  }
  @ApiOperation({
    summary: 'Change the status of a user by ID',
  })
  @ApiBody({
    schema: {
      properties: {
        userId: { type: 'string', example: 'cmnockzva00008cv8pmywwzs8' },
      },
    },
  })
  @Roles(Role.ADMIN)
  @Post('change-user-status')
  @HttpCode(HttpStatus.OK)
  async changeUsersStatus(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body('userId') userId: string,
  ) {
    const user = await this.usersService.checkUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const result = await this.usersService.changeStatus(userId);
    await this.activityLogService.log(
      req.user.id,
      'USER_STATUS_CHANGED',
      'User',
      userId,
      { status: result.status },
    );
    return result;
  }

  @ApiOperation({
    summary:
      'Soft delete a user by marking the account inactive and clearing office-linked assignments.',
  })
  @ApiBody({
    schema: {
      properties: {
        userId: { type: 'string', example: 'cmnockzva00008cv8pmywwzs8' },
      },
    },
  })
  @Roles(Role.ADMIN)
  @Post('delete-user')
  @HttpCode(HttpStatus.OK)
  async softDeleteUser(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body('userId') userId: string,
  ) {
    const user = await this.usersService.checkUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.usersService.softDelete(userId);
    await this.activityLogService.log(
      req.user.id,
      'USER_DEACTIVATED',
      'User',
      userId,
      { name: result.name },
    );
    return result;
  }

  @Post('assign-office')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Assign or clear a user office',
  })
  @ApiBody({
    schema: {
      properties: {
        userId: { type: 'string', example: 'cmnockzva00008cv8pmywwzs8' },
        officeId: {
          type: 'string',
          nullable: true,
          example: 'cmnzr74pb0000i4v8sl99f7je',
        },
      },
      required: ['userId'],
    },
  })
  @HttpCode(HttpStatus.OK)
  async assignOffice(
    @Body('userId') userId: string,
    @Body('officeId') officeId?: string | null,
  ) {
    const user = await this.usersService.checkUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return await this.usersService.assignToOffice(userId, officeId);
  }

  @Roles(Role.ADMIN)
  @Post('assign-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change a user role',
  })
  @ApiBody({
    schema: {
      properties: {
        userId: { type: 'string', example: 'cmnockzva00008cv8pmywwzs8' },
        role: {
          enum: [
            'ADMIN',
            'OFFICE_HEAD',
            'DIRECTORS',
            'VICE_PRESIDENTS',
            'PRESIDENTS',
          ],
          example: 'ADMIN',
        },
      },
    },
  })
  async changeUserRole(@Body() dto: ChangeUserRoleDto) {
    const user = await this.usersService.checkUserById(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return await this.usersService.changeUserRole(dto.userId, dto.role);
  }

  @Roles(Role.ADMIN)
  @Post('assign-supervisor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign or clear a user supervisor for RBAP approvals',
  })
  @ApiBody({ type: AssignSupervisorDto })
  async assignSupervisor(@Body() dto: AssignSupervisorDto) {
    const userId = dto.userId;
    const user = await this.usersService.checkUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.assignSupervisor(userId, dto.supervisorId);
  }

  @Roles(Role.ADMIN)
  @Get(':userId/memberships')
  async getMemberships(@Param('userId') userId: string) {
    if (!(await this.usersService.checkUserById(userId))) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.listMemberships(userId);
  }

  @Roles(Role.ADMIN)
  @Post(':userId/sync-memberships')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or repair both RBAP and QM workspace memberships',
  })
  async syncMemberships(
    @Param('userId') userId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    const memberships = await this.usersService.syncMemberships(userId);
    await this.activityLogService.log(
      req.user.id,
      'MEMBERSHIPS_SYNCHRONIZED',
      'User',
      userId,
      { workspaces: memberships.map((membership) => membership.workspace) },
    );
    return memberships;
  }

  @Roles(Role.ADMIN)
  @Post('memberships')
  async createMembership(
    @Body() dto: CreateMembershipDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    const membership = await this.usersService.createMembership(dto);
    await this.activityLogService.log(req.user.id, 'MEMBERSHIP_CREATED', 'AccountMembership', membership.id, {
      userId: dto.userId, workspace: dto.workspace,
    });
    return membership;
  }

  @Roles(Role.ADMIN)
  @Post('memberships/:membershipId')
  async updateMembership(
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    const membership = await this.usersService.updateMembership(membershipId, dto);
    await this.activityLogService.log(req.user.id, 'MEMBERSHIP_UPDATED', 'AccountMembership', membershipId, dto);
    return membership;
  }

  @Roles(Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Manually create a new user (admin only)',
  })
  @ApiBody({ type: CreateUserDto })
  async createUser(@Body() dto: CreateUserDto) {
    return await this.usersService.create(dto);
  }
}
