-- Aplicar somente em bancos criados antes de 09/11/2026 (o 01_schema.sql ja inclui a coluna e o trigger atualizado).
-- Nao altera dados existentes: recebimentos existentes ficam com recebimento_origem_id = NULL.
-- Executar com conta de migracao (nao com sge_app).
ALTER TABLE recebimentos
    ADD COLUMN recebimento_origem_id INT NULL AFTER identificador_operacao,
    ADD CONSTRAINT fk_recebimentos_origem FOREIGN KEY (recebimento_origem_id) REFERENCES recebimentos(recebimento_id) ON DELETE RESTRICT,
    ADD INDEX idx_recebimento_origem (recebimento_origem_id);

DROP TRIGGER IF EXISTS trg_recebimentos_exige_foto;

DELIMITER $$
CREATE TRIGGER trg_recebimentos_exige_foto
BEFORE UPDATE ON recebimentos
FOR EACH ROW
BEGIN
    IF NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
        IF NOT EXISTS (
            SELECT 1 FROM recebimento_anexos
             WHERE (recebimento_id = OLD.recebimento_id
                    OR (OLD.recebimento_origem_id IS NOT NULL AND recebimento_id = OLD.recebimento_origem_id))
               AND categoria = 'foto_material'
               AND status = 'confirmado'
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Recebimento exige ao menos uma foto do material confirmada.';
        END IF;
    END IF;
END$$
DELIMITER ;

