# User-Specific Handling Audit Report
**Date:** January 12, 2026
**Scope:** Academy Office & Settings Integration

## 1. Scheduling & Planning Errors
- **Multi-Session Day Conflict:** [RESOLVED] System now uses proximity matching to map attendance to the correct scheduled time slot, ensuring accurate fee application for players with multiple sessions on the same day.
- **Quick-Add Duplication:** [RESOLVED] Validation now prevents adding the same player to the same time slot and location multiple times.
- **Week-Date Rollover:** The date calculation logic (`curr.getDate() - curr.getDay() + 1`) relies on the system clock. If used on a Sunday, it may display the dates for the week that just passed rather than the upcoming work week.

## 2. Settings & Data Integrity
- **Location Deletion Orphanage:** If a training location is deleted from the Settings Dialog, any existing player schedules referencing that location ID/Name will persist with "broken" references. The UI fallbacks are robust (showing "Main Court"), but the underlying data is not automatically sanitized.
- **Rate Sanity Checks:** The currency input for rates (ZAR/R) accepts any numeric value. There is no "high-value" warning to prevent accidental typos (e.g., R5000 instead of R500).
- **Duplicate Locations:** The system allows multiple locations with the same name to be created in Settings, which causes ambiguity in the "Filter View" and "Quick Add" dropdowns.

## 3. UI & UX (User Errors)
- **Sidebar Persistence:** The Office sidebar is fixed at 18rem. On smaller tablets, this restricts the horizontal space available for the Daily Timeline, potentially requiring horizontal scrolling.
- **Discard Logic:** Closing the Settings Dialog or Academy Office while in the middle of a "Quick Add" configuration does not prompt the user to save or warn about lost inputs.

---
*This report serves as a roadmap for future logic hardening and data validation updates.*
