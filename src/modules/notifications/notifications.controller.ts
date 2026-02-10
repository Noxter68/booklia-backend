import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    const notifications = await this.notificationsService.getNotifications(
      user.id,
      limit ? parseInt(limit, 10) : 20,
    );
    const unreadCount = await this.notificationsService.getUnreadCount(user.id);
    return { notifications, unreadCount };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(user.id, id);
    return { success: true };
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.notificationsService.deleteNotification(user.id, id);
    return { success: true };
  }
}
