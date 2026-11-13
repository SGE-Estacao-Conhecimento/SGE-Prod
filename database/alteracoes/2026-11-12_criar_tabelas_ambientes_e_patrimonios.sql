-- Aplicar somente em bancos criados antes de 12/11/2026 (o 01_schema.sql ja inclui as tabelas).
-- Nao altera dados existentes: cria tabelas independentes para Ambientes e Gestao Patrimonial.
-- Executar com conta de migracao (nao com sge_app).

CREATE TABLE IF NOT EXISTS ambientes (
    ambiente_id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    setor VARCHAR(100) NULL,
    descricao VARCHAR(255) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patrimonios (
    patrimonio_id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    marca VARCHAR(100) NULL,
    modelo VARCHAR(100) NULL,
    descricao VARCHAR(500) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_patrimonio_categoria (categoria)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patrimonio_itens (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    patrimonio_id INT NOT NULL,
    numero_patrimonio VARCHAR(50) NOT NULL UNIQUE,
    numero_serie VARCHAR(100) NULL,
    ambiente_id INT NULL,
    responsavel_usuario_id INT NULL,
    estado_conservacao ENUM('novo', 'bom', 'regular', 'danificado', 'em_manutencao') NOT NULL DEFAULT 'bom',
    status ENUM('ativo', 'em_manutencao', 'baixado') NOT NULL DEFAULT 'ativo',
    data_aquisicao DATE NULL,
    observacoes VARCHAR(500) NULL,
    data_cadastro TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_patrimonio_itens_patrimonio FOREIGN KEY (patrimonio_id) REFERENCES patrimonios(patrimonio_id) ON DELETE CASCADE,
    CONSTRAINT fk_patrimonio_itens_ambiente FOREIGN KEY (ambiente_id) REFERENCES ambientes(ambiente_id) ON DELETE SET NULL,
    CONSTRAINT fk_patrimonio_itens_responsavel FOREIGN KEY (responsavel_usuario_id) REFERENCES usuarios(usuario_id) ON DELETE SET NULL,
    INDEX idx_patrimonio_itens_ambiente (ambiente_id),
    INDEX idx_patrimonio_itens_responsavel (responsavel_usuario_id),
    INDEX idx_patrimonio_itens_status (status)
) ENGINE=InnoDB;

