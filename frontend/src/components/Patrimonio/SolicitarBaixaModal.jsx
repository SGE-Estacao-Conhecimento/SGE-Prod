import React, { useState, useRef, useEffect } from 'react';
import './SolicitarBaixaModal.css';

const MOTIVOS_BAIXA = [
  { valor: 'avaria_irreparavel', rotulo: 'Avaria irreparavel' },
  { valor: 'sucata', rotulo: 'Sucata / Fim de vida util' },
  { valor: 'obsolescencia', rotulo: 'Obsolescencia tecnologica' },
  { valor: 'furto_extravio', rotulo: 'Furto ou extravio' },
  { valor: 'outro', rotulo: 'Outro motivo' }
];

const MAX_FOTOS = 5;
const MAX_TAMANHO_BYTES = 10 * 1024 * 1024; // 10MB
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

const formatarTamanho = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SolicitarBaixaModal = ({
  isOpen,
  item,
  onClose,
  onSubmit,
  isEnviando = false
}) => {
  const [motivo, setMotivo] = useState('avaria_irreparavel');
  const [justificativa, setJustificativa] = useState('');
  const [fotos, setFotos] = useState([]); // { file, previewUrl, id }
  const [erroLocal, setErroLocal] = useState(null);
  const fileInputRef = useRef(null);

  // Limpa previews ao desmontar ou trocar de fotos
  useEffect(() => {
    return () => {
      fotos.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [fotos]);

  useEffect(() => {
    if (isOpen) {
      setMotivo('avaria_irreparavel');
      setJustificativa('');
      setFotos([]);
      setErroLocal(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setErroLocal(null);

    const espacoDisponivel = MAX_FOTOS - fotos.length;
    if (espacoDisponivel <= 0) {
      setErroLocal(`Limite maximo de ${MAX_FOTOS} fotos ja atingido.`);
      e.target.value = '';
      return;
    }

    const novosArquivos = [];
    for (const file of files.slice(0, espacoDisponivel)) {
      if (!TIPOS_ACEITOS.includes(file.type)) {
        setErroLocal(`O arquivo "${file.name}" nao e valido. Formatos aceitos: JPG, PNG e WEBP.`);
        continue;
      }
      if (file.size > MAX_TAMANHO_BYTES) {
        setErroLocal(`O arquivo "${file.name}" excede o tamanho maximo permitido de 10 MB.`);
        continue;
      }
      novosArquivos.push({
        file,
        previewUrl: URL.createObjectURL(file),
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      });
    }

    setFotos((prev) => [...prev, ...novosArquivos]);
    e.target.value = '';
  };

  const handleRemoverFoto = (idParaRemover) => {
    setFotos((prev) => {
      const itemParaRemover = prev.find((f) => f.id === idParaRemover);
      if (itemParaRemover?.previewUrl) {
        URL.revokeObjectURL(itemParaRemover.previewUrl);
      }
      return prev.filter((f) => f.id !== idParaRemover);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErroLocal(null);

    const justTrimmed = justificativa.trim();
    if (!justTrimmed) {
      setErroLocal('Informe a justificativa textual para a solicitacao de baixa.');
      return;
    }

    if (justTrimmed.length > 2000) {
      setErroLocal('A justificativa nao pode exceder 2000 caracteres.');
      return;
    }

    if (fotos.length === 0) {
      setErroLocal('Anexe ao menos uma foto comprobatória do estado do bem.');
      return;
    }

    onSubmit({
      itemId: item.id,
      motivo,
      justificativa: justTrimmed,
      fotos: fotos.map((f) => f.file)
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-baixa-titulo">
      <div className="modal-baixa-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-baixa-header">
          <div className="modal-baixa-header-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div>
            <h3 id="modal-baixa-titulo" className="modal-baixa-title">Solicitar Baixa de Patrimonio</h3>
            <p className="modal-baixa-subtitle">Envie a solicitacao com justificativa e fotos para avaliacao administrativa.</p>
          </div>
          <button
            type="button"
            className="modal-baixa-close-btn"
            onClick={onClose}
            disabled={isEnviando}
            aria-label="Fechar modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-baixa-form">
          {/* Resumo do Bem */}
          <div className="modal-baixa-resumo">
            <div className="modal-baixa-resumo-item">
              <span className="resumo-label">Plaqueta / N. Patrimonio</span>
              <strong className="resumo-valor">{item.numeroPatrimonio || 'N/A'}</strong>
            </div>
            <div className="modal-baixa-resumo-item">
              <span className="resumo-label">Modelo / Descricao</span>
              <span className="resumo-valor">{item.nomePatrimonio || 'Nao informado'}</span>
            </div>
            <div className="modal-baixa-resumo-item">
              <span className="resumo-label">Localizacao / Ambiente</span>
              <span className="resumo-valor">{item.nomeAmbiente || 'Sem ambiente'}</span>
            </div>
            <div className="modal-baixa-resumo-item">
              <span className="resumo-label">Responsavel</span>
              <span className="resumo-valor">{item.nomeResponsavel || 'Sem responsavel'}</span>
            </div>
          </div>

          {/* Motivo da Baixa */}
          <div className="modal-baixa-field">
            <label htmlFor="baixa-motivo" className="field-label">
              Motivo da Baixa <span className="field-required">*</span>
            </label>
            <select
              id="baixa-motivo"
              className="field-select"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={isEnviando}
            >
              {MOTIVOS_BAIXA.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </div>

          {/* Justificativa */}
          <div className="modal-baixa-field">
            <div className="field-label-row">
              <label htmlFor="baixa-justificativa" className="field-label">
                Justificativa Detalhada <span className="field-required">*</span>
              </label>
              <span className="field-counter">{justificativa.length} / 2000</span>
            </div>
            <textarea
              id="baixa-justificativa"
              className="field-textarea"
              rows="3"
              placeholder="Descreva o estado do bem, motivo do descarte ou ocorrencia..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              maxLength={2000}
              disabled={isEnviando}
            />
          </div>

          {/* Anexos de Fotos */}
          <div className="modal-baixa-field">
            <div className="field-label-row">
              <label className="field-label">
                Fotos Comprobatórias <span className="field-required">*</span>
              </label>
              <span className="field-counter">{fotos.length} de {MAX_FOTOS} anexadas</span>
            </div>
            <p className="field-hint">
              Anexe de 1 a 5 fotos evidenciando as condicoes do exemplar (JPG, PNG ou WEBP ate 10 MB cada).
            </p>

            <div className="modal-baixa-fotos-grid">
              {fotos.map((f, idx) => (
                <div key={f.id} className="foto-thumbnail-wrap">
                  <img src={f.previewUrl} alt={`Foto ${idx + 1}`} className="foto-thumbnail-img" />
                  <div className="foto-thumbnail-meta">
                    <span className="foto-name" title={f.file.name}>{f.file.name}</span>
                    <span className="foto-size">{formatarTamanho(f.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="foto-btn-remove"
                    onClick={() => handleRemoverFoto(f.id)}
                    title="Remover foto"
                    disabled={isEnviando}
                    aria-label={`Remover foto ${f.file.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}

              {fotos.length < MAX_FOTOS && (
                <button
                  type="button"
                  className="foto-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isEnviando}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="dropzone-text">Adicionar Foto</span>
                  <span className="dropzone-subtext">Clique para selecionar</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={isEnviando}
            />
          </div>

          {erroLocal && (
            <div className="modal-baixa-alert-erro" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{erroLocal}</span>
            </div>
          )}

          <div className="modal-baixa-actions">
            <button
              type="button"
              className="btn-cancelar"
              onClick={onClose}
              disabled={isEnviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-confirmar-baixa"
              disabled={isEnviando}
            >
              {isEnviando ? (
                <>
                  <span className="spinner-inline" aria-hidden="true" />
                  <span>Enviando Solicitacao...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Enviar Pedido de Baixa</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SolicitarBaixaModal;
