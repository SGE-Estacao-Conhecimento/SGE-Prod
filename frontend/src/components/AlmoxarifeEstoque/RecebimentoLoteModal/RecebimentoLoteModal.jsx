import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BottomSheetModal } from '../../common';
import './RecebimentoLoteModal.css';

/**
 * Converte valor (string pt-BR com vírgula, com separador de milhar e vírgula, ou padrão com ponto)
 * para número de ponto flutuante sem confundir separadores decimais e de milhar.
 * Retorna NaN se valor for inválido, malformado, infinito ou vazio.
 */
export const parseQuantidade = (valor) => {
  if (valor === null || valor === undefined) return NaN;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  const str = String(valor).trim();
  if (str === '') return NaN;

  let normalizado = '';
  if (/^[+-]?\d+$/.test(str)) {
    normalizado = str;
  } else if (/^[+-]?\d+,\d+$/.test(str)) {
    normalizado = str.replace(',', '.');
  } else if (/^[+-]?\d+\.\d+$/.test(str)) {
    normalizado = str;
  } else if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(str)) {
    normalizado = str.replace(/\./g, '').replace(',', '.');
  } else {
    return NaN;
  }

  const num = Number(normalizado);
  return Number.isFinite(num) ? num : NaN;
};

/**
 * Formata quantidade numérica para apresentação sem truncamento arbitrário,
 * respeitando até 3 casas decimais (compatível com DECIMAL(15,3) do MySQL).
 */
export const formatarQuantidadeExibicao = (valor) => {
  if (valor === null || valor === undefined) return '0';
  const num = typeof valor === 'number' ? valor : parseQuantidade(valor);
  if (isNaN(num) || !Number.isFinite(num)) return '0';
  const arredondado = Math.round(num * 1000) / 1000;
  return arredondado.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
};

/**
 * RecebimentoLoteModal — Janela Flutuante de Entrada em Massa e Doações
 * 
 * Padrão Ouro Operacional do SGE em 2 Etapas:
 * - Etapa 1: Foco total na conferência física (Materiais, Volumes e Quantidades).
 * - Etapa 2: Documentação e comprovação (Origem, Doador/NF, Fotos com câmera e Finalização).
 * - Transição fluida e memória persistente em rascunho (pode minimizar e reabrir sem perdas).
 */
const RecebimentoLoteModal = ({
  isOpen,
  onClose,
  materiais = [],
  draftRemessa,
  onUpdateDraft,
  onConfirmar,
  onDescartar
}) => {
  // Controle do seletor rápido de materiais (drawer interno)
  const [isSeletorOpen, setIsSeletorOpen] = useState(false);
  const [buscaCatalogo, setBuscaCatalogo] = useState('');
  const [categoriaCatalogo, setCategoriaCatalogo] = useState('todas');
  const [isConfirmandoDescarte, setIsConfirmandoDescarte] = useState(false);
  const [isResumoAberto, setIsResumoAberto] = useState(false);

  // Referência para o popover flutuante de resumo e listener de clique fora
  const resumoPopoverRef = useRef(null);

  // Fecha o popover de materiais ao clicar/tocar fora dele (em cima da doação ou na tela)
  useEffect(() => {
    if (!isResumoAberto) return;
    const handleClickOutside = (e) => {
      if (
        resumoPopoverRef.current &&
        !resumoPopoverRef.current.contains(e.target) &&
        !e.target.closest('.recebimento-step2-summary-trigger')
      ) {
        setIsResumoAberto(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isResumoAberto]);

  // Dados do rascunho com valores padrão de segurança
  const {
    etapaAtual = 1,
    tipoOrigem = 'doacao',
    documentoDoador = '',
    observacao = '',
    itens = [],
    fotos = [],
    identificadorOperacao
  } = draftRemessa || {};

  const fotosInputRef = useRef(null);

  // Atualizador parcial do rascunho. Mudar materiais ou origem inicia uma nova operação de envio
  // (o identificador só é reaproveitado quando o mesmo rascunho é reenviado após uma falha).
  const updateDraft = (patch) => {
    if (onUpdateDraft) {
      const mudouConteudo = ['itens', 'tipoOrigem', 'documentoDoador', 'observacao'].some((campo) => campo in patch);
      onUpdateDraft({
        ...draftRemessa,
        ...(mudouConteudo ? { identificadorOperacao: undefined } : {}),
        ...patch
      });
    }
  };

  // Fotos do material (obrigatórias para confirmar o recebimento no servidor)
  const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
  const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;
  const MAXIMO_FOTOS = 10;

  const handleAdicionarFotos = (event) => {
    const selecionadas = Array.from(event.target.files || []);
    event.target.value = '';
    const validas = selecionadas.filter((arquivo) => TIPOS_FOTO.includes(arquivo.type) && arquivo.size <= TAMANHO_MAXIMO_FOTO);
    if (validas.length < selecionadas.length) {
      alert('Envie fotos nos formatos JPG, PNG ou WEBP, com até 10 MB cada.');
    }
    if (fotos.length + validas.length > MAXIMO_FOTOS) {
      alert(`Cada recebimento pode ter no máximo ${MAXIMO_FOTOS} fotos.`);
    }
    if (validas.length > 0) updateDraft({ fotos: [...fotos, ...validas].slice(0, MAXIMO_FOTOS) });
  };

  const handleRemoverFoto = (indice) => {
    updateDraft({ fotos: fotos.filter((_, i) => i !== indice) });
  };

  const setEtapa = (etapa) => {
    updateDraft({ etapaAtual: etapa });
  };

  // Alterna o tipo de entrada (Doação, Compra/NF, Outra Entrada)
  const handleTrocarTipoOrigem = (novoTipo) => {
    updateDraft({ tipoOrigem: novoTipo });
  };

  // Opções de Natureza da Entrada (Radio Cards)
  const opcoesOrigem = useMemo(
    () => [
      {
        id: 'doacao',
        label: 'Doação',
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        )
      },
      {
        id: 'compra_nf',
        label: 'Compra / NF',
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        )
      },
      {
        id: 'outros',
        label: 'Outra Entrada',
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        )
      }
    ],
    []
  );

  // Categorias únicas existentes para o filtro do catálogo
  const categoriasCatalogo = useMemo(() => {
    const setCats = new Set(materiais.map((m) => m.categoria).filter(Boolean));
    return ['todas', ...Array.from(setCats)];
  }, [materiais]);

  // Materiais filtrados para o Seletor Rápido
  const materiaisFiltrados = useMemo(() => {
    const termo = buscaCatalogo.trim().toLowerCase();
    return materiais.filter((m) => {
      const matchTexto =
        !termo ||
        m.nome.toLowerCase().includes(termo) ||
        (m.codigo && m.codigo.toLowerCase().includes(termo)) ||
        (m.categoria && m.categoria.toLowerCase().includes(termo));
      const matchCat =
        categoriaCatalogo === 'todas' || m.categoria === categoriaCatalogo;
      return matchTexto && matchCat;
    });
  }, [materiais, buscaCatalogo, categoriaCatalogo]);

  // Map de IDs de materiais que já estão no carrinho
  const idsNoCarrinho = useMemo(() => {
    return new Set(itens.map((i) => i.materialId));
  }, [itens]);

  // Alterna a inclusão de um material no carrinho
  const handleToggleMaterialNoCarrinho = (material) => {
    if (idsNoCarrinho.has(material.id)) {
      updateDraft({
        itens: itens.filter((i) => i.materialId !== material.id)
      });
    } else {
      const permiteFracao = Boolean(
        material.permiteFracao ??
        material.permite_fracao ??
        material.PermiteFracao
      );
      const saldoAtual = parseQuantidade(material.quantidade) || 0;
      const novoItemCarrinho = {
        materialId: material.id,
        codigo: material.codigo,
        nome: material.nome,
        unidade: material.unidade || 'UN',
        categoria: material.categoria || 'Geral',
        complexo: material.complexo || 'Almoxarifado Central',
        locacao: material.locacao || '',
        localizacao: material.localizacao || '',
        saldoAtual,
        qtdReceber: 1,
        permiteFracao,
        dataValidade: material.dataValidade || ''
      };
      updateDraft({
        itens: [...itens, novoItemCarrinho]
      });
    }
  };

  // Alteração da validade de um item do carrinho
  const handleMudarValidade = (materialId, novaValidade) => {
    updateDraft({
      itens: itens.map((item) =>
        item.materialId === materialId ? { ...item, dataValidade: novaValidade } : item
      )
    });
  };

  // Alteração da quantidade a receber de um item do carrinho via stepper
  const handleMudarQuantidade = (materialId, delta) => {
    updateDraft({
      itens: itens.map((item) => {
        if (item.materialId === materialId) {
          const permiteFracao = Boolean(
            item.permiteFracao ??
            materiais.find((m) => m.id === item.materialId)?.permiteFracao ??
            materiais.find((m) => m.id === item.materialId)?.permite_fracao
          );
          const atual = parseQuantidade(item.qtdReceber);
          const base = isNaN(atual) || atual <= 0 ? 0 : atual;
          const novo = delta > 0 ? base + 1 : Math.max(permiteFracao ? 0.001 : 1, base - 1);
          const arredondado = Math.round(novo * 1000) / 1000;
          return { ...item, qtdReceber: arredondado, permiteFracao };
        }
        return item;
      })
    });
  };

  // Digitação direta no input de quantidade (preserva a entrada digitada para validação fiel,
  // evitando converter silenciosamente negativos '-5' em '5' ou decimais '2,5' em '25' quando não fracionável)
  const handleInputQuantidade = (materialId, valorStr) => {
    updateDraft({
      itens: itens.map((item) => {
        if (item.materialId === materialId) {
          const permiteFracao = Boolean(
            item.permiteFracao ??
            materiais.find((m) => m.id === item.materialId)?.permiteFracao ??
            materiais.find((m) => m.id === item.materialId)?.permite_fracao
          );
          return {
            ...item,
            qtdReceber: valorStr,
            permiteFracao
          };
        }
        return item;
      })
    });
  };

  // Ao perder o foco, formata valores numéricos válidos sem converter inválidos silenciosamente
  const handleBlurQuantidade = (materialId) => {
    updateDraft({
      itens: itens.map((item) => {
        if (item.materialId === materialId) {
          const raw = String(item.qtdReceber ?? '').trim();
          if (raw === '') return item;
          const num = parseQuantidade(raw);
          if (isNaN(num) || !isFinite(num) || num <= 0) {
            // Preserva a entrada para acusar erro explicitamente na validação
            return item;
          }
          const permiteFracao = Boolean(
            item.permiteFracao ??
            materiais.find((m) => m.id === item.materialId)?.permiteFracao ??
            materiais.find((m) => m.id === item.materialId)?.permite_fracao
          );
          if (!permiteFracao) {
            return Number.isInteger(num) ? { ...item, qtdReceber: num, permiteFracao } : item;
          }
          const arredondado = Math.round(num * 1000) / 1000;
          return { ...item, qtdReceber: arredondado, permiteFracao };
        }
        return item;
      })
    });
  };

  // Remoção de um item diretamente do carrinho
  const handleRemoverItemDoCarrinho = (materialId) => {
    updateDraft({
      itens: itens.filter((i) => i.materialId !== materialId)
    });
  };

  // Validação estrita de todos os itens do lote
  const validarItensRecebimento = () => {
    if (itens.length === 0) {
      alert('Selecione ao menos um material para continuar.');
      return false;
    }
    for (const item of itens) {
      const raw = String(item.qtdReceber ?? '').trim();
      if (!raw) {
        alert(`Informe a quantidade a receber para o material "${item.nome}".`);
        return false;
      }
      const num = parseQuantidade(raw);
      if (isNaN(num) || !isFinite(num) || num <= 0) {
        alert(`Quantidade inválida para o material "${item.nome}". Informe um valor numérico positivo maior que zero.`);
        return false;
      }
      const permiteFracao = Boolean(
        item.permiteFracao ??
        materiais.find((m) => m.id === item.materialId)?.permiteFracao ??
        materiais.find((m) => m.id === item.materialId)?.permite_fracao
      );
      if (!permiteFracao && !Number.isInteger(num)) {
        alert(`O material "${item.nome}" não permite quantidades fracionárias. Informe um valor inteiro.`);
        return false;
      }
    }
    return true;
  };

  // Confirmação final do recebimento
  const handleExecutarConfirmacao = () => {
    if (!validarItensRecebimento()) {
      return;
    }
    if (fotos.length === 0) {
      alert('Adicione ao menos uma foto do material para confirmar o recebimento.');
      return;
    }

    // Mesmo identificador em novas tentativas do mesmo rascunho (evita recebimento duplicado).
    const operacao = identificadorOperacao
      || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    if (operacao && operacao !== identificadorOperacao && onUpdateDraft) {
      onUpdateDraft({ ...draftRemessa, identificadorOperacao: operacao });
    }

    const volumesCalculados = Math.round(
      itens.reduce((acc, item) => acc + (parseQuantidade(item.qtdReceber) || 0), 0) * 1000
    ) / 1000;

    const payload = {
      id: `REM-${Date.now().toString().slice(-6)}`,
      identificadorOperacao: operacao,
      fotos,
      data: new Date().toISOString(),
      dataFormatada: new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date()),
      tipoOrigem,
      documentoDoador: documentoDoador.trim(),
      observacao: observacao.trim(),
      totalItens: itens.length,
      totalVolumes: volumesCalculados,
      itens: itens.map((item) => {
        const qtdRecebida = Math.round(parseQuantidade(item.qtdReceber) * 1000) / 1000;
        const saldoAnterior = parseQuantidade(item.saldoAtual) || 0;
        const novoSaldo = Math.round((saldoAnterior + qtdRecebida) * 1000) / 1000;
        return {
          materialId: item.materialId,
          codigo: item.codigo,
          nome: item.nome,
          unidade: item.unidade,
          saldoAnterior,
          qtdRecebida,
          novoSaldo,
          complexo: item.complexo || 'Almoxarifado Central',
          locacao: item.locacao || '',
          localizacao: item.localizacao || '',
          dataValidade: item.dataValidade || ''
        };
      })
    };

    if (onConfirmar) {
      onConfirmar(payload);
    }
  };

  // Solicitar descarte com confirmação de segurança
  const handlePedirDescarte = () => {
    if (itens.length === 0 && !documentoDoador) {
      if (onDescartar) onDescartar();
      return;
    }
    setIsConfirmandoDescarte(true);
  };

  const handleConfirmarDescarteReal = () => {
    setIsConfirmandoDescarte(false);
    if (onDescartar) {
      onDescartar();
    }
  };

  const totalVolumes = useMemo(() => {
    const soma = itens.reduce((acc, i) => {
      const q = parseQuantidade(i.qtdReceber);
      return acc + (isNaN(q) || q <= 0 ? 0 : q);
    }, 0);
    return Math.round(soma * 1000) / 1000;
  }, [itens]);

  return (
    <>
      <BottomSheetModal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="recebimento-modal-title">
            <div className="recebimento-modal-title__icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <h2 className="recebimento-modal-title__text">
                Recebimento em Lote / Entrada
              </h2>
              <span className="recebimento-modal-title__sub">
                {etapaAtual === 1
                  ? 'Etapa 1: Seleção de materiais e conferência de volumes'
                  : 'Etapa 2: Identificação e documentação da remessa'}
              </span>
            </div>
          </div>
        }
        footer={
          etapaAtual === 1 ? (
            <div className="recebimento-footer">
              <button
                type="button"
                className="recebimento-footer-btn-descartar"
                onClick={handlePedirDescarte}
              >
                Descartar Remessa
              </button>
              <button
                type="button"
                className="recebimento-footer-btn-avancar"
                disabled={itens.length === 0}
                onClick={() => {
                  if (validarItensRecebimento()) setEtapa(2);
                }}
              >
                <span>Identificação</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="recebimento-footer recebimento-footer--etapa2">
              {/* Backdrop para fechar ao clicar/tocar fora na parte de doação */}
              {isResumoAberto && (
                <div
                  className="recebimento-popover-backdrop"
                  onClick={() => setIsResumoAberto(false)}
                  aria-hidden="true"
                />
              )}

              {/* Card Flutuante com a Lista de Materiais (Expande para cima sobre o formulário de doação) */}
              {isResumoAberto && (
                <div
                  className="recebimento-step2-popover"
                  ref={resumoPopoverRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="recebimento-step2-popover__header">
                    <div className="recebimento-step2-popover__title-wrap">
                      <span className="recebimento-step2-popover__title">
                        Materiais nesta Remessa
                      </span>
                      <span className="recebimento-step2-popover__count">
                        {formatarQuantidadeExibicao(totalVolumes)} {totalVolumes === 1 ? 'volume' : 'volumes'} ({itens.length} {itens.length === 1 ? 'item' : 'itens'})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="recebimento-step2-popover__close-btn"
                      onClick={() => setIsResumoAberto(false)}
                      title="Fechar visualização de materiais"
                      aria-label="Fechar"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  <div className="recebimento-step2-popover__list">
                    {itens.map((item) => (
                      <div key={item.materialId} className="recebimento-step2-popover__item">
                        <div className="recebimento-step2-popover__item-info">
                          <span className="recebimento-step2-popover__item-sku">
                            {item.codigo || 'MAT-S/C'}
                          </span>
                          <span className="recebimento-step2-popover__item-name">
                            {item.nome}
                          </span>
                        </div>
                        <span className="recebimento-step2-popover__item-qtd">
                          +{formatarQuantidadeExibicao(item.qtdReceber)} {item.unidade}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="recebimento-step2-popover__footer">
                    <button
                      type="button"
                      className="recebimento-step2-popover__edit-link"
                      onClick={() => {
                        setIsResumoAberto(false);
                        setEtapa(1);
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span>Ajustar materiais ou quantidades</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Barra Gatilho Fixa Anexada Imediatamente Acima dos Botões */}
              <button
                type="button"
                className={`recebimento-step2-summary-trigger ${isResumoAberto ? 'recebimento-step2-summary-trigger--active' : ''}`}
                onClick={() => setIsResumoAberto(!isResumoAberto)}
                aria-expanded={isResumoAberto}
              >
                <div className="recebimento-step2-summary-trigger__info">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="recebimento-step2-summary-trigger__icon"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  <strong className="recebimento-step2-summary-trigger__title">
                    {formatarQuantidadeExibicao(totalVolumes)} {totalVolumes === 1 ? 'volume a receber' : 'volumes a receber'}
                  </strong>
                </div>

                <div className="recebimento-step2-summary-trigger__action">
                  <span className="recebimento-step2-summary-trigger__label">
                    {isResumoAberto ? 'Fechar' : 'Ver itens'}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`recebimento-step2-summary-trigger__chevron ${isResumoAberto ? 'recebimento-step2-summary-trigger__chevron--open' : ''}`}
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </div>
              </button>

              {/* Linha de Botões Fixos */}
              <div className="recebimento-footer-btn-row">
                <button
                  type="button"
                  className="recebimento-footer-btn-voltar"
                  onClick={() => setEtapa(1)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  className="recebimento-footer-btn-confirmar"
                  disabled={itens.length === 0}
                  onClick={handleExecutarConfirmacao}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Confirmar</span>
                </button>
              </div>
            </div>
          )
        }
      >
        <div className="recebimento-container">
          {/* STEPPER HEADER (1. MATERIAIS & VOLUMES ─── 2. IDENTIFICAÇÃO & FOTOS) */}
          <div className="recebimento-stepper-header" role="navigation" aria-label="Etapas do recebimento">
            <button
              type="button"
              className={`recebimento-step-btn ${etapaAtual === 1 ? 'recebimento-step-btn--active' : 'recebimento-step-btn--completed'}`}
              onClick={() => setEtapa(1)}
            >
              <div className="recebimento-step-badge">
                {itens.length > 0 && etapaAtual === 2 ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>1</span>
                )}
              </div>
              <div className="recebimento-step-label-wrap">
                <span className="recebimento-step-sub">1ª Etapa</span>
                <span className="recebimento-step-label">Materiais ({itens.length})</span>
              </div>
            </button>

            <div className={`recebimento-step-connector ${etapaAtual === 2 ? 'recebimento-step-connector--active' : ''}`} />

            <button
              type="button"
              className={`recebimento-step-btn ${etapaAtual === 2 ? 'recebimento-step-btn--active' : ''}`}
              onClick={() => {
                if (itens.length > 0 && validarItensRecebimento()) setEtapa(2);
              }}
              disabled={itens.length === 0}
              title={itens.length === 0 ? 'Adicione ao menos um material para avançar' : 'Ir para identificação da remessa'}
            >
              <div className="recebimento-step-badge">
                <span>2</span>
              </div>
              <div className="recebimento-step-label-wrap">
                <span className="recebimento-step-sub">2ª Etapa</span>
                <span className="recebimento-step-label">Identificação & Fotos</span>
              </div>
            </button>
          </div>

          {/* ==================== ETAPA 1: MATERIAIS E VOLUMES ==================== */}
          {etapaAtual === 1 && (
            <div className="recebimento-step-pane">
              {/* Card Placeholder Pontilhado ("+ Adicionar Material à Remessa") */}
              <div className="recebimento-add-trigger-wrap">
                <button
                  type="button"
                  className="recebimento-placeholder-card"
                  onClick={() => setIsSeletorOpen(true)}
                >
                  <div className="recebimento-placeholder-card__icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <div className="recebimento-placeholder-card__info">
                    <strong className="recebimento-placeholder-card__title">
                      Toque para buscar e adicionar materiais
                    </strong>
                    <span className="recebimento-placeholder-card__sub">
                      Selecione um ou vários materiais do catálogo
                    </span>
                  </div>
                  <div className="recebimento-placeholder-card__arrow">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Lista de Materiais no Carrinho de Recebimento */}
              <div className="recebimento-itens-header">
                <span className="recebimento-itens-header__title">
                  Itens da Remessa ({itens.length})
                </span>
                {itens.length > 0 && (
                  <span className="recebimento-itens-header__badge">
                    {formatarQuantidadeExibicao(totalVolumes)} {totalVolumes === 1 ? 'volume' : 'volumes'} total
                  </span>
                )}
              </div>

              {itens.length === 0 ? (
                <div className="recebimento-itens-empty">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="1.5"
                  >
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <p className="recebimento-itens-empty__text">
                    Nenhum material adicionado à remessa.
                  </p>
                  <span className="recebimento-itens-empty__sub">
                    Toque no card acima para buscar itens do estoque.
                  </span>
                </div>
              ) : (
                <div className="recebimento-itens-list">
                  {itens.map((item) => {
                    const permiteFracao = Boolean(
                      item.permiteFracao ??
                      materiais.find((m) => m.id === item.materialId)?.permiteFracao ??
                      materiais.find((m) => m.id === item.materialId)?.permite_fracao
                    );
                    const qtdReceberNum = parseQuantidade(item.qtdReceber);
                    const isValida =
                      !isNaN(qtdReceberNum) &&
                      isFinite(qtdReceberNum) &&
                      qtdReceberNum > 0 &&
                      (permiteFracao || Number.isInteger(qtdReceberNum));
                    const saldoAtualNum = parseQuantidade(item.saldoAtual) || 0;
                    const novoSaldo = isValida
                      ? Math.round((saldoAtualNum + qtdReceberNum) * 1000) / 1000
                      : saldoAtualNum;
                    const erroQtd = !isValida && String(item.qtdReceber ?? '').trim() !== '';

                    return (
                      <div key={item.materialId} className="recebimento-item-card">
                        {/* Linha Superior: Nome, Unidade e Exclusão */}
                        <div className="recebimento-item-card__top">
                          <div className="recebimento-item-card__main">
                            <span className="recebimento-item-card__sku">
                              {item.codigo || 'MAT-S/C'}
                            </span>
                            <h4 className="recebimento-item-card__name">
                              {item.nome}
                            </h4>
                          </div>
                          <button
                            type="button"
                            className="recebimento-item-card__remove-btn"
                            onClick={() => handleRemoverItemDoCarrinho(item.materialId)}
                            title="Remover material da remessa"
                            aria-label={`Remover ${item.nome}`}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>

                        {/* Linha Inferior: Stepper Ergonômico e Projeção de Saldo */}
                        <div className="recebimento-item-card__bottom">
                          <div className="recebimento-item-card__stepper-wrap">
                            <span className="recebimento-item-card__stepper-label">
                              Quantidade:
                            </span>
                            <div className="recebimento-stepper">
                              <button
                                type="button"
                                className="recebimento-stepper__btn"
                                onClick={() => handleMudarQuantidade(item.materialId, -1)}
                                disabled={qtdReceberNum <= (permiteFracao ? 0.001 : 1)}
                                aria-label="Diminuir quantidade"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                              <input
                                type="text"
                                inputMode={permiteFracao ? "decimal" : "numeric"}
                                pattern={permiteFracao ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
                                className={`recebimento-stepper__input ${erroQtd ? 'recebimento-stepper__input--error' : ''}`}
                                value={item.qtdReceber}
                                onChange={(e) =>
                                  handleInputQuantidade(item.materialId, e.target.value)
                                }
                                onBlur={() => handleBlurQuantidade(item.materialId)}
                                aria-label={`Quantidade de ${item.nome}`}
                              />
                              <button
                                type="button"
                                className="recebimento-stepper__btn"
                                onClick={() => handleMudarQuantidade(item.materialId, 1)}
                                aria-label="Aumentar quantidade"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Projeção de Saldo Clara e Transparente */}
                          <div className="recebimento-item-card__projecao">
                            <span className="recebimento-projecao-atual">
                              Atual: <strong>{formatarQuantidadeExibicao(saldoAtualNum)}</strong> {item.unidade}
                            </span>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="2.5"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span className="recebimento-projecao-novo">
                              Novo: <strong>{formatarQuantidadeExibicao(novoSaldo)}</strong> {item.unidade}
                            </span>
                          </div>
                        </div>

                        {erroQtd && (
                          <div className="recebimento-item-card__error" role="alert" style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '4px' }}>
                            {!permiteFracao && !isNaN(qtdReceberNum) && isFinite(qtdReceberNum) && qtdReceberNum > 0 && !Number.isInteger(qtdReceberNum)
                              ? 'Este material só aceita quantidades inteiras.'
                              : 'Informe uma quantidade numérica maior que zero.'}
                          </div>
                        )}

                        {/* Validade do Lote (Opcional) */}
                        <div className="recebimento-item-card__validade-row">
                          <span className="recebimento-item-card__validade-label">Validade (Opcional):</span>
                          <input
                            type="date"
                            className="recebimento-item-card__validade-input"
                            value={item.dataValidade || ''}
                            onChange={(e) => handleMudarValidade(item.materialId, e.target.value)}
                            aria-label={`Validade de ${item.nome}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== ETAPA 2: IDENTIFICAÇÃO E FOTOS ==================== */}
          {etapaAtual === 2 && (
            <div className="recebimento-step-pane">
              {/* Seletor Categórico: Natureza da Entrada (Radio Cards) */}
              <div className="recebimento-origem-group">
                <label className="recebimento-label">
                  Natureza da Entrada <span className="recebimento-required-star">*</span>
                </label>
                <div className="recebimento-origem-cards" role="radiogroup" aria-label="Natureza da entrada">
                  {opcoesOrigem.map((opcao) => {
                    const isSelected = tipoOrigem === opcao.id;
                    return (
                      <button
                        key={opcao.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`recebimento-origem-card ${isSelected ? 'recebimento-origem-card--selected' : ''}`}
                        onClick={() => handleTrocarTipoOrigem(opcao.id)}
                      >
                        <div className="recebimento-origem-card__top">
                          <div className="recebimento-origem-card__icon-box">
                            {opcao.icon}
                          </div>
                          <div className="recebimento-origem-card__radio">
                            {isSelected ? (
                              <div className="recebimento-origem-check">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : (
                              <div className="recebimento-origem-circle" />
                            )}
                          </div>
                        </div>

                        <span className="recebimento-origem-card__label">{opcao.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card de Identificação e Fotos */}
              <div className="recebimento-meta-card">
                <div className="recebimento-input-group">
                  <label htmlFor="recebimento-doc-input" className="recebimento-label">
                    {tipoOrigem === 'doacao'
                      ? 'Identificação do Doador / Parceiro'
                      : tipoOrigem === 'compra_nf'
                      ? 'Número da Nota Fiscal / Documento'
                      : 'Origem / Referência da Entrada'}
                  </label>
                  <input
                    id="recebimento-doc-input"
                    type="text"
                    className="recebimento-input"
                    placeholder={
                      tipoOrigem === 'doacao'
                        ? 'Ex: Fundação Vale, Doação Externa...'
                        : tipoOrigem === 'compra_nf'
                        ? 'Ex: NF-e 10.428, DANFE 9283...'
                        : 'Ex: Devolução de evento, Sobra de oficina...'
                    }
                    value={documentoDoador}
                    onChange={(e) => updateDraft({ documentoDoador: e.target.value })}
                  />
                </div>

                <div className="recebimento-input-group">
                  <label htmlFor="recebimento-obs-input" className="recebimento-label">
                    Observações da Remessa (Opcional)
                  </label>
                  <input
                    id="recebimento-obs-input"
                    type="text"
                    className="recebimento-input"
                    placeholder="Detalhes adicionais, estado dos materiais..."
                    value={observacao}
                    onChange={(e) => updateDraft({ observacao: e.target.value })}
                  />
                </div>

                <div className="recebimento-anexos-section">
                  <span className="recebimento-label">Fotos do material</span>
                  <p className="recebimento-storage-note">
                    Obrigatório ao menos uma foto (JPG, PNG ou WEBP, até 10 MB cada). O estoque é atualizado ao confirmar.
                  </p>
                  {fotos.length > 0 && (
                    <ul className="recebimento-fotos-lista">
                      {fotos.map((foto, indice) => (
                        <li key={`${foto.name}-${foto.size}-${indice}`} className="recebimento-foto-item">
                          <span className="recebimento-foto-item__nome">{foto.name}</span>
                          <span className="recebimento-foto-item__tamanho">{(foto.size / (1024 * 1024)).toFixed(1)} MB</span>
                          <button
                            type="button"
                            className="recebimento-foto-item__remover"
                            onClick={() => handleRemoverFoto(indice)}
                            aria-label={`Remover foto ${foto.name}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input
                    ref={fotosInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    hidden
                    onChange={handleAdicionarFotos}
                  />
                  <button
                    type="button"
                    className="recebimento-fotos-adicionar"
                    onClick={() => fotosInputRef.current?.click()}
                    disabled={fotos.length >= MAXIMO_FOTOS}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    {fotos.length === 0 ? 'Adicionar fotos' : `Adicionar mais fotos (${fotos.length}/${MAXIMO_FOTOS})`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </BottomSheetModal>

      {/* SUB-MODAL / DRAWER: SELETOR RÁPIDO DE MATERIAIS */}
      <BottomSheetModal
        isOpen={isSeletorOpen}
        onClose={() => setIsSeletorOpen(false)}
        title={
          <div className="recebimento-seletor-title">
            <h3 className="recebimento-seletor-title__text">
              Selecionar Materiais para o Lote
            </h3>
            <span className="recebimento-seletor-title__sub">
              Toque nos materiais para adicionar ou remover da remessa
            </span>
          </div>
        }
        footer={
          <div className="recebimento-seletor-footer">
            <span className="recebimento-seletor-footer__count">
              <strong>{itens.length}</strong> {itens.length === 1 ? 'material selecionado' : 'materiais selecionados'}
            </span>
            <button
              type="button"
              className="recebimento-seletor-footer__btn"
              onClick={() => setIsSeletorOpen(false)}
            >
              Concluir Seleção
            </button>
          </div>
        }
      >
        <div className="recebimento-seletor-container">
          {/* Barra de busca instantânea */}
          <div className="recebimento-seletor-search-wrap">
            <svg
              className="recebimento-seletor-search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              autoFocus
              className="recebimento-seletor-search-input"
              placeholder="Buscar por nome, código SKU ou categoria..."
              value={buscaCatalogo}
              onChange={(e) => setBuscaCatalogo(e.target.value)}
            />
            {buscaCatalogo && (
              <button
                type="button"
                className="recebimento-seletor-search-clear"
                onClick={() => setBuscaCatalogo('')}
              >
                ×
              </button>
            )}
          </div>

          {/* Chips de filtro por categoria */}
          <div className="recebimento-seletor-chips">
            {categoriasCatalogo.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`recebimento-seletor-chip ${categoriaCatalogo === cat ? 'recebimento-seletor-chip--active' : ''}`}
                onClick={() => setCategoriaCatalogo(cat)}
              >
                {cat === 'todas' ? 'Todas as Categorias' : cat}
              </button>
            ))}
          </div>

          {/* Lista de materiais com multi-seleção rápida */}
          <div className="recebimento-seletor-list">
            {materiaisFiltrados.length === 0 ? (
              <div className="recebimento-seletor-empty">
                <p>Nenhum material encontrado para esta busca.</p>
              </div>
            ) : (
              materiaisFiltrados.map((m) => {
                const jaSelecionado = idsNoCarrinho.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`recebimento-seletor-item ${jaSelecionado ? 'recebimento-seletor-item--selected' : ''}`}
                    onClick={() => handleToggleMaterialNoCarrinho(m)}
                  >
                    <div className="recebimento-seletor-item__checkbox">
                      {jaSelecionado ? (
                        <div className="recebimento-check-circle recebimento-check-circle--checked">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="3.2"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="recebimento-check-circle" />
                      )}
                    </div>

                    <div className="recebimento-seletor-item__info">
                      <div className="recebimento-seletor-item__top">
                        <span className="recebimento-seletor-item__sku">
                          {m.codigo || 'MAT-S/C'}
                        </span>
                        <span className="recebimento-seletor-item__cat">
                          {m.categoria}
                        </span>
                      </div>
                      <h4 className="recebimento-seletor-item__name">
                        {m.nome}
                      </h4>
                      <span className="recebimento-seletor-item__stock">
                        Estoque atual: <strong>{m.quantidade}</strong> {m.unidade}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`recebimento-seletor-item__action-btn ${jaSelecionado ? 'recebimento-seletor-item__action-btn--selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMaterialNoCarrinho(m);
                      }}
                    >
                      {jaSelecionado ? 'Adicionado' : '+ Adicionar'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </BottomSheetModal>

      {/* CONFIRMAÇÃO DE DESCARTE DE REMESSA */}
      {isConfirmandoDescarte && (
        <div className="recebimento-confirm-backdrop">
          <div className="recebimento-confirm-card">
            <h3 className="recebimento-confirm-title">Descartar Remessa?</h3>
            <p className="recebimento-confirm-text">
              Existem {itens.length} material(is) nesta remessa. Todas as alterações serão perdidas.
            </p>
            <div className="recebimento-confirm-actions">
              <button
                type="button"
                className="recebimento-confirm-btn-cancelar"
                onClick={() => setIsConfirmandoDescarte(false)}
              >
                Voltar e Continuar
              </button>
              <button
                type="button"
                className="recebimento-confirm-btn-descartar"
                onClick={handleConfirmarDescarteReal}
              >
                Sim, Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RecebimentoLoteModal;
