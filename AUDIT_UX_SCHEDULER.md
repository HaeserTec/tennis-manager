# UX & Efficiency Audit: Academy Office & Dashboard
**Date:** January 21, 2026
**Scope:** Coach Workflow - Scheduling & Daily Management

## 1. Home Dashboard
**Status:** Visually appealing but functionally incomplete.

- **Missing "Jump Back In":**
  - **Problem:** The `recents` prop (Recent Drills, Plans, Players) is passed to the component but **never rendered**.
  - **Impact:** A coach returning to the app has to navigate 3-4 levels deep (Locker Room -> Search -> Select) to find the player they were just working on.
  - **Recommendation:** Implement a "Recent Activity" row below the main command grid.

- **Static Time/Greeting:**
  - **Note:** purely aesthetic, but effective for "Command Center" feel.

## 2. Academy Office (Scheduler)
**Status:** Functional but rigid.

- **Hardcoded Hours:**
  - **Status:** Resolved ✅
  - **Note:** Start/End hours are now set to 08:00 - 20:00 to cover full day.

- **Recurring Logic:**
  - **Status:** Resolved ✅
  - **Note:** Added "Repeat Mode" (Month/Term) selector and "Repeat" button for existing sessions. Logic accounts for month boundaries and Term dates.

- **Conflict UX:**
  - **Problem:** `window.alert("Player already in session")` is disruptive.
  - **Recommendation:** Use a toast notification or red flash visual cue.

- **Mobile Constraints:**
  - **Problem:** The drag-and-drop workflow is desktop-first. Dragging a player from the sidebar to a calendar slot on a phone is nearly impossible due to screen space (sidebar covers calendar).
  - **Recommendation:** "Tap to Select Player" -> "Tap Time Slot to Add" mode for mobile.

## 3. Financials (Accounts)
- **Manual Entry:**
  - **Problem:** No way to see "Overdue" accounts quickly without scrolling.
  - **Recommendation:** A "Debtors List" summary widget.

---
**Suggested Priority:**
1. **Dashboard Recents:** Immediate efficiency gain.
2. **Scheduler Hours Config:** Critical usability fix for non-afternoon coaches.
3. **Mobile Scheduler Flow:** High effort, high reward for on-court usage.
