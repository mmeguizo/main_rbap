import { Injectable } from '@nestjs/common';

interface RouteMetric {
  count: number;
  totalDuration: number;
}

@Injectable()
export class MetricsService {
  private readonly routes = new Map<string, RouteMetric>();
  private readonly startTime = Date.now();

  record(method: string, path: string, duration: number) {
    const key = `${method} ${path}`;
    const existing = this.routes.get(key);
    if (existing) {
      existing.count++;
      existing.totalDuration += duration;
    } else {
      this.routes.set(key, { count: 1, totalDuration: duration });
    }
  }

  getSnapshot() {
    const requests: Record<string, { count: number; avgDuration: number }> = {};
    for (const [key, metric] of this.routes) {
      requests[key] = {
        count: metric.count,
        avgDuration: Math.round((metric.totalDuration / metric.count) * 100) / 100,
      };
    }
    return {
      requests,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
