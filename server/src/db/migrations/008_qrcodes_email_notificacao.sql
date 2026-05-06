-- Migration 008: adiciona email_notificacao à tabela qrcodes
-- Permite que o criador do QR Code informe um e-mail para receber
-- notificações automáticas sempre que um morador/visitante responder.

ALTER TABLE qrcodes
  ADD COLUMN IF NOT EXISTS email_notificacao VARCHAR(255);
