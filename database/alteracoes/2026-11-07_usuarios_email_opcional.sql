-- Aplicar somente em bancos criados antes desta alteração (o 01_schema.sql já a inclui).
-- O e-mail passa a ser opcional (o login também aceita CPF). Continua único quando preenchido.
-- Não altera dados existentes. Executar com conta de migração (não com sge_app).
ALTER TABLE usuarios
    MODIFY COLUMN email VARCHAR(150) NULL;
