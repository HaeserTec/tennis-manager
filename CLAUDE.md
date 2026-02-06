# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

There are no test or lint commands configured. The project has no test framework, ESLint, or Prettier setup.

## Project Overview

Tennis Tactics Lab is a React 19 PWA for tennis academy management. It combines a 2D tennis court diagram editor with player/client management, session scheduling, scoring, billing, and analytics. Built with Vite, TypeScript, and Tailwind CSS.

## Repository Structure

```
/
├── index.html                  # HTML entry point with CDN import maps
├── index.tsx                   # App bootstrap: DataProvider context + PWA registration
├── index.css                   # Tailwind directives + HSL theme variables (dark/light/midnight)
├── App.tsx                     # Main app (~1490 lines): routing, auth, layout, all major views
├── components/                 # React components (26 files, ~12,200 lines total)
│   ├── PlaybookDiagramV2.tsx   # 2D tennis court canvas editor (~3200 lines, largest component)
│   ├── AcademyOffice.tsx       # Scheduling, billing, weekly planner, expenses (~1270 lines)
│   ├── LockerRoom.tsx          # Player roster & profile management (~890 lines)
│   ├── ClientDashboard.tsx     # Parent/client account management
│   ├── ClientEditPanel.tsx     # Client profile editing panel
│   ├── Scoreboard.tsx          # Session scoring (5-dimension)
│   ├── SessionBuilder.tsx      # Session plan creation/editing
│   ├── DrillLibrary.tsx        # Drill browser with categories, tags, search
│   ├── PlayerProgress.tsx      # Player progress tracking with goals
│   ├── InsightsDashboard.tsx   # Analytics dashboard for academy metrics
│   ├── AcademyCourtView.tsx    # Spatial court visualization with draggable avatars
│   ├── SettingsDialog.tsx      # Global config (locations, rates, session types)
│   ├── HomeDashboard.tsx       # Quick actions and recent activity
│   ├── NavigationRail.tsx      # Vertical nav sidebar (defines AppMode type)
│   ├── MobileFAB.tsx           # Mobile floating action button
│   ├── LandingScreen.tsx       # Initial landing/intro screen
│   ├── DrillThumbnail.tsx      # Drill card preview
│   ├── SessionEditPanel.tsx    # Session instance editing
│   ├── SessionPlanDocument.tsx # PDF export for session plans
│   ├── ClientStatementDocument.tsx # PDF export for client statements
│   ├── AccountsStatement.tsx   # Account statement view
│   ├── ProgressChart.tsx       # Progress visualization
│   ├── RadarChart.tsx          # Radar/spider chart for player stats
│   ├── RadialMenu.tsx          # Circular context menu
│   ├── Logo.tsx                # Logo component
│   ├── ThemeToggle.tsx         # Theme switcher (dark/light/midnight)
│   └── ui/                     # shadcn/ui-style primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── select.tsx
│       └── tooltip.tsx
├── lib/                        # Core logic & utilities
│   ├── playbook.ts             # All TypeScript interfaces and domain types
│   ├── data-provider.tsx       # Centralized React Context with localStorage + optional Supabase sync
│   ├── analytics.ts            # Score computation, trends, financial analytics
│   ├── hooks.ts                # Custom hooks: progress tracking, drill organization, data import/export
│   ├── utils.ts                # Utilities: cn(), nanoid(), debounce(), geometry helpers
│   └── supabase.ts             # Supabase client initialization (optional)
├── supabase/
│   └── schema.sql              # Full database schema (12 tables with RLS)
├── docs/plans/                 # Design documents and implementation plans
├── public/                     # Static assets (icons, logos)
├── vite.config.ts              # Vite config: port 3000, PWA plugin, path aliases, env vars
├── tsconfig.json               # TypeScript: ES2022, bundler resolution, @/* path alias
├── tailwind.config.js          # Tailwind: class-based dark mode, HSL CSS variable theming
└── postcss.config.js           # PostCSS: Tailwind + Autoprefixer
```

## Architecture

### Navigation & Routing

The app uses a single-page architecture with mode-based navigation (no router library). The `AppMode` type is defined in `NavigationRail.tsx`:

```typescript
type AppMode = 'standard' | 'performance' | 'plans' | 'players' | 'templates' | 'office' | 'scoreboard' | 'library'
```

| Mode | View | Description |
|------|------|-------------|
| Home | `HomeDashboard` | Quick actions and recent activity (controlled by `isHome` flag) |
| `standard` | `PlaybookDiagramV2` | 2D drill editor with canvas drawing |
| `performance` | Sequence editor | Animated drill sequences |
| `plans` | `SessionBuilder` | Session planning |
| `players` | `LockerRoom` | Player roster, profiles, stats, DNA |
| `scoreboard` | `Scoreboard` | Per-session 5-dimension scoring |
| `office` | `AcademyOffice` | Scheduling, billing, weekly planner, expense tracker |
| `templates` | Template management | Drill template CRUD |
| `library` | `DrillLibrary` | Browse and search drills |

### State Management

**React Context + localStorage** — no Redux or Zustand.

- `DataProvider` (`lib/data-provider.tsx`) wraps the entire app and manages all entities
- Access via `useData()` hook
- Provides CRUD operations for all entities: drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents, expenses
- Persistence: debounced writes to localStorage
- Optional Supabase sync with snake_case ↔ camelCase transformation and conflict resolution
- Special operations: `mergeClients()`, `forceSync()`, `importData()`, `uploadFile()`

### Core Domain Types (`lib/playbook.ts`)

| Type | Description |
|------|-------------|
| `Drill` | Drill definitions with diagram state, metadata, tags |
| `Player` | Student profiles (build, stats, schedule, DNA, equipment, progression) |
| `Client` | Parent/account holder (contact, payments, status) |
| `TrainingSession` | Scheduled session instances (date, time, location, price, participants) |
| `SessionLog` | Per-session scores: tech, consistency, tactics, movement, coachability |
| `SessionPlan` | Grouped drill plans with ordered items |
| `DrillTemplate` | Reusable diagram templates |
| `Sequence` | Animated drill sequences with frames |
| `Term` | Academic terms/periods |
| `DayEvent` | Calendar events (rain, holidays, tournaments, cancellations) |
| `LocationConfig` | Training location settings |
| `Expense` | Operational cost tracking |
| `ProgressGoal` | Player skill improvement targets |

### Data Layer

**Hybrid storage strategy:**
- **Primary:** localStorage with debounced writes
- **Optional:** Supabase sync when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- snake_case ↔ camelCase transformation is handled automatically for Supabase
- Foreign key validation (e.g., player → client relationships)
- Supabase client in `lib/supabase.ts` — gracefully falls back to localStorage-only mode

### Database Schema

Supabase schema in `supabase/schema.sql`. 12 tables, all with Row Level Security (`auth.uid() = user_id`):

drills, drill_templates, sequences, session_plans, clients, players, training_sessions, locations, session_logs, terms, day_events, curriculums

Key relationships:
- `players.client_id` → `clients.id` (ON DELETE SET NULL)
- `session_logs.player_id` → `players.id` (ON DELETE CASCADE)

### Authentication

Optional Supabase auth with two roles: **coach** (admin) and **client** (parent). Auth state checked on mount, data sync triggered on auth success.

## Styling & Theming

- **Tailwind CSS 3.4** with CSS variable-based theming using HSL values
- **Three themes:** Dark (default), Light, Midnight — toggled via `class` on `<html>`
- **UI primitives:** `components/ui/` follows shadcn/ui patterns (Button, Card, Input, Select, DropdownMenu, Tooltip)
- **Font:** Inter (via system-ui fallback)
- **Custom CSS utilities** in `index.css`: `.glass`, `.glass-card`, `.border-glow`, `.surface-card`, `.text-gradient`, `.glow-primary`
- **Color system:** HSL CSS variables (e.g., `--primary`, `--background`, `--foreground`) defined per theme in `index.css`
- **Primary brand color:** Magenta (#d946ef)

## Import Aliases

The `@/` alias maps to the project root (configured in both `vite.config.ts` and `tsconfig.json`):

```typescript
import { Button } from '@/components/ui/button';
import { useData } from '@/lib/data-provider';
import type { Drill } from '@/lib/playbook';
```

## Key Utilities (`lib/utils.ts`)

- `cn(...classes)` — Merge Tailwind classes (clsx + tailwind-merge)
- `nanoid()` — Generate 16-char random IDs
- `safeJsonParse(str, fallback)` — Safe JSON parsing
- `debounce(fn, ms)` — Debounce function
- `arrayMove(arr, from, to)` — Reorder array elements
- `nowMs()` — Current timestamp in milliseconds
- `downloadTextFile(name, content)` / `readTextFile(file)` — File I/O helpers
- `getPointDistance()` / `getPathLength()` — Geometry for diagram editor

## Environment Variables

```bash
VITE_SUPABASE_URL=        # Optional: Supabase project URL
VITE_SUPABASE_ANON_KEY=   # Optional: Supabase anon key
GEMINI_API_KEY=           # Optional: For AI features (exposed as process.env.API_KEY)
```

No `.env` file is committed. These are all optional — the app works fully offline with localStorage.

## PWA Configuration

Configured via `vite-plugin-pwa` in `vite.config.ts`:
- Auto-update registration with service worker
- Workbox caching for JS, CSS, HTML, images, SVG
- CDN cache for `aistudiocdn.com` assets (1-year expiration)
- Navigation fallback to `index.html`
- Installable on iOS/Android

## Localization Conventions

- **Currency:** South African Rand (R)
- **Time:** 24-hour format
- **Units:** Metric (cm, kg)
- **Language:** English (with some Afrikaans in HTML meta — "Tennis Bestuur", "Beplanning en Administrasie")

## Conventions for AI Assistants

- **No test framework** exists — there are no tests to run. `npm run build` is the primary validation step.
- **No linter/formatter** — follow existing code style: 2-space indentation, single quotes for imports, template literals where natural.
- **Large files are normal** — `PlaybookDiagramV2.tsx` (~3200 lines) and `App.tsx` (~1490 lines) are intentionally large single-file components. Do not split them unless explicitly asked.
- **All source files are at the project root or in `components/`/`lib/`** — there is no `src/` directory.
- **IDs use `nanoid()`** from `lib/utils.ts` (16-char random strings).
- **Timestamps use milliseconds** (`nowMs()` / `Date.now()`), stored as `bigint` in Supabase.
- **State changes go through `useData()`** — never write directly to localStorage. Always use the context's CRUD methods.
- **The `@/` import alias** should be used for all cross-directory imports.
