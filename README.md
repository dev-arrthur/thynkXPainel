# thynkXP Painel

Sistema de controle de clientes e documentação com **Node.js + Express + MongoDB + Bootstrap**.

## Páginas criadas

- `/index.html` (login com redirecionamento para dashboard)
- `/pages/dashboard.html`
- `/pages/administradores.html`
- `/pages/clientes-dashboard.html`
- `/pages/clientes-gerenciamento.html`
- `/pages/documentacao-dashboard.html`
- `/pages/documentacao-contratos.html`
- `/pages/documentacao-renovacoes.html`
- `/pages/documentacao-parcerias.html`

## Como rodar

```bash
npm install
cp .env.example .env
npm start
```

## Variáveis (.env)

```env
PORT=3000
MONGODB_URI=mongodb+srv://USUARIO:SENHA@cluster.mongodb.net/thynkxp
ADMIN_EMAIL=admin@thynkxp.com
ADMIN_PASSWORD=123456
```

## Deploy no Render

1. Suba o repositório no GitHub.
2. No Render, crie um **Web Service** apontando para o repo.
3. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Configure as envs do `.env` no painel do Render.
5. (Opcional) use o `render.yaml` deste projeto para infraestrutura como código.
