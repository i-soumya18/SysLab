import { NextFunction, Request, Response } from 'express';
import { getDatabase } from '../config/database';

type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_REGISTER'
  | 'WORKSPACE_CREATE'
  | 'WORKSPACE_UPDATE'
  | 'WORKSPACE_DELETE'
  | 'WORKSPACE_SHARE'
  | 'SUBSCRIPTION_UPDATE';

interface AuditContext {
  action: AuditAction;
}

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const parts = forwardedFor.split(',');
    return parts[0]?.trim() ?? null;
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0] ?? null;
  }

  return request.ip ?? null;
}

export function createAuditMiddleware(context: AuditContext) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const startTime = Date.now();

    response.on('finish', async () => {
      try {
        const durationMs = Date.now() - startTime;
        const userId = (request as Request & { userId?: string }).userId ?? null;
        const tenantIdHeader = request.headers['x-tenant-id'];
        const tenantId =
          typeof tenantIdHeader === 'string'
            ? tenantIdHeader
            : Array.isArray(tenantIdHeader)
              ? tenantIdHeader[0] ?? null
              : null;

        const client = await getDatabase().connect();

        try {
          await client.query(
            `
              INSERT INTO audit_logs (
                user_id,
                tenant_id,
                action,
                resource_path,
                http_method,
                status_code,
                ip_address,
                user_agent,
                metadata,
                duration_ms
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9, $10)
            `,
            [
              userId,
              tenantId,
              context.action,
              request.path,
              request.method,
              response.statusCode,
              getClientIp(request),
              request.headers['user-agent'] ?? null,
              {
                query: request.query,
                route: request.originalUrl,
              },
              durationMs,
            ],
          );
        } finally {
          client.release();
        }
      } catch (error) {
        // Audit logging must never break the main request flow
        // eslint-disable-next-line no-console
        console.error('Failed to write audit log entry:', error);
      }
    });

    next();
  };
}

