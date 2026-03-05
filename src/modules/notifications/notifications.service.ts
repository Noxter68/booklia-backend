import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { EmailService } from '../email/email.service';

interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  bookingId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private websocketGateway: WebsocketGateway,
    private emailService: EmailService,
    private config: ConfigService,
  ) {
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

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
    await this.create({
      userId: requesterId,
      type: 'BOOKING_ACCEPTED',
      title: 'Demande acceptée',
      message: `${providerName} a accepté votre demande pour "${serviceTitle}"`,
      bookingId,
    });

    // Send confirmation email to the client (fire-and-forget)
    this.sendBookingAcceptedEmail(bookingId);
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
    await this.create({
      userId: otherUserId,
      type: 'BOOKING_CANCELED',
      title: 'Réservation annulée',
      message: `${cancellerName} a annulé la réservation pour "${serviceTitle}"`,
      bookingId,
    });

    // Send cancellation email to the client (fire-and-forget)
    this.sendBookingCanceledEmail(bookingId, cancellerName);
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

  // --- Private email helpers ---

  /**
   * Fetches full booking data and sends a confirmation email to the requester.
   * Errors are caught and logged — never blocks the main flow.
   */
  private async sendBookingAcceptedEmail(bookingId: string): Promise<void> {
    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking?.requester.email) return;

      if (!booking.businessService) return;
      await this.emailService.sendBookingAccepted(booking.requester.email, {
        clientName: booking.requester.name || 'Client',
        businessName: booking.businessService.business.name,
        serviceName: booking.businessService.name,
        employeeName: `${booking.employee.firstName} ${booking.employee.lastName}`,
        scheduledAt: booking.scheduledAt!,
        durationMinutes: booking.businessService.durationMinutes,
        priceCents: booking.agreedPriceCents || booking.businessService.priceCents,
        address: booking.businessService.business.address || '',
        city: booking.businessService.business.city || '',
        frontendUrl: this.frontendUrl,
      });
    } catch (err) {
      this.logger.error(`Failed to send booking accepted email for ${bookingId}`, err);
    }
  }

  /**
   * Fetches full booking data and sends a cancellation email to the requester.
   * Errors are caught and logged — never blocks the main flow.
   */
  private async sendBookingCanceledEmail(bookingId: string, cancellerName: string): Promise<void> {
    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking?.requester.email) return;

      if (!booking.businessService) return;
      await this.emailService.sendBookingCanceled(booking.requester.email, {
        clientName: booking.requester.name || 'Client',
        businessName: booking.businessService.business.name,
        serviceName: booking.businessService.name,
        scheduledAt: booking.scheduledAt,
        canceledBy: cancellerName,
        frontendUrl: this.frontendUrl,
      });
    } catch (err) {
      this.logger.error(`Failed to send booking canceled email for ${bookingId}`, err);
    }
  }

  /**
   * Fetches a booking with all relations needed for email templates.
   */
  private async getBookingWithDetails(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        requester: { select: { name: true, email: true } },
        employee: { select: { firstName: true, lastName: true } },
        businessService: {
          include: {
            business: {
              select: {
                name: true,
                address: true,
                city: true,
                postalCode: true,
              },
            },
          },
        },
      },
    });
  }
}
