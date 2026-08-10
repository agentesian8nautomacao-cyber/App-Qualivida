-- migrations/008_admin_audit_logs.sql
-- Trilha mínima de auditoria para ações administrativas (ex.: financeiro/boletos).

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  actor_role text NULL,
  actor_username text NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at_desc
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_user_id
  ON public.admin_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
  ON public.admin_audit_logs (action);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: qualquer usuário autenticado pode inserir, mas apenas “por si mesmo”.
DROP POLICY IF EXISTS "admin_audit_logs_insert_own" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert_own"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_user_id);

-- SELECT: apenas perfis administrativos (users/staff) conseguem ler logs.
DROP POLICY IF EXISTS "admin_audit_logs_select_admins" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admins"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND upper(coalesce(u.role,'')) IN (
          'SINDICO','SÍNDICO','ADMIN','ADMINISTRADOR','ADMINISTRADORA','DESENVOLVEDOR','DEVELOPER','DEV','PORTEIRO','PORTARIA','CABO_TURMA'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND upper(coalesce(s.role,'')) IN (
          'SINDICO','SÍNDICO','ADMIN','ADMINISTRADOR','ADMINISTRADORA','DESENVOLVEDOR','DEVELOPER','DEV','PORTEIRO','PORTARIA','CABO_TURMA'
        )
    )
  );

COMMIT;

