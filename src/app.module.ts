import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ServicesModule } from './modules/services/services.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { BusinessModule } from './modules/business/business.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BookingCommentsModule } from './modules/booking-comments/booking-comments.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { ReputationModule } from './modules/reputation/reputation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ReputationModule,
    WebsocketModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    BookingsModule,
    ReviewsModule,
    CategoriesModule,
    TagsModule,
    StripeModule,
    BusinessModule,
    EmployeesModule,
    UploadModule,
    NotificationsModule,
    BookingCommentsModule,
  ],
})
export class AppModule {}
