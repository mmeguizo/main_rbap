import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * Override handleRequest so that authentication failures during the
   * Google OAuth callback are **redirected** back to the Angular login
   * page with a human-readable error message instead of returning raw
   * JSON to the browser.
   */
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      console.error('GoogleAuthGuard Error:', { err, user, info });

      const message =
        err?.response?.message ??
        err?.message ??
        info?.message ??
        (typeof info === 'string' ? info : 'Authentication failed.');

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      const loginUrl = `${frontendUrl}/login?error=${encodeURIComponent(message)}`;

      const res = context.switchToHttp().getResponse();
      res.redirect(loginUrl);

      // Throw so NestJS does NOT invoke the route handler with req.user = undefined.
      // AllExceptionsFilter will catch this, see response.headersSent = true, and
      // return silently — no ERR_HTTP_HEADERS_SENT crash.
      throw err ?? new Error(message);
    }

    return user;
  }
}
