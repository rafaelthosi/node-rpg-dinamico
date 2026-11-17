# API RPG Dinâmico

API realizada para aprender a integração de uma aplicação React com Node.js.
Ela guarda os dados em arquivos CSV e oferece autenticação por usuário e senha
e token JWT.

## Como funciona?

O backend deve possuir dois perfis:
- [x] Game Master
- [x] Player

Se estiver na visão GM:
- [x] Deve conseguir criar Campanhas
- [x] Deve conseguir criar Players
- [x] Deve conseguir vincular Players em Campanhas
- [x] Deve conseguir criar grupos de informações que aparecerão para todos os Players

As Campanhas devem possuir:
- [x] Nome
- [x] Descrição
- [x] Senha de acesso
- [x] Lista de Players vinculados

Os grupos de informações devem possuir:
- [x] Nome
- [x] Descrição
- [x] Campos de diferentes tipos

Os campos devem permitir:
- [x] Texto
- [x] Número
- [x] Área de texto
- [x] Lista de opções
- [x] Caixa de seleção
- [x] Valor verdadeiro ou falso
- [x] Data
- [x] Definir se o campo é obrigatório
- [x] Definir quem pode editar o campo
- [x] Definir quem pode visualizar o campo

Se estiver na visão Player:
- [x] Deve conseguir entrar em uma campanha vinculada à sua conta
- [x] Deve conseguir criar personagens
- [x] Deve conseguir visualizar os grupos e campos permitidos
- [x] Deve conseguir preencher os campos que pode editar
- [x] Deve conseguir alterar o próprio personagem

## Requisitos

- Node.js 20 ou superior
- npm

## Configuração

Na pasta `backend`, instale as dependências e crie o arquivo de ambiente:

```bash
npm install
cp .env.example .env
```

As principais variáveis de ambiente são:

```text
PORT=3000
JWT_SECRET=
CORS_ORIGIN=http://localhost:5173
CSV_DATABASE_PATH=./data
LEGACY_EXCEL_DATABASE_PATH=./data/users.xlsx
```

Quando `JWT_SECRET` não estiver definido, o backend usa o segredo salvo em
`data/jwt.secret`. Os dados são criados e atualizados nos arquivos CSV dentro
de `data/`.

## Executar

```bash
npm run dev
```

Para iniciar sem modo de desenvolvimento:

```bash
npm start
```

O endereço padrão é `http://localhost:3000`. A rota `GET /api/health` pode ser
usada para verificar se a API está disponível.

## Rotas principais

- `POST /api/auth/register/gm`: cria uma conta de GM
- `POST /api/auth/register`: cria uma conta de Player
- `POST /api/auth/login`: entra na conta e recebe o token JWT
- `GET/POST/PATCH/DELETE /api/campaigns`: gerencia campanhas
- `GET/POST/PATCH/DELETE /api/campaigns/:campaignId/members`: gerencia Players
  vinculados à campanha
- `GET/POST/PATCH/DELETE /api/campaigns/:campaignId/sections`: gerencia grupos
  de informações
- `GET/POST /api/sections/:sectionId/fields`: lista ou cria campos
- `PATCH/DELETE /api/fields/:fieldId`: altera ou remove campos
- `GET/POST /api/fields/:fieldId/options`: lista ou cria opções
- `PATCH/DELETE /api/field-options/:optionId`: altera ou remove opções
- `GET/POST/PATCH/DELETE /api/campaigns/:campaignId/characters`: gerencia
  personagens
- `GET/PUT/DELETE /api/characters/:characterId/values/:fieldId`: gerencia os
  valores dos campos da ficha

As rotas protegidas exigem o token no cabeçalho:

```text
Authorization: Bearer <token>
```

## Testes

```bash
npm test
```

## Organização

```text
src/
├── config/           # Configuração do ambiente e JWT
├── middleware/       # Funções intermediárias da API
├── repositories/     # Persistência dos dados em CSV
├── routes/           # Rotas HTTP
├── services/         # Regras de autenticação e RPG
├── app.js            # Configuração do Express
└── server.js         # Inicialização da API
data/                 # Arquivos CSV utilizados pela aplicação
testes http/          # Exemplos de chamadas HTTP
```