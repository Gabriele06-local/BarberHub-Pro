# BarberHub Pro

Gestionale multi-tenant per barber shop: **aziende**, **sedi**, **staff** (ruoli), **clienti**, **appuntamenti**, **pagamenti**, **slot pubblici** per prenotazioni dal link `/book/[companyId]`.

Stack: **Next.js** (App Router), **Supabase** (Auth, Postgres, RLS), TypeScript.

---

## L’applicazione

### Flusso generale

- **`/`** — se Supabase non è configurato → `/setup`; se non sei loggato → `/login`; altrimenti reindirizza a **`/dashboard`** (o `/no-profile` se manca la riga in `public.profiles`).
- **`/login`** — accesso con Supabase Auth; dopo il login, **`/auth/callback`** completa la sessione.
- **`/setup`** — pagina guida quando mancano le variabili d’ambiente pubbliche.

### Area riservata `(dashboard)`

Layout comune con **sidebar** e intestazione; le voci di menu dipendono dal **ruolo** (vedi `src/lib/navigation.ts`):

| Ruolo | Voci tipiche |
|-------|----------------|
| **SUPER_ADMIN** | Dashboard, Aziende, Report |
| **ADMIN** | Dashboard, Team, Filiali, Calendario, Report |
| **MANAGER** | Dashboard, Team, Sede, Calendario, Report |
| **BARBER** | Dashboard, Calendario |

**Pagine principali**

- **`/dashboard`** — riepilogo: per molti ruoli include **clienti**, **ultimi pagamenti** e azioni rapide (nuovo cliente, nuovo pagamento); per `SUPER_ADMIN` vista “control room”; dove previsto anche **KPI** economici/operativi.
- **`/team`** — gestione staff (chi può farlo dipende da RLS e ruolo).
- **`/locations`** — filiali: per ADMIN tutte le sedi; per MANAGER contesto “sede” (incluso link pubblico `/book/...` dalla scheda azienda dove previsto).
- **`/calendar`** — calendario appuntamenti e, per chi gestisce la sede, **slot pubblici** (apertura/chiusura finestre prenotabili dal sito).
- **`/reports`**, **`/reports/monthly`**, **`/reports/annual`** — reportistica (visibilità legata al ruolo).
- **`/clients`** — elenco clienti azienda/sede.
- **`/payments`** — movimenti di cassa / categorie / metodo; il pagamento è legato al **cliente** (la sede deriva dall’anagrafica cliente).
- **`/companies`**, **`/companies/[companyId]`** — solo per **SUPER_ADMIN**: tenant e dettaglio (es. link prenotazione pubblica).

### Prenotazione pubblica (`/book`)

- **`/book/[companyId]`** — pagina per il cliente finale: sceglie sede (se più di una), data, orario disponibile (da RPC), barber opzionale, conferma prenotazione. Non richiede account; può usare **Supabase anon** + RPC `security definer`.
- **`/book/[companyId]/area-personale`** — area “i miei appuntamenti” in base a nome + recapito (telefono/email), con dati letti tramite API/RPC dedicate.

### Route API (Next)

- **`/api/public/availability`** — disponibilità per il flusso book.
- **`/api/public/my-bookings`** — storico prenotazioni lato pubblico.

Tutta la logica autorizzativa sensibile resta su **Postgres (RLS + RPC)**; le chiavi pubbliche nel browser non bypassano le policy.

---

## Ruoli e permessi (sintesi prodotto)

| Area | Cosa fa |
|------|---------|
| **Autenticazione** | Login Supabase; profilo in `public.profiles` con ruolo e (se applicabile) `company_id` / `location_id`. |
| **SUPER_ADMIN** | Panoramica tenant; gestione aziende lato “control room”. |
| **ADMIN** | Tutta l’azienda: sedi, staff, clienti, calendario, pagamenti, KPI. |
| **MANAGER** | Solo la propria **sede**: slot aperti al pubblico, calendario sede, clienti/pagamenti della sede. |
| **BARBER** | Calendario sui propri appuntamenti; lettura clienti collegati ai propri slot. |
| **Prenotazione pubblica** | RPC `rpc_public_*`: disponibilità, info azienda, creazione appuntamento da pagina `/book` (anon o autenticato). |
| **Profili automatici** | Trigger su `auth.users`: primo utente piattaforma → `SUPER_ADMIN`; successivi → nuova azienda + `ADMIN`; inviti con metadata `role` / `company_id` / `location_id`. |

Funzioni SQL esposte alla app (estratto; dettaglio nel file `supabase/schema.sql`):

- `public.my_company_id()`, `public.my_role()`, `public.my_location_id()`, `public.is_super_admin()` — helper per le policy RLS.
- `public.rpc_public_company_info`, `public.rpc_public_availability`, `public.rpc_public_book_appointment` — flusso prenotazione pubblica.
- `public.rpc_public_client_bookings` — recupero storico prenotazioni per telefono (dove previsto dallo schema).
- `public.handle_new_auth_user()` — trigger `on_auth_user_created` su `auth.users`.

---

## Requisiti

- Node.js **20+** (consigliato LTS).
- Account **Supabase** (progetto Postgres 15+; per gli indici `NULLS NOT DISTINCT` serve PG 15+).

---

## Setup repository

```bash
git clone <url-del-tuo-repo>
cd barberhub-pro
npm install
cp .env.example .env.local
```

Compila `.env.local` con URL e chiave anon/publishable dal pannello Supabase (**Settings → API**). Opzionale: `NEXT_PUBLIC_SITE_URL` per link assoluti a `/book`.

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Se mancano le env, la app rimanda a `/setup`.

---

## Database Supabase

### Nuovo progetto (consigliato per allineare tutto)

1. Crea un progetto su [supabase.com](https://supabase.com).
2. **SQL Editor** → incolla il contenuto di **`supabase/schema.sql`** → esegui l’intero script (termina con `commit;`).
3. **Authentication → URL configuration**: aggiungi l’URL del sito (es. `http://localhost:3000`) se usi redirect email/magic link.
4. **Settings → API → Reload schema** (cache client).

Il file **`supabase/schema.sql`** è l’unico script SQL del progetto: crea estensioni/tipi, tabelle, allineamenti dati leggeri (sede di default, `location_id` dove manca), funzioni, **RLS**, RPC e il trigger sui nuovi utenti. Anche per DB già avviati si usa lo stesso file (dopo backup se in produzione).

---

## Row Level Security (policy)

Le policy nel repository possono avere **nomi diversi** da etichette create manualmente in dashboard: l’importante è la **logica**. Dopo aver eseguito `schema.sql`, in Supabase vedrai policy coerenti con il file.

| Tabella | Comportamento (sintesi) |
|---------|-------------------------|
| **companies** | `SUPER_ADMIN` tutto; altri utenti vedono la propria azienda; insert solo super admin; update/delete secondo ruolo. |
| **locations** | Admin: tutte le sedi dell’azienda; Manager/Barber: solo la propria `location_id`. |
| **profiles** | Visibilità per company e sede; insert profili staff da ADMIN; regole update/delete per non superare i permessi. |
| **clients** | Due policy `FOR ALL` per **ADMIN** (tutta l’azienda) e **MANAGER/BARBER** (solo sede); più **`clients_select_barber`** per lettura clienti legati ad appuntamenti del barber. |
| **appointments** | Admin tutta azienda; Manager sede; Barber sulle proprie righe (`barber_id`). |
| **payments** | Admin tutta azienda; Manager solo `location_id` della propria sede (nessun accesso diretto barber: allinea al product se serve). |
| **location_open_slots** | Select/insert/delete: Admin azienda o Manager della sede dello slot. |

Se in dashboard compare ancora una policy unica tipo `clients_all_staff` / `payments_all`, è equivalente a **combinazioni** di più policy nel file attuale: rieseguire `schema.sql` (solo su DB di test o dopo backup) applica i nomi e le regole del repo.

---

## Cosa **non** committare

Già coperto da `.gitignore`:

- **Segreti**: `.env`, `.env.local`, file `*.local` con variabili.
- **Dipendenze / build**: `node_modules`, `.next`, `out`, `build`.
- **IDE/OS**: `.idea`, cache varie, `Thumbs.db`.

**Committare** invece **`.env.example`** (template senza valori reali).

La **service role** (`SUPABASE_SERVICE_ROLE_KEY`) va solo su ambienti server sicuri (mai nel browser).

---

## Script npm

| Comando | Uso |
|---------|-----|
| `npm run dev` | Server di sviluppo |
| `npm run build` | Build produzione |
| `npm run start` | Avvio dopo build |
| `npm run lint` | ESLint |

### Verifica in locale

- `npx tsc --noEmit` — controllo TypeScript (nessun errore atteso).
- `npm run build` — build di produzione (include check TS).
- `npm run lint` — può segnalare regole strict su alcuni `useEffect` / purezza render; **non blocca** la build di default, ma conviene ripulire nel tempo.

---

## Deploy

- **Frontend**: Vercel (o altro host Node) con le stesse variabili `NEXT_PUBLIC_*` del progetto Supabase.
- **Backend dati**: resta su Supabase; aggiorna URL di redirect Auth con il dominio produzione.

---

## Licenza

Definisci la licenza nel repository (es. proprietaria o MIT) secondo le tue esigenze.
