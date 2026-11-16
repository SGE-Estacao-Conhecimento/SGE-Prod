-- Aplicar somente em bancos criados antes de 16/11/2026 (o 01_schema.sql ja inclui as definicoes).
-- Altera a coluna status de patrimonio_itens para incluir 'aguardando_baixa' e cria tabelas
-- de pedidos de baixa e anexos fotograficos comprobatórios.
-- Executar com conta de migracao (nao com sge_app).
--
-- Reversao:
-- DROP TABLE IF EXISTS pedido_baixa_anexos;
-- DROP TABLE IF EXISTS pedidos_baixa_patrimonio;
-- ALTER TABLE patrimonio_itens MODIFY COLUMN status ENUM('ativo', 'em_manutencao', 'baixado') NOT NULL DEFAULT 'ativo';

ALTER TABLE patrimonio_itens
    MODIFY COLUMN status ENUM('ativo', 'em_manutencao', 'baixado', 'aguardando_baixa') NOT NULL DEFAULT 'ativo';

CREATE TABLE IF NOT EXISTS pedidos_baixa_patrimonio (
    pedido_baixa_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    usuario_solicitante_id INT NOT NULL,
    motivo ENUM('avaria_irreparavel', 'sucata', 'obsolescencia', 'furto_extravio', 'outro') NOT NULL,
    justificativa TEXT NOT NULL,
    status ENUM('pendente', 'aprovado', 'recusado') NOT NULL DEFAULT 'pendente',
    usuario_deliberacao_id INT NULL,
    parecer_administracao TEXT NULL,
    data_solicitacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    data_deliberacao TIMESTAMP(6) NULL,
    CONSTRAINT fk_pedidos_baixa_item FOREIGN KEY (item_id) REFERENCES patrimonio_itens(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_pedidos_baixa_solicitante FOREIGN KEY (usuario_solicitante_id) REFERENCES usuarios(usuario_id),
    CONSTRAINT fk_pedidos_baixa_deliberador FOREIGN KEY (usuario_deliberacao_id) REFERENCES usuarios(usuario_id),
    INDEX idx_pedidos_baixa_item (item_id),
    INDEX idx_pedidos_baixa_status (status),
    INDEX idx_pedidos_baixa_solicitante (usuario_solicitante_id),
    INDEX idx_pedidos_baixa_data_solicitacao (data_solicitacao)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedido_baixa_anexos (
    anexo_id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_baixa_id INT NOT NULL,
    r2_chave VARCHAR(255) NOT NULL,
    nome_original VARCHAR(255) NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    usuario_envio_id INT NOT NULL,
    data_cadastro TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_baixa_anexos_pedido FOREIGN KEY (pedido_baixa_id) REFERENCES pedidos_baixa_patrimonio(pedido_baixa_id) ON DELETE CASCADE,
    CONSTRAINT fk_baixa_anexos_usuario FOREIGN KEY (usuario_envio_id) REFERENCES usuarios(usuario_id),
    INDEX idx_baixa_anexos_pedido (pedido_baixa_id),
    INDEX idx_baixa_anexos_chave (r2_chave)
) ENGINE=InnoDB;
