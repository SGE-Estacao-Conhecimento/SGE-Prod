-- Aplicar somente em bancos criados antes de 09/11/2026 (o 01_schema.sql ja inclui a coluna).
-- Nao altera dados existentes: produtos existentes assumem 'Almoxarifado Central'.
-- Executar com conta de migracao (nao com sge_app).
ALTER TABLE produtos
    ADD COLUMN complexo VARCHAR(100) NOT NULL DEFAULT 'Almoxarifado Central' AFTER unidade_medida;

