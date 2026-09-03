import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.PRESIDENTS,
    Role.VICE_PRESIDENTS,
    Role.DIRECTORS,
    Role.OFFICE_HEAD,
  )
  @ApiOperation({ summary: 'Get all notifications for the authenticated user' })
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAll(req.user, query);
  }

  @Get('unread-count')
  @Roles(
    Role.ADMIN,
    Role.PRESIDENTS,
    Role.VICE_PRESIDENTS,
    Role.DIRECTORS,
    Role.OFFICE_HEAD,
  )
  @ApiOperation({ summary: 'Get count of unread notifications' })
  getUnreadCount(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.PRESIDENTS,
    Role.VICE_PRESIDENTS,
    Role.DIRECTORS,
    Role.OFFICE_HEAD,
  )
  @ApiOperation({ summary: 'Get a single notification by ID' })
  findOne(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.notificationsService.findOne(id, req.user.id);
  }

  @Patch('read-all')
  @Roles(
    Role.ADMIN,
    Role.PRESIDENTS,
    Role.VICE_PRESIDENTS,
    Role.DIRECTORS,
    Role.OFFICE_HEAD,
  )
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  @Roles(
    Role.ADMIN,
    Role.PRESIDENTS,
    Role.VICE_PRESIDENTS,
    Role.DIRECTORS,
    Role.OFFICE_HEAD,
  )
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(req.user.id, notificationId);
  }
}
