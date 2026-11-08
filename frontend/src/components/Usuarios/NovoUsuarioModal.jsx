import React, { useState, useEffect, useMemo } from 'react';
import './NovoUsuarioModal.css';
import { useDialogAccessibility } from '../common';
import { setorService } from '../../services/setores/setorService';

const PERFIS = [
  { value: 'Administrativo', label: 'Administrativo (Acesso Total)' },
  { value: 'Almoxarifado', label: 'Almoxarifado (Estoque e Movimentações)' },
  { value: 'Usuário', label: 'Usuário (Consultas e Pedidos)' },
];

const formatCPF = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const NovoUsuarioModal = ({ isOpen, onClose, onSave, initialData = null, setores = [], onCriarSetor }) => {
  const dialogRef = useDialogAccessibility({ isOpen, onClose });
  const [setoresLocais, setSetoresLocais] = useState([]);
  const [novoSetorNome, setNovoSetorNome] = useState('');
  const [criandoSetor, setCriandoSetor] = useState(false);

  const listaSetores = useMemo(() => {
    const combinados = new Set();
    (setores || []).forEach(s => {
      const nome = typeof s === 'string' ? s : s?.nome;
      if (nome) combinados.add(nome);
    });
    setoresLocais.forEach(s => {
      if (s) combinados.add(s);
    });
    return Array.from(combinados);
  }, [setores, setoresLocais]);

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    perfil: 'Usuário',
    setor: '',
    senha: '',
    ativo: true
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome || '',
        cpf: initialData.cpf ? formatCPF(initialData.cpf) : '',
        email: initialData.email || '',
        perfil: initialData.perfil || 'Usuário',
        setor: initialData.setor || listaSetores[0] || '',
        senha: '',
        ativo: initialData.ativo ?? true
      });
    } else {
      setFormData({
        nome: '',
        cpf: '',
        email: '',
        perfil: 'Usuário',
        setor: listaSetores[0] || '',
        senha: '',
        ativo: true
      });
    }
    setNovoSetorNome('');
    setErrors({});
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!formData.setor && listaSetores.length > 0) {
      setFormData(prev => ({ ...prev, setor: listaSetores[0] }));
    }
  }, [listaSetores, formData.setor]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = name === 'cpf' ? formatCPF(value) : (type === 'checkbox' ? checked : value);

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAdicionarSetor = async () => {
    const nome = novoSetorNome.trim();
    if (!nome) {
      setErrors(prev => ({ ...prev, setor: 'Informe o nome do novo setor.' }));
      return;
    }
    setCriandoSetor(true);
    try {
      const criarFn = onCriarSetor || setorService.criar;
      const atualizados = await criarFn(nome);
      if (Array.isArray(atualizados)) {
        setSetoresLocais(atualizados.map(s => (typeof s === 'string' ? s : s.nome)));
      } else {
        setSetoresLocais(prev => [...prev, nome]);
      }
      setFormData(prev => ({ ...prev, setor: nome }));
      setNovoSetorNome('');
      setErrors(prev => ({ ...prev, setor: null }));
    } catch (error) {
      setErrors(prev => ({ ...prev, setor: error?.message || 'Não foi possível cadastrar o setor.' }));
    } finally {
      setCriandoSetor(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome completo é obrigatório';
    }

    const cleanCpf = (formData.cpf || '').replace(/\D/g, '');
    if (!cleanCpf) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (cleanCpf.length !== 11) {
      newErrors.cpf = 'CPF deve conter 11 dígitos';
    }

    // E-mail opcional (ou identificador 'admin' do administrador inicial)
    const emailTrim = formData.email.trim();
    if (emailTrim && emailTrim.toLowerCase() !== 'admin' && !/\S+@\S+\.\S+/.test(emailTrim)) {
      newErrors.email = 'Informe um e-mail válido';
    }

    if (!formData.setor || !formData.setor.trim()) {
      newErrors.setor = 'Cadastre e selecione um setor vinculado';
    }

    if (!initialData && !formData.senha) {
      newErrors.senha = 'Senha de acesso é obrigatória no cadastro';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const names = formData.nome.trim().split(' ');
    const inicial = names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();

    onSave({
      ...formData,
      cpf: formatCPF(formData.cpf),
      email: formData.email.trim(),
      id: initialData ? initialData.id : Date.now(),
      inicial,
      dataCadastro: initialData ? initialData.dataCadastro : new Date().toLocaleDateString('pt-BR')
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="modal-container user-modal-container" role="dialog" aria-modal="true" aria-labelledby="user-modal-title" tabIndex={-1}>
        <div className="modal-header">
          <div className="modal-header__title-wrap">
            <div className="modal-header__icon user-modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h3 id="user-modal-title">{initialData ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="user-form-grid">
            {/* Nome Completo */}
            <div className="form-group span-2">
              <label className="form-label" htmlFor="user-name">Nome Completo *</label>
              <input
                id="user-name"
                type="text"
                name="nome"
                className={`form-input ${errors.nome ? 'form-input--error' : ''}`}
                placeholder="Ex: Carlos Eduardo Silva"
                value={formData.nome}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.nome)}
                aria-describedby={errors.nome ? 'user-name-error' : undefined}
              />
              {errors.nome && <span id="user-name-error" className="form-error-msg" role="alert">{errors.nome}</span>}
            </div>

            {/* CPF (Obrigatório) */}
            <div className="form-group">
              <label className="form-label" htmlFor="user-cpf">CPF *</label>
              <input
                id="user-cpf"
                type="text"
                name="cpf"
                className={`form-input ${errors.cpf ? 'form-input--error' : ''}`}
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={handleChange}
                maxLength={14}
                required
                aria-invalid={Boolean(errors.cpf)}
                aria-describedby={errors.cpf ? 'user-cpf-error' : undefined}
              />
              {errors.cpf && <span id="user-cpf-error" className="form-error-msg" role="alert">{errors.cpf}</span>}
            </div>

            {/* E-mail (Opcional) */}
            <div className="form-group">
              <label className="form-label" htmlFor="user-email">E-mail de Acesso <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-muted)' }}>(Opcional)</span></label>
              <input
                id="user-email"
                type="email"
                name="email"
                className={`form-input ${errors.email ? 'form-input--error' : ''}`}
                placeholder="carlos.silva@estacao.org.br"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'user-email-error' : undefined}
              />
              {errors.email && <span id="user-email-error" className="form-error-msg" role="alert">{errors.email}</span>}
            </div>

            {/* Perfil de Acesso */}
            <div className="form-group">
              <label className="form-label" htmlFor="user-role">Perfil de Acesso *</label>
              <select
                id="user-role"
                name="perfil"
                className="form-select"
                value={formData.perfil}
                onChange={handleChange}
              >
                {PERFIS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Setor */}
            <div className="form-group">
              <label className="form-label" htmlFor="user-sector">Setor Vinculado *</label>
              <select
                id="user-sector"
                name="setor"
                className={`form-select ${errors.setor ? 'form-input--error' : ''}`}
                value={formData.setor}
                onChange={handleChange}
              >
                {listaSetores.length === 0 ? (
                  <option value="">Nenhum setor cadastrado</option>
                ) : (
                  listaSetores.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))
                )}
              </select>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Cadastrar novo setor..."
                  value={novoSetorNome}
                  onChange={(e) => setNovoSetorNome(e.target.value)}
                  aria-label="Nome do novo setor"
                />
                <button
                  type="button"
                  className="btn-modal-cancel"
                  style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                  onClick={handleAdicionarSetor}
                  disabled={criandoSetor}
                >
                  {criandoSetor ? '...' : '+ Setor'}
                </button>
              </div>
              {errors.setor && <span className="form-error-msg" role="alert">{errors.setor}</span>}
            </div>

            {/* Senha */}
            <div className="form-group span-2">
              <label className="form-label" htmlFor="user-password">
                {initialData ? 'Nova Senha (Deixe em branco para manter a atual)' : 'Senha de Acesso *'}
              </label>
              <input
                id="user-password"
                type="password"
                name="senha"
                className={`form-input ${errors.senha ? 'form-input--error' : ''}`}
                placeholder={initialData ? '••••••••' : 'Digite a senha inicial'}
                value={formData.senha}
                onChange={handleChange}
                minLength={8}
                required={!initialData}
                aria-invalid={Boolean(errors.senha)}
                aria-describedby={errors.senha ? 'user-password-error' : undefined}
              />
              {errors.senha && <span id="user-password-error" className="form-error-msg" role="alert">{errors.senha}</span>}
            </div>

            {/* Status (Ativo/Inativo) */}
            <div className="form-group span-2 form-group--inline user-status-toggle">
              <div>
                <label className="form-label">Status da Conta</label>
                <p className="form-help-text">Usuários inativos não conseguem realizar login no sistema.</p>
              </div>
              <label className="toggle">
                <input
                  aria-label="Conta ativa"
                  type="checkbox"
                  name="ativo"
                  checked={formData.ativo}
                  onChange={handleChange}
                />
                <span className="toggle__slider" />
                <span className="toggle__label">{formData.ativo ? 'Conta Ativa' : 'Conta Inativa'}</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {initialData ? 'Salvar Alterações' : 'Cadastrar Usuário'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default NovoUsuarioModal;
