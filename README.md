# Marketing HUB — EasyPanel

Plataforma web para gestão de trade marketing, com módulos de campanhas, ações, eventos, mídias, estoque, financeiro, documentos, cadastros, permissões, auditoria e integração opcional com Trello.

Esta edição foi preparada para execução externa ao Manus. O runtime é formado por **Node.js 22, Express, tRPC, React/Vite, Drizzle ORM e PostgreSQL**. A autenticação principal usa e-mail e senha locais com hash bcrypt e sessões JWT assinadas pelo próprio servidor. O armazenamento de documentos e imagens usa o filesystem local, configurado por `STORAGE_DIR`, e deve ser montado em um volume persistente do EasyPanel.

## Início rápido

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm bootstrap:admin
pnpm dev
```

Para produção, use o `Dockerfile` incluído. A imagem escuta em `0.0.0.0:8978`, expõe `GET /health` e monta o armazenamento em `/data/storage`. O entrypoint verifica o estado do PostgreSQL, cria o schema no primeiro deploy quando o banco está vazio e aplica apenas migrations pendentes nos deploys seguintes. A reinstalação de dependências durante o build ocorre dentro da imagem e não apaga o banco nem o volume persistente.

## Comandos principais

| Comando | Finalidade |
|---|---|
| `pnpm check` | Verifica os tipos TypeScript. |
| `pnpm build` | Compila o frontend e empacota o servidor. |
| `pnpm test` | Executa a suíte de testes. Integrações externas são puladas sem credenciais. |
| `pnpm db:migrate` | Aplica somente as migrations SQL versionadas que ainda não foram executadas. |
| `pnpm db:ensure` | Verifica o estado do banco e executa o mesmo fluxo seguro usado pelo entrypoint. |
| `pnpm bootstrap:admin` | Cria ou atualiza o primeiro administrador local a partir das variáveis `ADMIN_*`. |
| `pnpm start` | Inicia o artefato compilado em modo produção. |

## Configuração

Copie `.env.example` para `.env` em desenvolvimento. No EasyPanel, configure as mesmas chaves na seção de variáveis de ambiente do serviço; não faça commit de `.env`.

O procedimento completo, incluindo PostgreSQL, volume persistente, domínio, migrações, bootstrap e diagnóstico, está em [`docs/easypanel-install.md`](docs/easypanel-install.md). A auditoria de compatibilidade está em [`docs/easypanel-audit.md`](docs/easypanel-audit.md).

## Orientação para agentes de código

As instruções de arquitetura, rotas, permissões, padrão visual e regras para evitar implementações improvisadas estão em [`AGENTS.md`](AGENTS.md) e no guia completo [`docs/ai-system-guide.md`](docs/ai-system-guide.md). O módulo de campanhas e ações é a referência canônica para novas telas operacionais.

## Licença

MIT.
