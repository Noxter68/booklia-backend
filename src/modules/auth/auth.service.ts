import { Injectable, UnauthorizedException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private cacheService: CacheService,
  ) {
    this.frontendUrl =
      configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  async register(dto: RegisterDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: `${dto.firstName} ${dto.lastName}`,
        birthDate: new Date(dto.birthDate),
      },
    });

    // Create account with password
    await this.prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: 'credentials',
        password: hashedPassword,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Send verification email (fire-and-forget)
    this.sendVerificationEmail(user.id, user.email, user.name || 'Utilisateur');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Find credentials account
    const account = await this.prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credentials',
      },
    });

    if (!account || !account.password) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, account.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
      ...tokens,
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      return user;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Verifies the current user's password without issuing a new session.
   * Used for sensitive actions (e.g., revealing hidden financial amounts).
   * Rate-limited to 5 attempts per 15 minutes per user (soft-fails if Redis
   * is unavailable — bcrypt remains the main cost guard).
   */
  async verifyPassword(userId: string, password: string) {
    const rateKey = `verify-password:attempts:${userId}`;
    const maxAttempts = 5;
    const windowSeconds = 15 * 60;

    const attempts = (await this.cacheService.get<number>(rateKey)) ?? 0;
    if (attempts >= maxAttempts) {
      throw new HttpException(
        'Trop de tentatives. Réessayez dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credentials' },
    });

    if (!account || !account.password) {
      throw new UnauthorizedException('Compte non trouvé');
    }

    const isValid = await bcrypt.compare(password, account.password);
    if (!isValid) {
      await this.cacheService.set(rateKey, attempts + 1, windowSeconds);
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    await this.cacheService.del(rateKey);
    return { valid: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credentials' },
    });

    if (!account || !account.password) {
      throw new UnauthorizedException('Compte non trouvé');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, account.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  async sendVerificationEmail(
    userId: string,
    email: string,
    name: string,
    options?: { adminInvite?: boolean },
  ): Promise<void> {
    const isAdminInvite = options?.adminInvite ?? false;

    const token = await this.jwtService.signAsync(
      { sub: userId, email, purpose: 'email-verification' },
      {
        secret: process.env.JWT_SECRET || 'secret',
        expiresIn: isAdminInvite ? '1d' : '15m',
      },
    );

    const verificationUrl = `${this.frontendUrl}/auth/verify-email?token=${token}`;

    if (isAdminInvite) {
      this.emailService.sendAdminInvitation(email, {
        userName: name,
        appName: 'Booklia',
        verificationUrl,
      });
    } else {
      this.emailService.sendEmailVerification(email, {
        userName: name,
        verificationUrl,
      });
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });

      if (payload.purpose !== 'email-verification') {
        throw new UnauthorizedException('Token invalide');
      }

      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { emailVerified: true },
      });

      return { success: true };
    } catch {
      throw new UnauthorizedException('Le lien de vérification est invalide ou a expiré');
    }
  }

  private async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: process.env.JWT_SECRET || 'secret',
          expiresIn: '1h',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
