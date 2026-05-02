import { Controller, Post, Get, Body, Query, UseGuards, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Throttle({ auth: { ttl: 60_000, limit: 30 } })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: User) {
    return this.authService.getUserById(user.id);
  }

  @Patch('change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('verify-password')
  @UseGuards(AuthGuard)
  async verifyPassword(
    @CurrentUser() user: User,
    @Body('password') password: string,
  ) {
    return this.authService.verifyPassword(user.id, password);
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}
