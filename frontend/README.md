# SGE Frontend - Estação Conhecimento (Modo Standalone)

Frontend desacoplado do Sistema de Gestão de Estoque (SGE) da Estação Conhecimento.

Esta pasta foi configurada para funcionar de modo **100% autônomo (standalone)**. Você pode copiá-la ou movê-la para qualquer outro repositório e rodar o projeto sem necessitar de nenhum backend ou banco de dados externo.

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js** (v18 ou superior recomendado)
- **NPM**

### Instalação e Execução

1. Abra a pasta do frontend no terminal:
   ```bash
   cd sge-frontend
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse no navegador:
   ```
   http://localhost:5173
   ```

> **Dica Windows:** Você também pode simplesmente dar duplo-clique no arquivo `iniciar.bat` dentro desta pasta.

---

## 👥 Perfis de Acesso Disponíveis na Tela de Login

Na tela inicial de login, você pode alternar livremente entre os 3 perfis do sistema com 1 clique:

1. **Administrativo (`admin`):**
   - Visão gerencial completa desktop-first.
   - Gestão de estoque (cadastrar, editar, excluir materiais).
   - Gestão de usuários (cadastrar, editar, alternar status, excluir).
   - Gestão e aprovação/atendimento de pedidos.
   - Relatórios e gráficos com exportação para PDF e Excel (.xlsx).

2. **Almoxarife (`almoxarife`):**
   - Controle de estoque e movimentações (entradas, saídas, ajustes de inventário).
   - Histórico e cadastro de remessas externas.
   - Separação e atendimento de pedidos solicitados.

3. **Usuário (`usuario`):**
   - Catálogo de materiais mobile-first ergonômico.
   - Busca em tempo real e filtros por categoria.
   - Favoritar materiais frequentes.
   - Fazer pedidos e requisições com carrinho/lote ou item individual.
   - Acompanhamento do status dos meus pedidos.

---

## 💾 Persistência de Dados Local (Mock Store)

Todas as operações realizadas no frontend (adicionar produtos, mudar status de pedidos, registrar movimentações, favoritar itens, etc.) são persistidas no `localStorage` do seu navegador através do módulo `src/services/api/mockDataStore.js`.

- Os dados iniciais vêm pré-carregados de `src/data/demoData.js`.
- Se quiser reiniciar os dados para o padrão original, basta limpar os dados do site no navegador ou executar no console do DevTools:
  ```javascript
  localStorage.clear(); location.reload();
  ```

---

## 🔌 Como Conectar a um Novo Backend no Futuro

Quando você desenvolver o novo backend, toda a comunicação do frontend continuará concentrada em:
- `src/services/api/client.js` (configuração do `API_BASE_URL` e função `request`)
- `src/services/api/authService.js` (login e sessão)
- `src/services/*/` (serviços por domínio: materiais, pedidos, usuários, etc.)

Basta apontar a variável `API_BASE_URL` para o endereço do seu novo servidor (ou via variável de ambiente `.env` com `VITE_API_BASE_URL`).

---

## 📦 Scripts Disponíveis

- `npm run dev` — Inicia o servidor Vite com hot-reload.
- `npm run build` — Gera o bundle otimizado para produção na pasta `dist/`.
- `npm run preview` — Pré-visualiza o build de produção localmente.
- `npm run lint` — Executa o linter Oxlint no código-fonte.
