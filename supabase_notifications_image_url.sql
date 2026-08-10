-- ============================================
-- MIGRAÇÃO: image_url em notificações de encomenda
-- ============================================
-- Permite anexar a imagem da encomenda na notificação quando o
-- registro foi feito via foto. Notificações antigas ou sem foto
-- permanecem apenas com texto (compatibilidade).
-- ============================================

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN notifications.image_url IS 'URL da imagem da encomenda quando o registro foi feito via foto (opcional)';
