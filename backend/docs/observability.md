# Observability

The backend includes built-in observability: health check, structured logging, request logging, error logging, and a metrics endpoint. All features are enabled by default — no additional configuration needed.

## Health Check

**Endpoint:** `GET /api/v1/healthz`

Returns 200 when the app and database are reachable, 503 when the database is down.

```bash
curl http://localhost:3000/api/v1/healthz
```

Response (200):

```json
{ "status": "ok", "database": "connected", "timestamp": "2026-07-17T10:00:00.000Z" }
```

Response (503):

```json
{ "status": "error", "database": "unreachable", "timestamp": "2026-07-17T10:00:00.000Z" }
```

The endpoint does not require authentication and is NOT logged (to reduce noise).

---

## Log Level

Configure log verbosity via the `LOG_LEVEL` environment variable in `backend/.env`:

| Value   | Shows                                      |
|---------|--------------------------------------------|
| `debug` | debug, verbose, log, warn, error           |
| `info`  | log, warn, error (default)                 |
| `warn`  | warn, error                                |
| `error` | error only                                 |

### Prisma Query Logging

When `NODE_ENV=development`, Prisma logs all queries, errors, and warnings. In production, only errors are logged.

---

## Request Logging

Every HTTP request is logged by a global interceptor with the format:

```
[Nest] 12345  - 07/17/2026, 10:00:00 AM [HTTP] POST /api/v1/auth/password-login 200 45ms
```

The following paths are excluded to reduce noise:
- `/api/v1/healthz`
- `/api/v1/metrics`

---

## Error Logging

Unhandled exceptions are caught by `AllExceptionsFilter` and logged with full context:

```
[ExceptionsFilter] GET /api/v1/plans/unknown 404 - User: abc123 - Plan not found
```

Server errors (500+) include the full stack trace.

---

## Service-Level Logging

Key services log important events:

| Service           | Events Logged                                      |
|-------------------|----------------------------------------------------|
| `AuthService`     | Password login (success/failure), dev login, password change, invalid refresh token |
| `NotificationsService` | Notification marked as read, all marked as read |
| `PlansService`    | Plan created, submitted, approved                  |
| `AppController`   | Health check database failures                     |

---

## Metrics

**Endpoint:** `GET /api/v1/metrics`

Returns in-memory request metrics (no external dependencies):

```bash
curl http://localhost:3000/api/v1/metrics
```

Response:

```json
{
  "requests": {
    "POST /api/v1/auth/password-login": { "count": 5, "avgDuration": 120.5 },
    "GET /api/v1/plans": { "count": 12, "avgDuration": 45.2 },
    "GET /api/v1/notifications": { "count": 3, "avgDuration": 30.1 }
  },
  "uptime": 3600,
  "timestamp": "2026-07-17T10:00:00.000Z"
}
```

The `/metrics` endpoint itself is not measured or logged.

### Prometheus Integration

To scrape metrics into Prometheus, add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'rbap-idm-backend'
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics'
    static_configs:
      - targets: ['localhost:3000']
```

> Note: The metrics endpoint returns JSON, not the Prometheus text format. For production, consider upgrading to `prom-client` for native Prometheus exposition format.

---

## Log Output Reference

All logs written via NestJS `Logger` use the default NestJS format:

```
[Nest] ${pid}  - ${timestamp} ${level} [${context}] ${message}
```

To parse logs with external tools, pipe to a JSON formatter or use a log aggregator. Example grep to find errors:

```bash
npm run start:dev | findstr "ERROR"
```
