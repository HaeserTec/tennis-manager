# Performance & Workflow Audit
**Date:** January 21, 2026
**Scope:** Coach Workflows (Locker Room, Session Builder, Drill Library)

## 1. High-Friction Workflows (UX Bottlenecks)
These areas require excessive clicks or manual input from the coach.

- **Locker Room - No Batch Actions:**
  - **Problem:** Assigning a specific drill (e.g., "Kick Serve Warmup") to an entire squad (8 players) requires opening each player profile individually, finding the drill, and assigning it.
  - **Impact:** ~32 clicks for a simple squad task.
  - **Recommendation:** Implement "Squad Selection" mode with bulk actions (Assign Drill, Log Attendance).

- **Session Builder - Limited Discovery:**
  - **Problem:** The sidebar only shows a linear list of drills. There is no category filtering or advanced search within the builder itself, only in the main library.
  - **Impact:** Coaches struggle to find specific drills quickly while building a plan.

## 2. Performance Risks (Technical Debt)
These features may cause the app to freeze, lag, or crash as data grows.

- **Drill Library - No Pagination:**
  - **Problem:** The `DrillLibrary` component renders all filtered drills at once. If the library grows to 500+ drills, the DOM size will explode, causing scroll lag.
  - **Recommendation:** Implement virtualization (windowing) or simple "Load More" pagination.

- **Session Builder - PDF Generation:**
  - **Problem:** `html2canvas` + `jsPDF` runs entirely on the main UI thread. Generating a PDF for a complex plan freezes the browser interface until completion.
  - **Recommendation:** Offload generation to a Web Worker or optimize the canvas capture resolution.

- **Global Search - Main Thread Blocking:**
  - **Problem:** Search filtering (in `useMemo`) iterates over the entire dataset on every keystroke.
  - **Recommendation:** Debounce search inputs (wait 300ms after typing stops) to prevent wasted calculations.

## 3. Data Integrity
- **Sync Strategy:**
  - **Problem:** The current `forceSync` logic is "all-or-nothing" and runs on a simple "Last Write Wins" basis. It downloads the entire database table on sync.
  - **Impact:** Slow sync times on mobile networks; potential for overwriting data if two coaches edit simultaneously.

---
**Suggested Priority:**
1. **Locker Room Batch Actions:** High value for saving coach time.
2. **Search Debouncing:** Quick win for perceived performance.
3. **Pagination:** Critical for long-term scalability.
