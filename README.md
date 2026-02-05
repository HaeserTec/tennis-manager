# Tactics Lab (Drills Lab) — Professional Academy Edition

This project is an optimized and feature-upgraded version of the Tennis Tactics Lab, now including comprehensive academy management tools and advanced workflow optimizations.

## Project Context

### Overview
Tactics Lab is a student-centric management and tactical visualization platform for tennis academies. It combines a 2D diagram editor with a 4-tier player evaluation system and a reusable template workflow.

### Tech Stack
- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS (glassmorphism and neon presets)
- **Icons:** `lucide-react`
- **PWA:** `vite-plugin-pwa`
- **Export:** `jspdf` and `html2canvas`

### Architecture

#### Navigation
- **Home:** Dashboard with quick actions and recent activity.
- **Tactics:** Drill Library, Session Plans, and Animated Sequences.
- **The Squad:** Roster management, technical stats, and player DNA.
- **Academy Office:** Scheduling, weekly planning, and billing.
- **Templates:** Reusable canvas setups.

#### Operational Workflows
- **Planner:** Visual timeline for multi-location daily schedules, with "Week at a Glance" and location filters.
- **Billing Engine:** Automated statements based on attendance history and scheduled rates (ZAR/R).
- **Settings:** Global configuration for training locations, hourly rates, and session types.

#### Player Data Model
- `build`: Handedness, play style, physical specs.
- `schedule`: Recurring weekly slots (time, location, type, fee).
- `attendance`: Timestamp array of verified presence.
- `account`: Billing status and credits.
- `intel`: Admin and logistics (parents, medical).

#### Localization
- **Currency:** South African Rand (R).
- **Time:** 24-hour format.
- **Units:** Metric system (cm, kg).

## Key Improvements

### 1. Academy Office: Operation & Hub
A centralized operational engine for the professional traveling coach.
- **Weekly Planner:** A visual timeline for managing multi-location daily schedules. Supports "Week at a Glance" view and location-specific filtering.
- **Client Billing:** Automated "Statement of Account" generation. Analyzes attendance history against scheduled rates to produce professional digital receipts.
- **Payment Ledger:** Centralized "Ledger" tab for tracking all incoming payments in one sortable list, with a quick-add modal for rapid logging.
- **Expense Tracker:** Dedicated "Expenses" tab to log operational costs (equipment, court hire, etc.).
- **Financial Performance:** Interactive dashboard with Realized vs. Projected revenue, Location breakdowns, and Net Cash Flow (Collected vs. Expenses).
- **Directory:** Rapid access to player profiles, parent contacts, and critical medical alerts.
- **WhatsApp Integration:** One-click copy for professional billing communication via text/mobile.

### 2. Academy Management: "The Squad"
Transformed from a simple drill builder into a full student management hub.
- **Interactive Academy Court:** A spatial interface showing your entire roster on a high-density (80x40 grid) court.
- **Draggable Avatars:** Custom positioning of players on the court with persistent location saving.
- **Magic Badge System:** High-end identity rings using chosen neon colors with glassmorphism effects.

### 3. Deep Player Evaluation (4-Tier Architecture)
Professional intake and progression tracking for 40+ students.
- **The Build (Foundation):** Track Handedness, Play Style Archetype, DOB, and physical dimensions (Metric system).
- **Progression (Personal Bests):** Pinned metrics for "Back to Base" sprint times, Longest Rally, and 1st Serve %.
- **Player DNA (Psychology):** Track "Favorite Shot", "On-Court Confidence", Career Goals, and idols.
- **Coach's Intel (Logistics):** Detailed weekly scheduling, Medical Alerts, and a **One-Tap Parent Contact** system.

### 4. Workflow & Settings
- **Global Settings:** Centralized configuration for training locations, hourly rates (ZAR/R), and default session types.
- **Navigation Rail:** A permanent vertical strip for instant mode-switching (Home, Drills, Plans, Squad, Office, Templates).
- **Mobile FAB:** A dedicated "Speed Dial" Floating Action Button for effortless navigation on touch devices.

### 6. Financial Intelligence & Client Portal
- **Consolidated Accounts:** A dedicated "Bookings" workspace providing a real-time financial health check. Features monthly statements, "Brought Forward" logic for accurate running balances, and consolidated fee/payment tracking.
- **Client Portal 2.0:** A complete redesign of the client-facing app to match the "Midnight" admin aesthetic. Includes a detailed "Money" tab for parents to view statements, transaction history, and live balances.
- **Recurring Schedules:** "Set and Forget" logic for creating Term-based or Month-based recurring sessions with smart holiday handling.

## How to Run Locally

```bash
npm install
npm run dev
```

## Build & Preview

```bash
npm run build
npm run preview
```

## Notes
- **Data Resiliency:** Your existing data remains compatible. The app automatically backfills metadata and new schema fields on load.
- **PWA Ready:** Installable on iOS and Android for on-court use.
- **Export:** Robust PDF and PNG export for drills and session plans.

## Mobile Experience

### Academy Office (Mobile Command)
- **Planner:** Day view with high-contrast timeline for on-court use.
- **Location Context:** One-tap filtering by town or club.
- **24-Hour Native:** Mobile OS time pickers for rapid adjustments.
- **Client Billing:** Copy-for-WhatsApp summaries for parents.

### The Squad (Academy Mode)
- **Court View:** Touch-optimized grid for smaller screens.
- **Profile Tabs:** Horizontal tabs for Build, Progression, DNA, and Intel.
- **Quick Action:** Large Check-In icons for fast attendance.
- **Communication:** One-tap phone actions in the Directory.

### Drill & Session Editor
- **Responsive Forms:** Single-column layouts for thumb scrolling.
- **Native Pickers:** Mobile OS pickers for DOB and Last Restrung.
- **Drawer System:** Drill library opens as a bottom sheet with a drag handle.

### Interaction Differences
- **Hover Previews:** Desktop only.
- **Draggable Avatars:** Full touch support.
- **Localization:** High-visibility R currency labels on bright courts.

### Mobile Verification Notes
- Mobile verification is manual and tracked in `VERIFY.md`.
- Use "Add to Home Screen" for PWA full-screen behavior.
