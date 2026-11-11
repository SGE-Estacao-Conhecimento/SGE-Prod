-- Aplicar somente em bancos criados antes de 11/11/2026 (o 01_schema.sql ja inclui a coluna).
-- Nao altera dados existentes: usuarios ja cadastrados ficam com troca_senha_obrigatoria = FALSE.
-- Executar com conta de migracao (nao com sge_app).
ALTER TABLE usuarios
    ADD COLUMN troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT FALSE AFTER ativo;

