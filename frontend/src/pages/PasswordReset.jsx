import React, { useState } from 'react';
import { request } from '../services/api/client';
import './Login.css';

export default function PasswordReset({ token }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const confirmar = async (event) => {
    event.preventDefault();
    setErro('');
    setMensagem('');
    if (senha.length < 8 || senha !== confirmacao) {
      setErro(senha.length < 8 ? 'A senha deve ter pelo menos 8 caracteres.' : 'As senhas não coincidem.');
      return;
    }
    setSalvando(true);
    try {
      const resposta = await request('/api/password-reset/confirm', {
        method: 'POST', body: JSON.stringify({ token, novaSenha: senha })
      });
      setMensagem(resposta.message);
    } catch (error) { setErro(error.message); }
    finally { setSalvando(false); }
  };

  return <div className="login-container"><div className="login-card-wrapper" style={{ width: '100%' }}>
    <div className="login-card" style={{ maxWidth: 420 }}>
      <div className="login-header"><h2 className="login-title">Redefinir senha</h2><p className="login-subtitle">Estação Conhecimento</p></div>
      <form className="login-form" onSubmit={confirmar}>
        <div className="login-field"><label className="login-label" htmlFor="reset-password">Nova senha</label><input id="reset-password" className="login-input" type="password" minLength="8" required value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" aria-describedby="reset-password-hint" /><small id="reset-password-hint">Use pelo menos 8 caracteres.</small></div>
        <div className="login-field"><label className="login-label" htmlFor="reset-password-confirm">Confirmar nova senha</label><input id="reset-password-confirm" className="login-input" type="password" minLength="8" required value={confirmacao} onChange={e => setConfirmacao(e.target.value)} autoComplete="new-password" aria-invalid={Boolean(erro && senha !== confirmacao)} /></div>
        {erro && <p className="login-error" role="alert">{erro}</p>}
        {mensagem && <p className="login-success" role="status">{mensagem}</p>}
        <button className="login-submit-btn" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar nova senha'}</button>
        <a className="login-reset-back" href={window.location.pathname}>Voltar ao login</a>
      </form>
    </div>
  </div></div>;
}
