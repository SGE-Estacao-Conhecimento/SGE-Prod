import React, { useState, useMemo } from 'react';
import NovoMaterialModal from './NovoMaterialModal';
import { ConfirmDialog } from '../common';
import './EstoqueView.css';

/**
 * EstoqueView
 * Módulo de Gestão de Estoque (Materiais) (RF-001)
 * Props esperadas do backend (C# / MySQL):
 * @param {Array} materiais - Lista de materiais [{ id, codigo, nome, categoria, unidade, quantidade, estoqueMinimo, localizacao, status, descricao }]
 * @param {Function} onSave - Callback chamado ao cadastrar ou editar um material
 * @param {Function} onDelete - Callback chamado ao excluir um material
 * @param {''|'ok'|'baixo'|'critico'} [initialStatus] - Filtro de status aplicado ao abrir a tela (ex: 'critico' para itens sem estoque)
 */
const EstoqueView = ({
  materiais: initialMateriaisProp,
  onSave,
  onDelete,
  initialStatus = ''
}) => {
  // Estado local sincronizado com props do backend
  const [materiais, setMateriais] = useState(initialMateriaisProp || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  // Controle do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  // Sincroniza se novas props vierem do backend
  React.useEffect(() => {
    if (initialMateriaisProp) {
      setMateriais(initialMateriaisProp);
    }
  }, [initialMateriaisProp]);

  // Estatísticas calculadas dinamicamente
  const stats = useMemo(() => {
    const total = materiais.length;
    const ok = materiais.filter(m => m.quantidade > m.estoqueMinimo).length;
    const baixo = materiais.filter(m => m.quantidade > 0 && m.quantidade <= m.estoqueMinimo).length;
    const critico = materiais.filter(m => m.quantidade === 0).length;
    return { total, ok, baixo, critico };
  }, [materiais]);

  // Filtragem em tempo real
  const filteredMateriais = useMemo(() => {
    return materiais.filter(item => {
      const matchSearch =
        item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.localizacao && item.localizacao.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategoria = !selectedCategoria || item.categoria === selectedCategoria;

      const qtd = Number(item.quantidade ?? 0);
      let itemStatus = 'ok';
      if (qtd === 0) itemStatus = 'critico';
      else if (qtd <= Number(item.estoqueMinimo ?? 0)) itemStatus = 'baixo';

      const matchStatus = !selectedStatus || itemStatus === selectedStatus;

      return matchSearch && matchCategoria && matchStatus;
    });
  }, [materiais, searchTerm, selectedCategoria, selectedStatus]);

  const handleOpenNewModal = () => {
    setEditingMaterial(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material) => {
    setEditingMaterial(material);
    setIsModalOpen(true);
  };

  const handleDeleteMaterial = (id, nome) => {
    setMaterialToDelete({ id, nome });
  };

  const confirmDeleteMaterial = () => {
    if (!materialToDelete) return;
    if (onDelete) {
      onDelete(materialToDelete.id);
    } else {
      setMateriais(prev => prev.filter(m => m.id !== materialToDelete.id));
    }
    setMaterialToDelete(null);
  };

  const handleSaveMaterial = (materialData) => {
    if (onSave) {
      onSave(materialData);
    } else {
      if (editingMaterial) {
        setMateriais(prev => prev.map(m => m.id === materialData.id ? materialData : m));
      } else {
        setMateriais(prev => [materialData, ...prev]);
      }
    }
  };

  const getStatusBadge = (item) => {
    if (item.quantidade === 0) {
      return <span className="status-badge status-badge--danger">Sem Estoque</span>;
    }
    if (item.quantidade <= item.estoqueMinimo) {
      return <span className="status-badge status-badge--warning">Estoque Baixo</span>;
    }
    return <span className="status-badge status-badge--success">Em Estoque</span>;
  };

  return (
    <div className="estoque-container">
      {/* Header & Ações Principais */}
      <div className="estoque-header">
        <div>
          <h1 className="estoque-title">Catálogo de Materiais em Estoque</h1>
          <p className="estoque-subtitle">Gerencie o cadastro de materiais, controle saldos e acompanhe a localização.</p>
        </div>
        <button className="btn-novo-material" onClick={handleOpenNewModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo Material
        </button>
      </div>

      {/* Cards de Resumo Interativos */}
      <div className="estoque-kpis" role="region" aria-label="Filtros rápidos por indicador de estoque">
        <div
          className={`estoque-kpi-card ${!selectedStatus ? 'estoque-kpi-card--active-total' : ''}`}
          onClick={() => setSelectedStatus('')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedStatus(''); }}
          title="Clique para ver todos os materiais cadastrados"
        >
          <div className="estoque-kpi-icon estoque-kpi-icon--total">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <span className="estoque-kpi-label">Total Cadastrado</span>
            <div className="estoque-kpi-val">{stats.total}</div>
          </div>
        </div>

        <div
          className={`estoque-kpi-card ${selectedStatus === 'baixo' ? 'estoque-kpi-card--active-warning' : ''}`}
          onClick={() => setSelectedStatus(prev => prev === 'baixo' ? '' : 'baixo')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedStatus(prev => prev === 'baixo' ? '' : 'baixo'); }}
          title="Clique para filtrar apenas materiais com estoque baixo"
        >
          <div className="estoque-kpi-icon estoque-kpi-icon--warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <span className="estoque-kpi-label">Estoque Baixo</span>
            <div className="estoque-kpi-val text-warning">{stats.baixo}</div>
          </div>
        </div>

        <div
          className={`estoque-kpi-card ${selectedStatus === 'critico' ? 'estoque-kpi-card--active-danger' : ''}`}
          onClick={() => setSelectedStatus(prev => prev === 'critico' ? '' : 'critico')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedStatus(prev => prev === 'critico' ? '' : 'critico'); }}
          title="Clique para filtrar apenas materiais sem estoque (esgotados)"
        >
          <div className="estoque-kpi-icon estoque-kpi-icon--danger">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <span className="estoque-kpi-label">Sem Estoque</span>
            <div className="estoque-kpi-val text-danger">{stats.critico}</div>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="estoque-filter-bar">
        <div className="estoque-search-wrap">
          <svg className="estoque-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="estoque-search-input"
            placeholder="Buscar por nome, código SKU ou localização..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="estoque-clear-search" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        <div className="estoque-filters-right">
          <select
            className="estoque-select-filter"
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
          >
            <option value="">Todas as Categorias</option>
            <option value="Escritório">Escritório</option>
            <option value="Limpeza e Higiene">Limpeza e Higiene</option>
            <option value="Material Didático">Material Didático</option>
            <option value="Informática / TI">Informática / TI</option>
            <option value="Esportes e Lazer">Esportes e Lazer</option>
          </select>

          <select
            className="estoque-select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Todos os Status</option>
            <option value="ok">Em Estoque</option>
            <option value="baixo">Estoque Baixo</option>
            <option value="critico">Sem Estoque</option>
          </select>
        </div>
      </div>

      {/* Tabela de Materiais */}
      <div className="estoque-table-card">
        {filteredMateriais.length > 0 ? (
          <div className="estoque-table-wrapper">
            <table className="estoque-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Material / Descrição</th>
                  <th>Categoria</th>
                  <th>Quantidade</th>
                  <th>Localização</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMateriais.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className="sku-badge">{item.codigo}</span>
                    </td>
                    <td>
                      <div className="material-name-wrap">
                        <span className="material-name">{item.nome}</span>
                        {item.descricao && (
                          <span className="material-desc-sub">{item.descricao}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="categoria-tag">{item.categoria}</span>
                    </td>
                    <td>
                      <span className="qtd-val">
                        <strong>{item.quantidade}</strong> <small>{item.unidade}</small>
                      </span>
                    </td>
                    <td>
                      <span className="local-text">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        {item.localizacao || 'Não especificada'}
                      </span>
                    </td>
                    <td>{getStatusBadge(item)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-action--edit"
                          title="Editar material"
                          onClick={() => handleOpenEditModal(item)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          className="btn-action btn-action--delete"
                          title="Excluir material"
                          onClick={() => handleDeleteMaterial(item.id, item.nome)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="estoque-empty-state">
            <div className="empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <line x1="3.27" y1="6.96" x2="12" y2="12.01"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
                <line x1="20.73" y1="6.96" x2="12" y2="12.01"/>
              </svg>
            </div>
            <h4>Nenhum material cadastrado</h4>
            <p>
              {searchTerm || selectedCategoria || selectedStatus
                ? 'Nenhum item encontrado para os filtros selecionados.'
                : 'O estoque está vazio. Clique no botão acima para cadastrar o primeiro material.'}
            </p>
            {(searchTerm || selectedCategoria || selectedStatus) ? (
              <button
                className="btn-clear-filters"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategoria('');
                  setSelectedStatus('');
                }}
              >
                Limpar Filtros
              </button>
            ) : (
              <button className="btn-novo-material" onClick={handleOpenNewModal}>
                + Cadastrar Primeiro Material
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Adição/Edição */}
      <NovoMaterialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMaterial}
        initialData={editingMaterial}
      />
      {materialToDelete && (
        <ConfirmDialog
          title="Excluir material?"
          description={`O material “${materialToDelete.nome}” será removido do catálogo. Esta ação pode afetar históricos relacionados.`}
          confirmLabel="Excluir material"
          onCancel={() => setMaterialToDelete(null)}
          onConfirm={confirmDeleteMaterial}
        />
      )}
    </div>
  );
};

export default EstoqueView;
