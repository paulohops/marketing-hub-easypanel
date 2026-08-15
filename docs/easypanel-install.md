# Instalação do Marketing HUB no EasyPanel

## 1. Pré-requisitos

A instalação precisa de um serviço PostgreSQL persistente e de um serviço de aplicação que consiga construir o `Dockerfile` deste repositório. O serviço de aplicação deve expor a porta interna **8978**. Não é necessário configurar Node, pnpm ou Nginx manualmente no host: o Dockerfile já contém Node.js 22, instala as dependências, executa a checagem TypeScript e cria o artefato de produção.

O banco pode ser um serviço PostgreSQL dentro do próprio EasyPanel ou um PostgreSQL gerenciado externo. Quando os serviços estão na mesma rede do EasyPanel, use o nome DNS interno do serviço no `DATABASE_URL`; não use `localhost`, pois dentro do container `localhost` aponta para o próprio container da aplicação.

## 2. Criar o serviço a partir do GitHub

No EasyPanel, crie um novo projeto e adicione um serviço do tipo aplicação conectado ao GitHub. Selecione o repositório privado `paulohops/marketing-hub-easypanel`, a branch `main` e o contexto raiz do projeto. Escolha **Dockerfile** como método de build; o arquivo já está na raiz do repositório.

Configure a porta interna como `8978` e, se o painel permitir health check, use o caminho `GET /health`. A resposta esperada é um JSON semelhante a `{"ok":true,"service":"trade-hub"}`. O processo já faz bind em `0.0.0.0`, portanto não deve ser configurado para `127.0.0.1`.

## 3. Configurar o volume persistente

Adicione um volume persistente ao serviço e monte-o em `/data/storage`. Esse diretório guarda imagens, documentos, capas, logos e evidências enviados pelos usuários. A variável `STORAGE_DIR` do container deve permanecer com o valor `/data/storage`.

> Sem esse volume, a aplicação funcionará, mas todos os arquivos enviados serão perdidos quando o container for recriado, atualizado ou movido para outro nó.

Faça backup desse volume junto com o PostgreSQL. Os registros do banco guardam as chaves e URLs dos arquivos, enquanto o conteúdo binário fica no volume.

## 4. Variáveis de ambiente

Adicione as variáveis abaixo na área de Environment do serviço. O arquivo [`.env.example`](../.env.example) contém o mesmo contrato em formato copiável.

| Variável | Obrigatória | Valor recomendado ou finalidade |
|---|---:|---|
| `NODE_ENV` | Sim | `production` |
| `PORT` | Sim | `8978` |
| `APP_ID` | Não | `marketing-hub-easypanel` |
| `PUBLIC_APP_URL` | Não | URL pública HTTPS da aplicação; por exemplo `https://marketing.seu-dominio.com` |
| `DATABASE_URL` | Sim | URL completa do PostgreSQL |
| `DATABASE_SSL` | Não | `false` para PostgreSQL interno; `true` quando o provedor exigir TLS |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Não | `true` por padrão; use `false` somente quando o certificado externo não puder ser validado |
| `DATABASE_POOL_MAX` | Não | `8` |
| `JWT_SECRET` | Sim | Segredo aleatório longo, preferencialmente com pelo menos 32 caracteres |
| `STORAGE_DIR` | Sim | `/data/storage` |
| `RUN_MIGRATIONS` | Não | `true`; executa migrations pendentes antes de iniciar o servidor |
| `RUN_ADMIN_BOOTSTRAP` | Não | `true`; executa bootstrap quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` estiverem preenchidos |
| `ADMIN_EMAIL` | Para bootstrap | E-mail do primeiro administrador |
| `ADMIN_PASSWORD` | Para bootstrap | Senha com pelo menos 12 caracteres, minúscula, maiúscula e número |
| `ADMIN_NAME` | Não | Nome exibido para o administrador |
| `ADMIN_RESET_PASSWORD` | Não | `false`; altere para `true` somente ao redefinir a senha existente |
| `TRELLO_API_KEY` | Não | Chave da API do Trello, caso a integração seja usada |
| `TRELLO_TOKEN` | Não | Token da API do Trello, caso a integração seja usada |
| `NOTIFICATION_WEBHOOK_URL` | Não | Webhook genérico para notificações administrativas |
| `NOTIFICATION_WEBHOOK_TOKEN` | Não | Token Bearer opcional do webhook |
| `GOOGLE_MAPS_API_KEY` | Não | Reserva para recursos de mapas que usem chave própria |
| `OPENAI_API_KEY` | Não | Reserva para recursos de IA que usem chave própria |

A instalação standalone **não precisa** de `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_ANALYTICS_ENDPOINT` ou `VITE_ANALYTICS_WEBSITE_ID`. Não copie variáveis do Manus para este serviço.

## 5. Publicar a primeira versão

Depois de salvar as variáveis e o volume, faça o primeiro deploy. O container deve construir o frontend, gerar `dist/index.js` e iniciar o entrypoint `scripts/entrypoint.sh`. Verifique o log até aparecer `Trade HUB running on port 8978`.

Antes do deploy, confirme que o serviço PostgreSQL está acessível a partir do container. Se o banco usar TLS, defina `DATABASE_SSL=true`; para uma conexão interna sem TLS, deixe `DATABASE_SSL=false` e, se necessário, inclua os parâmetros exigidos pelo próprio `DATABASE_URL`.

## 6. Primeiro deploy e atualizações do banco

O entrypoint executa automaticamente `node scripts/ensure-schema.mjs` antes de iniciar a aplicação. Esse script consulta o PostgreSQL e segue este fluxo seguro:

| Estado encontrado | Ação |
|---|---|
| A tabela `users` não existe | Trata como primeiro deploy e executa todas as migrations versionadas para criar o schema. |
| A tabela `users` e `__drizzle_migrations` existem | Executa somente as migrations pendentes; as já aplicadas não são repetidas. |
| `users` existe, mas não existe histórico `__drizzle_migrations` | Interrompe o deploy sem alterar o banco, evitando recriar ou sobrescrever um schema não rastreado. |

Portanto, no fluxo normal do EasyPanel, **não é necessário executar manualmente `pnpm db:migrate` em cada deploy**. O container roda a verificação automaticamente. O comando manual equivalente, disponível para manutenção, é:

```bash
pnpm db:ensure
```

O comando `db:push` foi removido da versão publicada para impedir geração de migrations dentro do container. As alterações de schema devem ser criadas e revisadas no ambiente de desenvolvimento, versionadas na pasta `drizzle/` e então aplicadas automaticamente no próximo deploy.

## 7. Criar o primeiro administrador

Com `ADMIN_EMAIL`, `ADMIN_PASSWORD` e, opcionalmente, `ADMIN_NAME` configurados, o entrypoint executa automaticamente `node scripts/bootstrap-admin.mjs`. O script cria a conta local com role `admin`, hash bcrypt e identificador estável. Se a conta já existir, ele a ativa e mantém a senha atual, a menos que `ADMIN_RESET_PASSWORD=true` esteja configurado.

Depois do primeiro acesso, mantenha `RUN_ADMIN_BOOTSTRAP=true` ou altere para `false` conforme sua política operacional. A rotina não remove usuários nem dados; ela apenas garante a conta administrativa configurada. Para redefinir uma senha, defina `ADMIN_RESET_PASSWORD=true` durante um deploy e depois retorne o valor para `false`.

Em seguida, acesse a URL pública e entre pela tela local com e-mail e senha. O botão de OAuth institucional foi removido da edição standalone.

## 8. Domínio e HTTPS

Aponte o domínio no EasyPanel para o serviço e habilite o certificado TLS do painel. O servidor considera `X-Forwarded-Proto`, então os cookies HTTP-only de sessão funcionam corretamente atrás do proxy HTTPS. Em desenvolvimento local, o cookie é emitido sem `Secure`; em produção atrás de HTTPS, ele recebe as proteções apropriadas.

Use o domínio público também em `PUBLIC_APP_URL` para manter a configuração explícita. A aplicação não depende dessa variável para iniciar.

## 9. Atualizações

Para atualizar, envie as alterações para a branch `main` do repositório e acione um novo deploy no EasyPanel. O Dockerfile usa camadas: enquanto `package.json` e `pnpm-lock.yaml` não mudarem, a camada de dependências pode ser reutilizada pelo cache do builder. Mesmo quando uma nova imagem instala dependências novamente, isso ocorre dentro do container e não apaga dados externos.

O entrypoint aplica automaticamente somente migrations pendentes antes de iniciar o servidor. O volume `/data/storage` e o serviço PostgreSQL devem ser preservados durante atualizações. Não use uma estratégia de deploy que apague esses recursos nem altere `DATABASE_URL` para apontar para um banco novo.

## 10. Diagnóstico

| Sintoma | Verificação |
|---|---|
| Container reinicia dizendo `JWT_SECRET` ausente | Adicione um segredo não vazio em `JWT_SECRET`. |
| Container reinicia dizendo `DATABASE_URL` ausente | Configure a URL completa do PostgreSQL. |
| Login informa banco indisponível | Verifique DNS interno, porta, usuário, senha, firewall e `DATABASE_SSL`. |
| Login mostra `Failed query` ao consultar `users` | Confirme que `DATABASE_URL` aponta para o mesmo banco usado pelo deploy, mantenha `RUN_MIGRATIONS=true`, faça redeploy do commit mais recente e verifique no log as colunas ausentes ou migrations pendentes. |
| `ERR_MODULE_NOT_FOUND: Cannot find package 'vite' imported from /app/dist/index.js` | O serviço está usando um commit antigo ou um bundle antigo que importava Vite. Faça redeploy do commit corrigido mais recente; o entrypoint de produção agora não importa Vite. |
| Health check falha | Use porta `8978`, caminho `/health` e protocolo HTTP interno. |
| Upload retorna 404 | Confirme o volume em `/data/storage` e a variável `STORAGE_DIR`. |
| Upload funciona, mas arquivo some após redeploy | O volume não está persistente ou está montado em caminho diferente. |
| Tela abre, mas assets não carregam | Verifique o log de build e se o serviço está entregando a porta `8978`. |
| Integração Trello informa não configurada | Adicione `TRELLO_API_KEY` e `TRELLO_TOKEN`; o núcleo da aplicação não depende dessas chaves. |

## 11. Segurança operacional

Use segredos diferentes para `JWT_SECRET`, PostgreSQL e Trello. Restrinja o acesso ao PostgreSQL à rede do EasyPanel quando possível. Mantenha HTTPS habilitado, não exponha a porta do banco publicamente sem necessidade e faça backups regulares do banco e do volume de storage.
