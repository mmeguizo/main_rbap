import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Body,
  Query,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { HttpCode, HttpStatus } from '@nestjs/common';
import { OfficesService } from './offices.service';
import { PaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { CreateOfficeDto } from './dto/create.office.dto';
import { UpdateOfficeDto } from './dto/update-office.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ActivityLogService } from '../activity-log/activity-log.service';

@ApiTags('Offices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offices')
export class OfficesController {
  constructor(
    private readonly officesService: OfficesService,
    private readonly activityLogService: ActivityLogService,
  ) {}

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
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Get()
  async findAll(@Query() q: PaginationDto) {
    return await this.officesService.findAllPaginated(q.take, q.skip);
  }

  @ApiOperation({
    summary: 'Get office hierarchy tree (nested parent→children).',
  })
  @Roles(Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Get('tree')
  async getOfficeTree() {
    return await this.officesService.getOfficeTree();
  }

  @ApiOperation({
    summary: 'List offices visible to the signed-in user based on hierarchy.',
  })
  @Roles(Role.ADMIN, Role.PRESIDENTS, Role.VICE_PRESIDENTS, Role.DIRECTORS, Role.OFFICE_HEAD)
  @Get('accessible')
  @HttpCode(HttpStatus.OK)
  async findAccessibleOffices(@Req() req: { user: AuthenticatedUser }) {
    return this.officesService.findAccessibleOffices(req.user);
  }

  @ApiOperation({
    summary: 'update an office',
  })
  @ApiBody({ type: UpdateOfficeDto })
  @Roles(Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Patch('update-office')
  @HttpCode(HttpStatus.OK)
  async updateOffice(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: UpdateOfficeDto,
  ) {
    const office = await this.officesService.updateOffice(
      dto.officeId,
      dto.name,
      dto.userId,
      dto.parentId,
      req.user,
    );
    await this.activityLogService.log(
      req.user.id,
      'OFFICE_UPDATED',
      'Office',
      dto.officeId,
      { name: office.name },
    );
    return office;
  }

  @ApiOperation({
    summary: 'Add an office',
  })
  @ApiBody({
    type: CreateOfficeDto,
  })
  @Roles(Role.DIRECTORS, Role.VICE_PRESIDENTS, Role.PRESIDENTS, Role.ADMIN)
  @Post('add-office')
  @HttpCode(HttpStatus.CREATED)
  async addOffice(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateOfficeDto,
  ) {
    const office = await this.officesService.addOffice(
      dto.name,
      dto.userId,
      dto.parentId,
      req.user,
    );
    await this.activityLogService.log(
      req.user.id,
      'OFFICE_CREATED',
      'Office',
      office.id,
      { name: office.name },
    );
    return office;
  }

  @ApiOperation({
    summary: 'Delete an office',
  })
  @ApiBody({
    schema: {
      properties: {
        officeId: { type: 'string', example: 'cmoi17zug0000igv8dhnel5qg' },
      },
    },
  })
  @Roles(Role.ADMIN)
  @Post('delete-office')
  @HttpCode(HttpStatus.OK)
  async deleteAnOffice(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body('officeId') officeId: string,
  ) {
    const office = await this.officesService.deleteAnOffice(officeId);
    await this.activityLogService.log(
      req.user.id,
      'OFFICE_DEACTIVATED',
      'Office',
      officeId,
      { name: office.name },
    );
    return office;
  }
}
