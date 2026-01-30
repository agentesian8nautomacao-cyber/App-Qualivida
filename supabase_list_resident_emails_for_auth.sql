-- ============================================
-- LISTAR E-MAILS DOS MORADORES (para cadastrar no Auth)
-- ============================================
-- Use esta lista para adicionar cada e-mail em:
-- Dashboard → Authentication → Users → Add user
-- Assim o "Esqueci minha senha" passará a enviar o e-mail.
-- Execute no Supabase: SQL Editor → New query → Run.
-- ============================================

SELECT
  id,
  name,
  unit,
  email,
  CASE WHEN email IS NOT NULL AND email != '' THEN 'Adicione este e-mail em Authentication → Users' ELSE 'Sem e-mail' END AS acao
FROM public.residents
WHERE email IS NOT NULL AND email != ''
ORDER BY unit;
