import { supabase } from './supabase';
import { checkUserSession } from './userAuth';

export type AdminAuditEntityType =
  | 'boletos'
  | 'financeiro'
  | 'residents'
  | 'staff'
  | 'users'
  | 'settings'
  | 'storage'
  | 'other';

export type AdminAuditAction =
  | 'BOLETO_CREATE'
  | 'BOLETO_UPDATE'
  | 'BOLETO_DELETE'
  | 'BOLETO_PDF_UPLOAD'
  | 'BOLETO_PDF_DOWNLOAD'
  | 'FINANCE_EXPORT'
  | 'FINANCE_IMPORT'
  | 'ADMIN_SETTINGS_CHANGE'
  | 'ACCOUNT_RECOVERY'
  | 'OTHER';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export async function logAdminAudit(event: {
  action: AdminAuditAction | (string & {});
  entityType: AdminAuditEntityType | (string & {});
  entityId?: string | null;
  message?: string | null;
  metadata?: Record<string, JsonValue> | null;
}) {
  try {
    // Sem Auth ativo não há como garantir identidade; não logar.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    const sessionUser = checkUserSession();
    const actorRole = sessionUser?.role ? String(sessionUser.role).toUpperCase() : null;
    const actorUsername = sessionUser?.username ? String(sessionUser.username) : null;

    const payload = {
      actor_user_id: user.id,
      actor_role: actorRole,
      actor_username: actorUsername,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      message: event.message ?? null,
      metadata: {
        ...(event.metadata || {}),
        app_pathname: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        logged_at: new Date().toISOString(),
      } satisfies Record<string, JsonValue>,
    };

    await supabase.from('admin_audit_logs').insert(payload);
  } catch {
    // best-effort: auditoria não pode quebrar fluxos críticos
  }
}

