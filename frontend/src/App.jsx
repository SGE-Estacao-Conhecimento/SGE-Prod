import React, { lazy, Suspense, useState } from 'react';
import Login from './pages/Login';
import PasswordReset from './pages/PasswordReset';
import TrocaSenhaObrigatoria from './pages/TrocaSenhaObrigatoria';
const Administrativo = lazy(() => import('./pages/Administrativo'));
const Usuario = lazy(() => import('./pages/Usuario'));
const Almoxarife = lazy(() => import('./pages/Almoxarife'));
import './index.css';
import './App.css';
import { clearStoredAuth } from './services/api/client';
import { getStoredUser, login, logout, solicitarRedefinicao } from './services/api/authService';

function App() {
  const resetToken = new URLSearchParams(window.location.search).get('reset_token');
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [authError, setAuthError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  if (resetToken) return <PasswordReset token={resetToken} />;

  const handleLogin = async (credentials) => {
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const usuario = await login({
        email: credentials.identifier,
        senha: credentials.password,
        rememberMe: credentials.rememberMe,
        role: credentials.role
      });
      setCurrentUser(usuario);
    } catch (error) {
      setAuthError(error.message || 'Erro ao realizar login.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch { /* Limpeza segura da sessão local */ }
    clearStoredAuth();
    setCurrentUser(null);
  };

  const handleUserUpdate = (atualizado) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...atualizado } : atualizado));
  };

  // Se o usuário não estiver autenticado, exibe a tela de login
  if (!currentUser) {
    return (
      <Login
        onLogin={handleLogin}
        onForgotPassword={solicitarRedefinicao}
        error={authError}
        isLoading={isAuthenticating}
      />
    );
  }

  if (currentUser.precisaTrocarSenha) {
    return (
      <TrocaSenhaObrigatoria
        user={currentUser}
        onSuccess={(atualizado) => setCurrentUser(atualizado)}
        onLogout={handleLogout}
      />
    );
  }

  // Direcionamento dinâmico conforme perfil selecionado/autenticado
  return (
    <Suspense fallback={<div className="app-loading">Carregando sistema...</div>}>
      {currentUser.role === 'usuario' && (
        <Usuario user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
      {currentUser.role === 'almoxarife' && (
        <Almoxarife user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
      {(currentUser.role === 'admin' || !['usuario', 'almoxarife'].includes(currentUser.role)) && (
        <Administrativo user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
    </Suspense>
  );
}

export default App;
