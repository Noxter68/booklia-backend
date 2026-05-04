import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Auth guard for endpoints where the response is enriched when the caller is
 * logged in (e.g. loyalty pricing on slots) but stays public otherwise.
 * Sets request.user when a valid token is present, never throws.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return true;
    }

    try {
      request.user = await this.authService.validateToken(
        authHeader.substring(7),
      );
    } catch {
      // Invalid token: treat the request as anonymous rather than rejecting it.
    }
    return true;
  }
}
