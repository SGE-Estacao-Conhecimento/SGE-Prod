-- Aplicar somente em bancos criados antes de 07/11/2026 (o 01_schema.sql já inclui a coluna).
-- Não altera dados existentes: todos os materiais continuam como consumo (FALSE).
-- Executar com conta de migração (não com sge_app).
ALTER TABLE produtos
    ADD COLUMN bem_duravel BOOLEAN NOT NULL DEFAULT FALSE AFTER permite_fracao;
