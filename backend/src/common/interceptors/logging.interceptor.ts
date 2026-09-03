import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

const SKIP_PATHS = ['/healthz', '/api/v1/healthz', '/metrics', '/api/v1/metrics'];

// Also skip in the metrics interceptor so we don't measure /metrics calls

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = req;

    if (SKIP_PATHS.some((p) => originalUrl.startsWith(p))) {
      return next.handle();
    }

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - start;
        this.logger.log(`${method} ${originalUrl} ${res.statusCode} ${duration}ms`);
      }),
    );
  }
}
