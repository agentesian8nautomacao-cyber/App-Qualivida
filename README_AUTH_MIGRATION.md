# Auth migration & SMTP checklist (Qualivida)

Resumo rápido de passos para auditoria, migração e verificação SMTP.

1) Variáveis de ambiente necessárias
- DATABASE_URL
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_SMTP_PASS
- SENDER_EMAIL (ex: no-reply@send.phmsdev.com.br)
- RESET_REDIRECT_URL

2) Rodar migration SQL:
   psql $DATABASE_URL -f migrations/0001_add_auth_user_id.sql

3) Popular auth_user_id:
   node scripts/migrate_missing_auth_user_id.js

4) Testar SMTP:
   npm install nodemailer
   RESEND_SMTP_PASS=sk_xxx TEST_TO=seu@dominio.com SENDER_EMAIL=no-reply@send.phmsdev.com.br node scripts/test_smtp_resend.js

5) Depois de validar que todas as linhas têm auth_user_id, aplicar FK e NOT NULL (veja comentários no arquivo SQL).

6) Testes finais:
- resetPasswordForEmail no frontend
- login com supabase.auth.signInWithPassword
- verificar Auth logs no Supabase Console

