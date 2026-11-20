-- Aplicar somente em bancos criados antes de 20/11/2026 (o 01_schema.sql ja inclui as definicoes).
-- Cria as tabelas previsoes_estoque e fila_recalculo_previsao para o dashboard analitico e preditivo.
-- Nao altera dados existentes em outras tabelas.
-- Executar com conta de migracao (nao com sge_app).
--
-- Reversao:
-- DROP TABLE IF EXISTS fila_recalculo_previsao;
-- DROP TABLE IF EXISTS previsoes_estoque;

CREATE TABLE IF NOT EXISTS previsoes_estoque (
    produto_id INT NOT NULL PRIMARY KEY,
    estoque_considerado DECIMAL(15,3) NOT NULL,
    estoque_minimo_considerado DECIMAL(15,3) NOT NULL,
    consumo_diario_ponderado DECIMAL(15,4) NOT NULL,
    dias_cobertura DECIMAL(10,2) NULL,
    dias_cobertura_minimo DECIMAL(10,2) NULL,
    data_prevista_estoque_minimo DATETIME(6) NULL,
    data_prevista_ruptura DATETIME(6) NULL,
    nivel_risco VARCHAR(30) NOT NULL,
    confianca VARCHAR(20) NOT NULL,
    score_confianca DECIMAL(5,2) NULL,
    tendencia_consumo VARCHAR(20) NOT NULL DEFAULT 'estavel',
    historico_inicio DATETIME(6) NOT NULL,
    historico_fim DATETIME(6) NOT NULL,
    calculado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    versao_algoritmo VARCHAR(20) NOT NULL DEFAULT '1.0',
    CONSTRAINT fk_previsoes_estoque_produto FOREIGN KEY (produto_id) REFERENCES produtos(produto_id) ON DELETE CASCADE,
    INDEX idx_previsoes_nivel_risco (nivel_risco),
    INDEX idx_previsoes_calculado_em (calculado_em),
    INDEX idx_previsoes_dias_cobertura (dias_cobertura)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fila_recalculo_previsao (
    produto_id INT NOT NULL PRIMARY KEY,
    versao_pendente BIGINT NOT NULL DEFAULT 1,
    solicitado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    tentativas INT NOT NULL DEFAULT 0,
    proxima_tentativa_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    bloqueado_ate DATETIME(6) NULL,
    ultimo_erro TEXT NULL,
    CONSTRAINT fk_fila_recalculo_produto FOREIGN KEY (produto_id) REFERENCES produtos(produto_id) ON DELETE CASCADE,
    INDEX idx_fila_processamento (bloqueado_ate, proxima_tentativa_em, tentativas),
    INDEX idx_fila_solicitado_em (solicitado_em)
) ENGINE=InnoDB;
