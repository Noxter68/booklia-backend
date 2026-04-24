import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './modules/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { BusinessModule } from './modules/business/business.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { BookingNotesModule } from './modules/booking-notes/booking-notes.module';
import { BillingModule } from './modules/billing/billing.module';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Global throttler with per-endpoint overrides via @Throttle on sensitive routes.
    // The "default" limit is lax (120 req/min per IP) so normal dashboard usage
    // isn't throttled; auth and booking-create use their own stricter limits.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 60_000, limit: 10 },
      { name: 'booking', ttl: 60_000, limit: 20 },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    WebsocketModule,
    AuthModule,
    BookingsModule,
    ReviewsModule,
    CategoriesModule,
    StripeModule,
    ClientsModule,
    BusinessModule,
    EmployeesModule,
    UploadModule,
    NotificationsModule,
    GeocodingModule,
    AdminModule,
    EmailModule,
    CalendarModule,
    BookingNotesModule,
    BillingModule,
    InvoicesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
