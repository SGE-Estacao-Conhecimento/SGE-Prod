SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE setores (
    setor_id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE funcionarios (
    funcionario_id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    setor_id INT NOT NULL,
    -- CPF somente com dígitos. O front-end o exige no cadastro de usuário e aceita como login ("E-mail ou CPF").
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
    celular VARCHAR(20),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (setor_id) REFERENCES setores(setor_id) ON DELETE RESTRICT,
    CHECK (cpf IS NULL OR cpf REGEXP '^[0-9]{11}$')
) ENGINE=InnoDB;

CREATE TABLE usuarios (
    usuario_id INT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NULL UNIQUE,
    -- E-mail opcional (tela de cadastro); quem não tiver entra pelo CPF. Único quando preenchido.
    email VARCHAR(150) NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil ENUM('admin','almoxarifado','funcionario') NOT NULL DEFAULT 'funcionario',
    ultimo_login TIMESTAMP(6) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(funcionario_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE produtos (
    produto_id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    categoria VARCHAR(100) NULL,
    unidade_medida VARCHAR(20) NOT NULL,
    localizacao VARCHAR(150) NULL,
    descricao VARCHAR(500) NULL,
    permite_fracao BOOLEAN NOT NULL DEFAULT FALSE,
    -- Bem durável/patrimônio (aba "Bens Duráveis" do almoxarifado): entregue sem baixa de saldo.
    bem_duravel BOOLEAN NOT NULL DEFAULT FALSE,
    quantidade DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantidade_minima DECIMAL(15,3) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CHECK (quantidade >= 0),
    CHECK (quantidade_minima >= 0),
    CHECK (permite_fracao OR (quantidade = FLOOR(quantidade)
        AND quantidade_minima = FLOOR(quantidade_minima)))
) ENGINE=InnoDB;

CREATE TABLE recebimentos (
    recebimento_id INT AUTO_INCREMENT PRIMARY KEY,
    identificador_operacao CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    tipo_origem ENUM('compra','doacao','outro') NOT NULL,
    origem_nome VARCHAR(200) NOT NULL,
    origem_documento VARCHAR(30),
    funcionario_recebe_id INT NOT NULL,
    usuario_registro_id INT NOT NULL,
    data_recebimento DATETIME(6) NOT NULL,
    observacao TEXT,
    status ENUM('preparacao','confirmado','cancelado') NOT NULL DEFAULT 'preparacao',
    usuario_confirmacao_id INT NULL,
    data_confirmacao DATETIME(6) NULL,
    data_registro TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (funcionario_recebe_id) REFERENCES funcionarios(funcionario_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_registro_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_confirmacao_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    CHECK (CHAR_LENGTH(TRIM(origem_nome)) > 0),
    CHECK ((status = 'confirmado' AND usuario_confirmacao_id IS NOT NULL AND data_confirmacao IS NOT NULL)
        OR (status <> 'confirmado' AND usuario_confirmacao_id IS NULL AND data_confirmacao IS NULL)),
    INDEX idx_recebimento_data (data_recebimento)
) ENGINE=InnoDB;

CREATE TABLE recebimento_itens (
    recebimento_item_id INT AUTO_INCREMENT PRIMARY KEY,
    recebimento_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade DECIMAL(15,3) NOT NULL,
    FOREIGN KEY (recebimento_id) REFERENCES recebimentos(recebimento_id) ON DELETE RESTRICT,
    FOREIGN KEY (produto_id) REFERENCES produtos(produto_id) ON DELETE RESTRICT,
    UNIQUE (recebimento_id, produto_id),
    CHECK (quantidade > 0)
) ENGINE=InnoDB;

CREATE TABLE documentos_recebimento (
    documento_id INT AUTO_INCREMENT PRIMARY KEY,
    recebimento_id INT NOT NULL,
    tipo ENUM('nota_fiscal','termo_doacao','recibo','outro') NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    numero VARCHAR(60),
    serie VARCHAR(20),
    emitente_nome VARCHAR(200),
    emitente_documento VARCHAR(30),
    data_emissao DATE,
    chave_acesso VARCHAR(44) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
    data_registro TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (recebimento_id) REFERENCES recebimentos(recebimento_id) ON DELETE RESTRICT,
    UNIQUE (documento_id, recebimento_id),
    INDEX idx_documento_recebimento (recebimento_id)
) ENGINE=InnoDB;

-- Fotos do material e arquivos dos documentos. O arquivo fica no Cloudflare R2
-- (bucket privado); aqui ficam apenas os metadados.
-- Foto é obrigatória só no recebimento inicial do almoxarifado: pedidos internos não usam fotos.
CREATE TABLE recebimento_anexos (
    anexo_id INT AUTO_INCREMENT PRIMARY KEY,
    recebimento_id INT NOT NULL,
    documento_id INT NULL,
    categoria ENUM('foto_material','documento') NOT NULL,
    r2_chave VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    nome_original VARCHAR(255),
    tipo_mime VARCHAR(100) NOT NULL,
    tamanho_bytes BIGINT UNSIGNED NOT NULL,
    sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    status ENUM('pendente','confirmado','removido') NOT NULL DEFAULT 'pendente',
    usuario_envio_id INT NOT NULL,
    data_envio TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    data_confirmacao_upload DATETIME(6) NULL,
    FOREIGN KEY (recebimento_id) REFERENCES recebimentos(recebimento_id) ON DELETE RESTRICT,
    FOREIGN KEY (documento_id, recebimento_id) REFERENCES documentos_recebimento(documento_id, recebimento_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_envio_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    CHECK (tamanho_bytes > 0),
    CHECK (categoria = 'documento' OR documento_id IS NULL),
    CHECK ((status = 'confirmado' AND data_confirmacao_upload IS NOT NULL) OR status <> 'confirmado'),
    INDEX idx_anexo_recebimento (recebimento_id, categoria, status)
) ENGINE=InnoDB;

CREATE TABLE pedidos (
    pedido_id INT AUTO_INCREMENT PRIMARY KEY,
    identificador_operacao CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    funcionario_solicitante_id INT NOT NULL,
    setor_id INT NOT NULL,
    usuario_solicitacao_id INT NOT NULL,
    -- Fluxo do front-end: Pendente -> Em Separação -> Pronto para Retirada -> Atendido (ou Cancelado).
    -- "Atendido Parcialmente" é derivado de pedido_itens.quantidade_entregue < quantidade_solicitada.
    status ENUM('pendente','em_separacao','pronto_retirada','atendido','cancelado') NOT NULL DEFAULT 'pendente',
    urgencia ENUM('normal','alta') NOT NULL DEFAULT 'normal',
    observacao TEXT,
    usuario_atendimento_id INT NULL,
    funcionario_recebe_id INT NULL,
    data_pedido TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    data_atendimento DATETIME(6) NULL,
    FOREIGN KEY (funcionario_solicitante_id) REFERENCES funcionarios(funcionario_id) ON DELETE RESTRICT,
    FOREIGN KEY (setor_id) REFERENCES setores(setor_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_solicitacao_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_atendimento_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    FOREIGN KEY (funcionario_recebe_id) REFERENCES funcionarios(funcionario_id) ON DELETE RESTRICT,
    CHECK ((status = 'atendido' AND usuario_atendimento_id IS NOT NULL
            AND funcionario_recebe_id IS NOT NULL AND data_atendimento IS NOT NULL)
        OR (status <> 'atendido' AND data_atendimento IS NULL)),
    INDEX idx_pedido_status_data (status, data_pedido),
    INDEX idx_pedido_solicitante (funcionario_solicitante_id, data_pedido)
) ENGINE=InnoDB;

CREATE TABLE pedido_itens (
    pedido_item_id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade_solicitada DECIMAL(15,3) NOT NULL,
    quantidade_entregue DECIMAL(15,3) NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(pedido_id) ON DELETE RESTRICT,
    FOREIGN KEY (produto_id) REFERENCES produtos(produto_id) ON DELETE RESTRICT,
    UNIQUE (pedido_id, produto_id),
    CHECK (quantidade_solicitada > 0),
    CHECK (quantidade_entregue IS NULL OR (quantidade_entregue >= 0 AND quantidade_entregue <= quantidade_solicitada))
) ENGINE=InnoDB;

-- Materiais favoritos de cada usuário (catálogo do perfil Usuário).
CREATE TABLE favoritos (
    usuario_id INT NOT NULL,
    produto_id INT NOT NULL,
    data_criacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (usuario_id, produto_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(produto_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Log de pedidos: somente inserção (sem fotos). Um registro por mudança de situação ou ocorrência.
CREATE TABLE pedido_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    status_anterior ENUM('pendente','em_separacao','pronto_retirada','atendido','cancelado') NULL,
    status_novo ENUM('pendente','em_separacao','pronto_retirada','atendido','cancelado') NOT NULL,
    usuario_id INT NOT NULL,
    descricao VARCHAR(500),
    data_log TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (pedido_id) REFERENCES pedidos(pedido_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    INDEX idx_pedido_log (pedido_id, data_log)
) ENGINE=InnoDB;

-- Histórico de estoque. O saldo atual fica em produtos.quantidade e deve ser
-- atualizado pela API na mesma transação que insere a movimentação.
CREATE TABLE movimentacoes_estoque (
    movimentacao_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    tipo ENUM('entrada_recebimento','saida_pedido','estorno','ajuste') NOT NULL,
    sentido ENUM('entrada','saida') NOT NULL,
    quantidade DECIMAL(15,3) NOT NULL,
    saldo_apos DECIMAL(15,3) NOT NULL,
    recebimento_item_id INT NULL UNIQUE,
    pedido_item_id INT NULL UNIQUE,
    movimentacao_estornada_id BIGINT NULL UNIQUE,
    usuario_id INT NOT NULL,
    motivo VARCHAR(255),
    data_movimentacao TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (produto_id) REFERENCES produtos(produto_id) ON DELETE RESTRICT,
    FOREIGN KEY (recebimento_item_id) REFERENCES recebimento_itens(recebimento_item_id) ON DELETE RESTRICT,
    FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(pedido_item_id) ON DELETE RESTRICT,
    FOREIGN KEY (movimentacao_estornada_id) REFERENCES movimentacoes_estoque(movimentacao_id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT,
    CHECK (quantidade > 0),
    CHECK (saldo_apos >= 0),
    CHECK ((tipo = 'entrada_recebimento' AND sentido = 'entrada' AND recebimento_item_id IS NOT NULL
            AND pedido_item_id IS NULL AND movimentacao_estornada_id IS NULL)
        OR (tipo = 'saida_pedido' AND sentido = 'saida' AND pedido_item_id IS NOT NULL
            AND recebimento_item_id IS NULL AND movimentacao_estornada_id IS NULL)
        OR (tipo = 'estorno' AND movimentacao_estornada_id IS NOT NULL AND motivo IS NOT NULL
            AND recebimento_item_id IS NULL AND pedido_item_id IS NULL)
        OR (tipo = 'ajuste' AND motivo IS NOT NULL
            AND recebimento_item_id IS NULL AND pedido_item_id IS NULL AND movimentacao_estornada_id IS NULL)),
    INDEX idx_mov_produto_data (produto_id, data_movimentacao)
) ENGINE=InnoDB;

DELIMITER $$

-- Recebimento só nasce em preparação e só é confirmado com pelo menos uma foto do material já enviada ao R2.
CREATE TRIGGER trg_recebimentos_insert_preparacao
BEFORE INSERT ON recebimentos
FOR EACH ROW
BEGIN
    IF NEW.status = 'confirmado' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Recebimento deve ser criado em preparacao e confirmado depois, com foto.';
    END IF;
END$$

CREATE TRIGGER trg_recebimentos_exige_foto
BEFORE UPDATE ON recebimentos
FOR EACH ROW
BEGIN
    IF NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
        IF NOT EXISTS (SELECT 1 FROM recebimento_anexos
                        WHERE recebimento_id = OLD.recebimento_id
                          AND categoria = 'foto_material'
                          AND status = 'confirmado') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Recebimento exige ao menos uma foto do material confirmada.';
        END IF;
    END IF;
END$$

-- Logs de pedido não podem ser alterados nem apagados.
CREATE TRIGGER trg_pedido_logs_no_update
BEFORE UPDATE ON pedido_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pedido_logs e somente insercao.';
END$$

CREATE TRIGGER trg_pedido_logs_no_delete
BEFORE DELETE ON pedido_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pedido_logs e somente insercao.';
END$$

DELIMITER ;