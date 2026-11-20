-- Aplicar somente em bancos criados antes de 19/11/2026 (o 01_schema.sql ja inclui as definicoes).
-- Cria a tabela de notificacoes persistidas por usuario com vinculo de acoes operacionais.
-- Nao altera dados existentes em outras tabelas.
-- Executar com conta de migracao (nao com sge_app).
--
-- Reversao:
-- DROP TABLE IF EXISTS notificacoes;

CREATE TABLE IF NOT EXISTS notificacoes (
    notificacao_id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    perfil_destino ENUM('admin', 'almoxarifado', 'funcionario') NOT NULL,
    categoria ENUM('pedido', 'estoque', 'patrimonio', 'sistema') NOT NULL DEFAULT 'pedido',
    tipo ENUM('info', 'sucesso', 'alerta', 'urgente') NOT NULL DEFAULT 'info',
    titulo VARCHAR(140) NOT NULL,
    mensagem VARCHAR(300) NOT NULL,
    link_acao VARCHAR(180) NULL,
    texto_acao VARCHAR(50) NULL,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    criada_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    lida_em TIMESTAMP(6) NULL,
    CONSTRAINT fk_notificacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
    INDEX idx_notificacoes_usuario_lida (usuario_id, lida, criada_em),
    INDEX idx_notificacoes_criada_em (criada_em)
) ENGINE=InnoDB;
