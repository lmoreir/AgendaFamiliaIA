# 📅 Agenda da Família IA

Assistente para pais organizarem atividades dos filhos via WhatsApp, com painel web e lembretes automáticos.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **TailwindCSS** — design system
- **Supabase** — banco PostgreSQL + autenticação + storage
- **Prisma** — ORM e migrations
- **Redis (Upstash)** — cache e filas
- **WhatsApp Business API** (Meta Cloud API)
- **Anthropic Claude** — NLP e agente IA
- **MCP Server** — ferramentas expostas ao Claude
- **Turborepo** — monorepo

## Pré-requisitos

- Node.js >= 18
- npm >= 9
- Docker (para dev local com PostgreSQL + Redis)
- Conta Supabase (gratuita)
- Conta Meta Business (para WhatsApp API)
- Chave de API Anthropic

## Setup em 5 minutos

### 1. Clonar e instalar

```bash
git clone <repo>
cd agenda-familia-ia
npm install
```

### 2. Subir serviços locais

```bash
docker-compose up -d
# Inicia PostgreSQL (5432) + Redis (6379) + Mailhog (8025)
```

### 3. Configurar variáveis de ambiente

```bash
cp apps/web/.env.local.example apps/web/.env.local
# Edite o .env.local com suas credenciais
```

Variáveis obrigatórias para o MVP:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
DIRECT_URL=
ANTHROPIC_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
REDIS_URL=redis://localhost:6379
CRON_SECRET=
```

### 4. Banco de dados

```bash
# Gerar cliente Prisma
npm run db:generate

# Aplicar schema ao banco local
npm run db:push

# (opcional) Abrir Prisma Studio
npm run db:studio
```

### 5. Rodar em desenvolvimento

```bash
npm run dev
# App: http://localhost:3000
```

## Estrutura do projeto

```
agenda-familia-ia/
├── apps/
│   ├── web/                  # Next.js 14 App Router
│   │   ├── app/              # Rotas e páginas
│   │   │   ├── (auth)/       # Login e cadastro
│   │   │   ├── (dashboard)/  # Painel principal
│   │   │   └── api/          # API REST + Webhooks + Cron
│   │   ├── components/       # Componentes React
│   │   └── lib/              # Utilitários e clientes
│   └── mcp-server/           # MCP Server TypeScript
├── packages/
│   ├── database/             # Prisma schema + migrations
│   ├── types/                # Tipos compartilhados
│   └── services/             # Lógica de negócio
└── docker-compose.yml        # Dev local
```

## Roadmap MVP (7 dias)

| Dia | Foco                              | Status  |
|-----|-----------------------------------|---------|
| 1   | Setup + infraestrutura            | ✅ Done |
| 2   | Autenticação (Supabase Auth)      | 🔜      |
| 3   | CRUD atividades + painel          | 🔜      |
| 4   | WhatsApp webhook                  | 🔜      |
| 5   | Claude IA + MCP Server            | 🔜      |
| 6   | Lembretes automáticos             | 🔜      |
| 7   | Polimento + deploy                | 🔜      |

## Webhook WhatsApp (configuração)

1. Acesse: Meta for Developers → App → WhatsApp → Configuration
2. Callback URL: `https://seu-dominio.vercel.app/api/whatsapp/webhook`
3. Verify Token: valor de `WHATSAPP_VERIFY_TOKEN` no .env
4. Campos a subscrever: `messages`

## Variáveis de ambiente completas

Ver: `apps/web/.env.local.example`

## Licença

Privado — MVP em desenvolvimento.
