# UI Consolidation Strategy: The "Single Pane of Glass"

**Date:** 2026-02-03
**Status:** Proposed

## Objective
To reduce context switching and "tab fatigue" by consolidating fragmented workflows into unified, high-density workspaces. This transforms the app from a collection of isolated tools into a cohesive operating system.

---

## Phase 1: The Financial Command Center (Academy Office)
*Target: Merge "Accounts", "Bookings", and "Payment Ledger" into a single view.*

### The Problem
Currently, a user has to switch tabs to:
1. Find a client's phone number ("Accounts").
2. Check if they owe money ("Bookings").
3. Record a payment ("Ledger").

### The Solution: "Finance & Clients" Workspace
A master view combining directory info, live balances, and transaction history.

#### 1.1 Master Client Table (Top Panel)
Replaces the "Card Grid" and "Statement Table".
- **Columns:**
  - **Identity:** Name, Parent Contact (Phone/WhatsApp link), Player Count.
  - **Location:** "Home Court" (Bothaville/Kroonstad/Welkom).
  - **Financials:** Brought Forward, Monthly Fees, Paid, **Live Balance** (Red/Green highlight).
  - **Actions:** Quick Edit, "Record Payment" (Prefills the modal).
- **Interactions:**
  - Clicking a row highlights it and filters the Ledger (see below).

#### 1.2 Contextual Ledger (Bottom Panel)
- **Default State:** Shows the global "Recent Payments" stream (current Ledger view).
- **Filtered State:** When a Client Row is selected, this panel filters to show *only* that client's history (Sessions + Payments combined chronologically).
- **Benefit:** Instant audit trail without leaving the summary view.

---

## Phase 2: Player 360° Dossier (Locker Room)
*Target: Eliminate the 5-tab structure (Build, History, DNA, Intel, Progress).*

### The Problem
Reviewing a player requires 5 clicks to see their holistic status (e.g., checking if "Medical Alert" impacts "Recent Attendance").

### The Solution: The "Dossier" Layout
A responsive, masonry-style dashboard for a single player.

- **Hero Card (Sticky Top):** Avatar, Rank/Level, Age, Handedness.
- **Column A (The Human):**
  - **DNA:** Confidence meter, Favorite Shot, Goals.
  - **Intel:** Medical Alerts, Parent Contact, School.
- **Column B (The Athlete):**
  - **Physical:** Radar Chart (Tech/Tac/Phys/Ment).
  - **Stats:** "Pinned" Personal Bests (Longest Rally, Sprint Time).
  - **Attendance:** Heatmap & Streak.
- **Column C (The Journey):**
  - **Notes:** Coach's Journal (Scrollable feed).
  - **Gear:** Racket specs.

---

## Phase 3: Tactics Workbench
*Target: Merge "Drill Library" and "Session Planner".*

### The Problem
Users must memorize drill names or open multiple windows to build a session plan.

### The Solution: Drag-and-Drop Builder
- **Left Sidebar (Library):** Searchable drill list with compact cards (drag source).
- **Main Canvas (Timeline):** The Session Plan timeline (drop target).
- **Workflow:** Drag a drill from the library directly into a time slot.

---

## Implementation Roadmap

1.  **Execution - Phase 1 (Finance):**
    *   Create `components/office/FinancialWorkspace.tsx`.
    *   Refactor `AccountsStatement` logic into a reusable hook `useClientFinancials`.
    *   Build the Master Table.
    *   Embed `PaymentLedger` as a sub-component.

2.  **Execution - Phase 2 (Player):**
    *   Create `components/locker/PlayerDossier.tsx`.
    *   Refactor distinct tab components into "Cards" (e.g., `DNAInfoCard`, `StatsCard`).
    *   Implement Masonry layout.

3.  **Execution - Phase 3 (Tactics):**
    *   Refactor `DrillLibrary` to support a "Sidebar Mode".
    *   Update `SessionBuilder` to accept drag-and-drop inputs.
