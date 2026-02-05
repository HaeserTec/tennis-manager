# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture Overview

Tennis Tactics Lab is a React 19 PWA for tennis academy management, combining a 2D diagram editor with player/client management. Uses Vite, TypeScript, and Tailwind CSS.

### Entry Points & Core Structure

- `index.tsx` - App bootstrap with `DataProvider` context and PWA registration
- `App.tsx` - Main app component (~1800 lines), handles routing via `appMode` state, authentication, and all major views
- `lib/data-provider.tsx` - Centralized data context with localStorage persistence and optional Supabase sync
- `lib/playbook.ts` - All TypeScript interfaces (Drill, Player, Client, TrainingSession, etc.)

### Navigation Modes (`AppMode`)

The app uses a single-page architecture with mode-based navigation:
- `standard` - Drill editor with diagram canvas
- `sessions` - Session plan builder
- `players` - LockerRoom (player management)
- `office` - AcademyOffice (scheduling, billing, directory)
- `templates` - Drill templates
- `library` - Drill library browser
- `clients` - ClientDashboard (parent accounts)

### Key Components

| Component | Purpose |
|-----------|---------|
| `PlaybookDiagramV2.tsx` | 2D tennis court canvas editor (largest component, ~3000 lines) |
| `AcademyOffice.tsx` | Scheduling, billing, weekly planner, payment ledger, expense tracker |
| `LockerRoom.tsx` | Player roster and profile management |
| `ClientDashboard.tsx` | Parent/client account management |
| `DrillLibrary.tsx` | Drill browser with categories and search |
| `NavigationRail.tsx` | Vertical navigation sidebar |
| `MobileFAB.tsx` | Mobile floating action button |

### Data Layer

**Hybrid Storage Strategy:**
- Primary: localStorage with debounced writes
- Optional: Supabase sync when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Uses snake_case ↔ camelCase transformation for Supabase

**Core Entities (defined in `lib/playbook.ts`):**
- `Drill` - Drill definitions with diagram state
- `Player` - Student profiles with stats, schedule, DNA
- `Client` - Parent/account holder with payment ledger
- `TrainingSession` - Scheduled session instances
- `SessionLog` - Per-session scoring (tech, consistency, tactics, movement, coachability)

### Database Schema

Supabase schema in `supabase/schema.sql` - all tables use Row Level Security with `auth.uid() = user_id` policy.

### Styling

- Tailwind CSS with CSS variable-based theming (dark/light/midnight modes)
- UI components in `components/ui/` use shadcn/ui patterns
- Theme variables defined in `index.css` using HSL format

### Environment Variables

```
VITE_SUPABASE_URL=      # Optional Supabase project URL
VITE_SUPABASE_ANON_KEY= # Optional Supabase anon key
GEMINI_API_KEY=         # For AI features (exposed as process.env.API_KEY)
```

### Localization Conventions

- Currency: South African Rand (R)
- Time: 24-hour format
- Units: Metric (cm, kg)
