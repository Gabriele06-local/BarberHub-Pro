# BarberHub Pro

[![CI](https://github.com/Gabriele06-local/BarberHub-Pro/actions/workflows/ci.yml/badge.svg)](https://github.com/Gabriele06-local/BarberHub-Pro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **SaaS multi-tenant per barber shop** — gestione completa di aziende, sedi, staff, clienti, appuntamenti, pagamenti e prenotazioni pubbliche.

---

## Panoramica

BarberHub Pro è un gestionale SaaS pensato per catene di barber shop. Ogni **azienda** (tenant) può avere più **sedi**, ognuna con il proprio **staff** (ruoli gerarchici), **clienti**, **appuntamenti** e **pagamenti**. I clienti possono prenotare online senza registrazione tramite un link pubblico.

### Architettura

```
┌─────────────────────────────────────────────────┐
│                  Next.js 16 App Router          │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Pubbliche│ │ Dashboard │ │ API routes       │ │
│  │ /book/*  │ │ /dashboard│ │ /api/public/*    │ │
│  └─────────┘ └──────────┘ └──────────────────┘ │
│         │           │               │           │
├─────────┴───────────┴───────────────┴───────────┤
│               Supabase (Auth + DB)              │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Auth    │ │ Postgres │ │ RLS + RPC      │  │
│  │ (SSO)    │ │ (15+)    │ │ (security)     │  │
│  └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Stack**: [Next.js 16](https://nextjs.org/) (App Router) · [Supabase](https://supabase.com/) (Auth, Postgres, RLS) · TypeScript · Tailwind CSS v4 · Zod · Vitest · Playwright

---

## Funzionalità

### 👑 Multi-tenant
- Aziende (tenant) isolate con dati separati via RLS
- Ruoli gerarchici: `SUPER_ADMIN` → `ADMIN` → `MANAGER` → `BARBER`
- Ogni ruolo vede solo i dati che gli competono

### 📅 Gestione appuntamenti
- Calendario con viste giorno / 3 giorni / settimana / mese
- Slot pubblici configurabili (ricorrenti o singoli giorni)
- Creazione rapida dalla griglia oraria
- Conferma / gestione stato appuntamenti

### 💰 Pagamenti e cassa
- Registrazione pagamenti per cliente
- Categorie e metodi (cash, SRL, privato)
- Report mensili e annuali con grafici

### 🌐 Prenotazione pubblica
- Link diretto `/book/[companyId]`
- Clienti prenotano senza registrazione
- Area personale per consultare storico
- API pubbliche protette da RPC `security definer`

### 🔐 Sicurezza
- Row Level Security su tutte le tabelle
- Rate limiting (in-memory o Upstash Redis)
- Security headers (CSP, HSTS, X-Frame-Options)
- CSRF protection su form mutativi
- Sanitizzazione input lato server
- Trace ID per correlazione log / errori

---

## Screenshot

*(Aggiungi screenshot qui — es. dashboard, calendario, pagina di prenotazione)*

| Dashboard | Calendario | Prenotazione |
|-----------|-----------|--------------|
| ![][screenshot-dash] | ![][screenshot-cal] | ![][screenshot-book] |

---

## Guida rapida

### Prerequisiti

- Node.js **20+** (LTS consigliato)
- Progetto **Supabase** (Postgres 15+)

### Setup

```bash
git clone https://github.com/Gabriele06-local/BarberHub-Pro.git
cd BarberHub-Pro
npm install
cp .env.example .env.local
```

Compila `.env.local` con i dati del tuo progetto Supabase (Settings → API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tua-chiave-anon
```

Avvia il server di sviluppo:

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

### Database

1. **SQL Editor** Supabase → incolla `supabase/db.sql` → esegui
2. **Auth → URL Configuration**: aggiungi `http://localhost:3000`
3. **Settings → API → Reload schema cache**

Lo script crea: tabelle, enum, RLS policies, funzioni RPC, trigger profili automatici.

---

## Scripts

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Server di sviluppo |
| `npm run build` | Build produzione |
| `npm run start` | Avvio dopo build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit test (watch) |
| `npm run test:run` | Unit test (CI) |
| `npm run test:coverage` | Unit test + coverage |
| `npm run test:e2e` | E2E test (Playwright) |
| `npm run check` | lint + typecheck + test |

---

## Struttura del progetto

```
barberhub-pro/
├── src/
│   ├── app/              # Next.js App Router (route, layout, API)
│   ├── actions/          # Server Actions
│   ├── components/       # UI Components
│   │   ├── ui/           # Button, Card, Badge, Table, etc.
│   │   ├── auth/         # LoginForm
│   │   ├── book/         # Prenotazione pubblica
│   │   ├── calendar/     # Calendario e slot
│   │   ├── companies/    # Gestione aziende
│   │   ├── dashboard/    # Dashboard e KPI
│   │   ├── layout/       # Sidebar, DashboardShell
│   │   └── reports/      # Report mensili/annuali
│   ├── lib/
│   │   ├── services/     # Business logic (auth, company, client, etc.)
│   │   ├── supabase/     # Client Supabase (server, client, admin, middleware)
│   │   ├── booking/      # Logica slot e calendario
│   │   ├── security/     # Rate limiting, CSRF, headers, sanitize
│   │   ├── validation/   # Zod schemas
│   │   └── utils/        # cn(), formatCurrency
│   ├── middleware.ts      # Security headers, rate limit, trace ID, CSRF
│   ├── instrumentation.ts # Sentry init
│   └── types/            # TypeScript types
├── e2e/                  # Playwright E2E tests
├── supabase/
│   └── db.sql            # Database completo (DDL + RLS + RPC + trigger)
├── .github/workflows/    # CI/CD
├── Dockerfile            # Multi-stage production build
├── docker-compose.yml    # Servizio app
└── vitest.config.ts      # Vitest configuration
```

---

## CI/CD

Il workflow `.github/workflows/ci.yml` esegue su push/PR:

1. **Lint & Type Check** — ESLint + `tsc --noEmit`
2. **Unit Tests** — Vitest + coverage
3. **E2E Tests** — Playwright (Chromium)
4. **Build** — Next.js production build

Con **caching** per npm, ESLint, Vitest, Next.js, Playwright.

---

## Docker

```bash
# Costruisci e avvia
docker compose up --build

# Oppure build manuale
docker build -t barberhub-pro .
docker run -p 3000:3000 --env-file .env.local barberhub-pro
```

---

## Roadmap

- [ ] Appuntamenti ricorrenti automatici
- [ ] Notifiche email/SMS (Supabase Edge Functions)
- [ ] Dashboard multi-sede con confronto KPI
- [ ] App mobile (React Native / Expo)
- [ ] Integrazione pagamenti digitali (Stripe)
- [ ] Import/export dati (CSV)

---

## Licenza

MIT — vedi [LICENSE](LICENSE).

---

## Contribuire

1. Fork del repository
2. Crea un branch (`git checkout -b feature/novita`)
3. Commit (`git commit -m 'Aggiunta nuova funzionalità'`)
4. Push (`git push origin feature/novita`)
5. Apri una Pull Request

Prima di aprire PR, assicurati che passi:

```bash
npm run check
npm run test:e2e
```

<!-- Placeholder per screenshot futuri -->
[screenshot-dash]: #
[screenshot-cal]: #
[screenshot-book]: #
