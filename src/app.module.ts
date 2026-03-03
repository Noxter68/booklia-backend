import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
  ],
})
export class AppModule {}
