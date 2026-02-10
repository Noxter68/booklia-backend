import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { BookingCommentsService } from './booking-comments.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, MinLength, MaxLength } from 'class-validator';

class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

@Controller('bookings/:bookingId/comments')
@UseGuards(AuthGuard)
export class BookingCommentsController {
  constructor(private bookingCommentsService: BookingCommentsService) {}

  @Get()
  async getComments(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingCommentsService.getComments(user.id, bookingId);
  }

  @Post()
  async addComment(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.bookingCommentsService.addComment(user.id, bookingId, dto.content);
  }

  @Delete(':commentId')
  async deleteComment(
    @CurrentUser() user: { id: string },
    @Param('commentId') commentId: string,
  ) {
    return this.bookingCommentsService.deleteComment(user.id, commentId);
  }
}
