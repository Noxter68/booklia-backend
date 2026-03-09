import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const userId = payload.sub;
      client.userId = userId;

      // Add socket to user's socket set
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user-specific room
      client.join(`user:${userId}`);

      this.logger.log(`User ${userId} connected (socket: ${client.id})`);
    } catch (error) {
      this.logger.warn(`Invalid token for client ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSocketSet = this.userSockets.get(client.userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
      this.logger.log(`User ${client.userId} disconnected (socket: ${client.id})`);
    }
  }

  // Send notification to a specific user
  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.log(`Sent notification to user ${userId}: ${notification.type}`);
  }

  // Send notification count update to a specific user
  sendNotificationCountToUser(userId: string, count: number) {
    this.server.to(`user:${userId}`).emit('notification:count', { count });
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // Get online user count
  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  // Send booking comment to a specific booking room
  sendBookingComment(bookingId: string, comment: any) {
    const room = `booking:${bookingId}`;
    this.server.to(room).emit('booking:comment', comment);
    this.logger.log(`Sent comment to room ${room}`);
  }

  // Send booking status update to a specific user
  sendBookingStatusUpdate(userId: string, booking: any) {
    this.server.to(`user:${userId}`).emit('booking:status', booking);
    this.logger.log(`Sent booking status update to user ${userId}: ${booking.id} -> ${booking.status}`);
  }

  // Send calendar update to a business owner (triggers refetch on all connected tabs)
  sendCalendarUpdate(userId: string) {
    this.server.to(`user:${userId}`).emit('calendar:update');
    this.logger.log(`Sent calendar:update to user ${userId}`);
  }

  // Join a booking room (for real-time comments)
  @SubscribeMessage('booking:join')
  handleJoinBooking(client: AuthenticatedSocket, bookingId: string) {
    client.join(`booking:${bookingId}`);
    this.logger.log(`User ${client.userId} joined booking room ${bookingId}`);
    return { success: true };
  }

  // Leave a booking room
  @SubscribeMessage('booking:leave')
  handleLeaveBooking(client: AuthenticatedSocket, bookingId: string) {
    client.leave(`booking:${bookingId}`);
    this.logger.log(`User ${client.userId} left booking room ${bookingId}`);
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(client: AuthenticatedSocket): string {
    return 'pong';
  }
}
