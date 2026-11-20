-- Aplicar somente em bancos criados antes de 20/11/2026 (o 01_schema.sql ja inclui as definicoes).
-- Cria indices de performance para otimizacao das consultas analiticas do dashboard executivo.
-- Nao altera dados existentes em tabelas.
-- Executar com conta de migracao (nao com sge_app).
--
-- Reversao:
-- ALTER TABLE pedidos DROP INDEX idx_pedidos_status_atendimento;

SET @dbname = DATABASE();

-- 1. Indice composto em pedidos (status, data_atendimento)
SET @tablename = 'pedidos';
SET @indexname = 'idx_pedidos_status_atendimento';

SET @stmt = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE pedidos ADD INDEX idx_pedidos_status_atendimento (status, data_atendimento);',
        'SELECT ''Indice idx_pedidos_status_atendimento ja existe em pedidos.'' AS info;'
    )
    FROM information_schema.statistics
    WHERE table_schema = @dbname
      AND table_name = @tablename
      AND index_name = @indexname
);

PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Indice em pedido_itens (pedido_id, produto_id) - verifica existencia ou cobertura equivalente
SET @tablename = 'pedido_itens';
SET @indexname = 'idx_pedido_itens_pedido_produto';

SET @stmt = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE pedido_itens ADD INDEX idx_pedido_itens_pedido_produto (pedido_id, produto_id);',
        'SELECT ''Indice para (pedido_id, produto_id) ja existe em pedido_itens.'' AS info;'
    )
    FROM information_schema.statistics
    WHERE table_schema = @dbname
      AND table_name = @tablename
      AND (index_name = @indexname OR (column_name = 'pedido_id' AND seq_in_index = 1))
);

PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Indice em pedido_logs (pedido_id, data_log) - verifica existencia de idx_pedido_logs_pedido_data ou idx_pedido_log
SET @tablename = 'pedido_logs';
SET @indexname = 'idx_pedido_logs_pedido_data';

SET @stmt = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE pedido_logs ADD INDEX idx_pedido_logs_pedido_data (pedido_id, data_log);',
        'SELECT ''Indice para (pedido_id, data_log) ja existe em pedido_logs.'' AS info;'
    )
    FROM information_schema.statistics
    WHERE table_schema = @dbname
      AND table_name = @tablename
      AND (index_name = @indexname OR index_name = 'idx_pedido_log')
);

PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
