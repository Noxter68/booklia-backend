import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { WebsocketGateway } from '../websocket/websocket.gateway';

interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  bookingId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private websocketGateway: WebsocketGateway,
  ) {}

  async create(data: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        bookingId: data.bookingId,
      },
    });

    // Send real-time notification via WebSocket
    this.websocketGateway.sendNotificationToUser(data.userId, notification);

    // Also send updated unread count
    const unreadCount = await this.getUnreadCount(data.userId);
    this.websocketGateway.sendNotificationCountToUser(data.userId, unreadCount);

    return notification;
  }

  async getNotifications(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // Helper methods to create specific notification types
  async notifyNewBooking(providerId: string, requesterName: string, serviceTitle: string, bookingId: string) {
    return this.create({
      userId: providerId,
      type: 'BOOKING_NEW',
      title: 'Nouvelle demande',
      message: `${requesterName} vous a envoyé une demande pour "${serviceTitle}"`,
      bookingId,
    });
  }

  async notifyBookingAccepted(requesterId: string, providerName: string, serviceTitle: string, bookingId: string) {
    return this.create({
      userId: requesterId,
      type: 'BOOKING_ACCEPTED',
      title: 'Demande acceptée',
      message: `${providerName} a accepté votre demande pour "${serviceTitle}"`,
      bookingId,
    });
  }

  async notifyBookingRejected(requesterId: string, providerName: string, serviceTitle: string, bookingId: string) {
    return this.create({
      userId: requesterId,
      type: 'BOOKING_REJECTED',
      title: 'Demande refusée',
      message: `${providerName} a refusé votre demande pour "${serviceTitle}"`,
      bookingId,
    });
  }

  async notifyBookingCanceled(otherUserId: string, cancellerName: string, serviceTitle: string, bookingId: string) {
    return this.create({
      userId: otherUserId,
      type: 'BOOKING_CANCELED',
      title: 'Réservation annulée',
      message: `${cancellerName} a annulé la réservation pour "${serviceTitle}"`,
      bookingId,
    });
  }

  async notifyReviewReceived(userId: string, reviewerName: string, bookingId: string) {
    return this.create({
      userId,
      type: 'REVIEW_RECEIVED',
      title: 'Nouvel avis',
      message: `${reviewerName} vous a laissé un avis`,
      bookingId,
    });
  }
}
