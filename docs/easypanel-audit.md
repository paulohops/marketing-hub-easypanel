# Auditoria de compatibilidade com EasyPanel

## Estado original

O projeto é uma aplicação full-stack Vite + React + Express + tRPC + Drizzle/PostgreSQL. O script de produção compila o frontend com Vite e empacota `server/_core/index.ts` em `dist/index.js`, portanto a base é compatível com um container Node no EasyPanel.

## Bloqueadores encontrados

1. O `server/_core/sdk.ts` ainda depende do OAuth do Manus e sincroniza usuários ausentes via `GetUserInfoWithJwt`.
2. `server/_core/storageProxy.ts` e `server/storage.ts` usam o Forge/Manus para presigned URLs; uploads e downloads quebrariam fora do Manus.
3. A autenticação local já existe em `server/routers/localAuth.ts`, mas o arquivo usa `TRPCError` sem import explícito.
4. `server/db.ts` usa `POSTGRES_URL`, enquanto `server/_core/env.ts` expõe `DATABASE_URL`; será padronizado para aceitar ambos e documentar `DATABASE_URL`.
5. `server/_core/index.ts` procura outra porta quando a escolhida está ocupada; em container isso deve ser evitado: usar `PORT` e bind em `0.0.0.0`.
6. `client/src/main.tsx`, `client/src/_core/hooks/useAuth.ts`, `client/src/const.ts` e `LoginPage.tsx` possuem redirecionamentos, storage e botão de OAuth do Manus.
7. A imagem do login usa `/manus-storage/cluster-mg-logo_947e1614.png`, que será substituída por asset local ou fallback.
8. O storage standalone será implementado em filesystem local configurável por `STORAGE_DIR`, servido por uma rota protegida contra path traversal. O EasyPanel deverá montar um volume persistente nesse diretório.
9. A build deve incluir Dockerfile e documentação de variáveis de ambiente para EasyPanel.

## Variáveis esperadas na versão standalone

Obrigatórias em produção: `NODE_ENV=production`, `PORT=3000`, `DATABASE_URL`, `JWT_SECRET`.

Bootstrap administrativo: `OWNER_OPEN_ID` opcional, `ADMIN_EMAIL` e `ADMIN_PASSWORD` recomendados para criação/atualização do primeiro administrador via script seguro.

Storage: `STORAGE_DIR=/data/storage` e `PUBLIC_APP_URL` opcional para URLs absolutas; a aplicação pode servir os arquivos em `/uploads/...`.

Integrações opcionais: `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_ID`, `GOOGLE_MAPS_API_KEY`, `OPENAI_API_KEY` ou equivalentes usados pelo código. Elas não devem impedir a inicialização quando ausentes.

Variáveis Manus/OAuth/Forge devem ser removidas do caminho de execução standalone.
