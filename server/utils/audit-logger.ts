import { db } from '../db';
import { auditLogs } from '@shared/schema';

export async function auditLog(event: {
  userId: string | null;
  action: string;
  detail?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: event.userId,
      action: event.action,
      detail: event.detail ?? {},
      ip: event.ip ?? null,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}
