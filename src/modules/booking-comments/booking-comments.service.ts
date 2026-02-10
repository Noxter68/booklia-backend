import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class BookingCommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private websocketGateway: WebsocketGateway,
  ) {}

  async getComments(userId: string, bookingId: string) {
    // Verify user has access to this booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { title: true } },
        requester: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.requesterId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    const comments = await this.prisma.bookingComment.findMany({
      where: { bookingId },
      include: {
        author: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      booking,
      comments,
    };
  }

  async addComment(userId: string, bookingId: string, content: string) {
    // Verify user has access to this booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { title: true } },
        requester: { select: { id: true, profile: { select: { displayName: true } } } },
        provider: { select: { id: true, profile: { select: { displayName: true } } } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.requesterId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    const comment = await this.prisma.bookingComment.create({
      data: {
        bookingId,
        authorId: userId,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Send notification to the other party
    const otherUserId = userId === booking.requesterId ? booking.providerId : booking.requesterId;
    const authorName = userId === booking.requesterId
      ? booking.requester.profile?.displayName || 'Quelqu\'un'
      : booking.provider.profile?.displayName || 'Quelqu\'un';

    await this.notificationsService.create({
      userId: otherUserId,
      type: 'BOOKING_COMMENT',
      title: 'Nouveau message',
      message: `${authorName} a commenté votre demande pour "${booking.service?.title || 'un service'}"`,
      bookingId,
    });

    // Send real-time message via WebSocket to both parties
    // Include bookingId explicitly in case it's not in the Prisma result
    const commentWithBookingId = { ...comment, bookingId };
    this.websocketGateway.sendBookingComment(bookingId, commentWithBookingId);

    return commentWithBookingId;
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.bookingComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.bookingComment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }
}
