# Client/Parent Editing Feature Design

**Date:** 2026-02-01
**Feature:** Add ability to edit parent/client details after creation
**Problem:** Currently, if a coach forgets to add details (like phone number) when creating a parent account, they must delete it, recreate, and relink all players.

---

## 1. Overall Architecture & Components

### New Components to Create

**ClientEditPanel.tsx** - Main slide-out panel component
- Full-height panel that slides in from the right (400px desktop, full-width mobile)
- Props: `client: Client`, `onClose()`, `onSave(client: Client)`, `onDelete(clientId: string)`, `onMerge(sourceId: string, targetId: string)`
- Contains three sections: Contact Details, Payment History, Linked Players (read-only list)

**ClientMergeDialog.tsx** - Smart merge preview dialog
- Shows side-by-side comparison of duplicate clients
- Displays merged preview with best data from both
- Lists all players that will be consolidated
- Confirms before executing merge

### Modifications to Existing Components

**AcademyOffice.tsx** (AccountsWorkspace section)
- Add `onClick` handler to client cards
- Open `ClientEditPanel` when clicked

**LockerRoom.tsx** (Player detail view)
- Add "Edit" button next to parent name in the "Parent/Guardian" section
- Open same `ClientEditPanel` component

### Shared State

- Use existing `upsertClient()` from DataProvider for saves
- Add new `deleteClient()` and `mergeClients()` to DataProvider

---

## 2. Edit Panel UI Structure

### ClientEditPanel Layout

**Dimensions:** 400px wide on desktop, full-width on mobile

**Header:**
- Client name as title
- Close button (X icon, top-right)
- Delete button (trash icon, top-right, red, only enabled if no linked players)

**Body (scrollable):**

**Contact Details Section:**
- Name input (text, required)
- Email input (email type, optional)
- Phone input (tel type, optional, South African format)
- Status dropdown (Active/Inactive/Lead)
- Notes textarea (optional, multi-line)
- "Check for Duplicates" button - scans for clients with matching name

**Linked Players Section:**
- Read-only list showing all players linked to this client
- Display: Avatar initial + Player name + Level badge
- Shows "No linked players" if empty
- Purpose: Visual confirmation of relationships, blocks deletion if not empty

**Payment History Section:**
- Scrollable list of existing payments (most recent first)
- Each payment shows: Date | Reference | Amount | Actions (Edit/Delete icons)
- "+ Add Payment" button at bottom
- Inline add/edit form appears when clicked

**Footer:**
- "Cancel" button (left)
- "Save Changes" button (right, primary, validates required fields)

---

## 3. Duplicate Detection & Merge Flow

### Duplicate Detection Trigger

When user clicks "Check for Duplicates" button (or auto-triggered when changing the name field on blur):
- Case-insensitive search for clients with matching names
- Exclude the current client being edited
- If matches found, show inline warning: "⚠️ Found X client(s) with similar names" with "Review" button

### ClientMergeDialog Structure

Opens when user clicks "Review" on duplicate warning.

**Left Column: Current Client**
- Shows all contact details (name, email, phone, notes, status)
- Payment count: "5 payments totaling R 2,500"
- Linked players: "3 players"

**Right Column: Duplicate Client(s)**
- If multiple duplicates, show dropdown to select which one to compare
- Same layout as left column

**Center: Merge Preview**
- Shows the proposed merged record
- Smart merge logic:
  - Name: Use current client's name
  - Email: Use most recently updated non-empty value
  - Phone: Use most recently updated non-empty value
  - Status: Keep 'Active' if either is active, otherwise most recent
  - Notes: Concatenate both with separator (`\n---\n`)
  - Payments: Combine all payment arrays, deduplicate by ID
  - Players: All players from both will point to the merged client

**Actions:**
- "Cancel" - closes dialog, no changes
- "Merge Clients" - executes merge, shows confirmation toast

---

## 4. Payment Editing

### Payment List Display

Each payment in the list shows:
```
2025-01-15    EFT - January        R 850    [Edit] [Delete]
```

### Adding a Payment

Click "+ Add Payment" reveals inline form:
- Date picker (defaults to today, format: YYYY-MM-DD)
- Amount input (number, required, prefix: "R")
- Reference input (text, optional, placeholder: "e.g., EFT - January")
- Note textarea (optional, for internal notes)
- "Add" and "Cancel" buttons

### Editing a Payment

Click [Edit] icon transforms that payment row into the same inline form with pre-filled values. User can modify any field. "Save" and "Cancel" buttons replace the row.

### Deleting a Payment

Click [Delete] icon shows confirmation dialog:
- "Delete payment of R 850 from 2025-01-15?"
- "Cancel" / "Delete" (red, destructive)

### Payment Validation

- Amount must be > 0
- Date must be valid YYYY-MM-DD
- No duplicate payment IDs

### State Management

- Payments array lives in `client.payments`
- Generate new payment ID: `pay_${Date.now()}_${Math.random()}`
- Sort by date descending after any change
- All changes batched until "Save Changes" clicked on main panel

---

## 5. Delete Functionality

### Delete Button State

Located in panel header (trash icon):
- **Enabled (red):** Client has zero linked players
- **Disabled (gray):** Client has 1+ linked players
- Tooltip on hover explains state

### Pre-Delete Validation

Before showing confirmation, run check:
```typescript
const linkedPlayers = players.filter(p => p.clientId === client.id);
if (linkedPlayers.length > 0) {
  toast.error(`Cannot delete. ${linkedPlayers.length} player(s) still linked.`);
  return;
}
```

### Delete Confirmation Dialog

If validation passes, show dialog:
- Title: "Delete Client?"
- Body: "Are you sure you want to delete **[Client Name]**? This action cannot be undone."
- Show: Email, Phone, Payment count for final verification
- Actions: "Cancel" (default) / "Delete Client" (red, destructive)

### Delete Execution

On confirm:
1. Call `deleteClient(clientId)` from DataProvider
2. Remove from clients array
3. Sync deletion to Supabase (if configured)
4. Close panel
5. Show success toast: "Client deleted successfully"
6. If on Accounts tab, remove card from grid immediately

### Edge Cases

- If client was just unlinked from all players in same session, deletion should work
- No cascade deletion of players (must be manual)

---

## 6. Data Flow & State Management

### DataProvider Extensions (lib/data-provider.tsx)

Add two new functions to the context:

```typescript
const deleteClient = useCallback((clientId: string) => {
  // Remove from state
  setClients(prev => prev.filter(c => c.id !== clientId));
  // Sync to Supabase
  syncToSupabase('clients', { id: clientId }, 'delete');
}, []);

const mergeClients = useCallback((sourceId: string, targetId: string) => {
  const source = clients.find(c => c.id === sourceId);
  const target = clients.find(c => c.id === targetId);

  // Create merged client
  const merged: Client = {
    ...target,
    email: source.email || target.email,
    phone: source.phone || target.phone,
    notes: [target.notes, source.notes].filter(Boolean).join('\n---\n'),
    payments: [...(target.payments || []), ...(source.payments || [])],
    updatedAt: Date.now()
  };

  // Update all players from source to target
  setPlayers(prev => prev.map(p =>
    p.clientId === sourceId ? { ...p, clientId: targetId } : p
  ));

  // Upsert merged client, delete source
  upsertClient(merged);
  deleteClient(sourceId);
}, [clients, upsertClient, deleteClient]);
```

### Component State (ClientEditPanel)

- Local state for form fields (name, email, phone, status, notes, payments)
- `isDirty` flag to track unsaved changes
- `isSaving` loading state for save button

### Save Flow

1. Validate required fields (name only)
2. Call `upsertClient(updatedClient)`
3. Close panel on success
4. Show toast notification

---

## 7. Error Handling & Validation

### Form Validation Rules

**Required Fields:**
- Name: Must not be empty, min 2 characters

**Optional Fields with Validation:**
- Phone: Optional, but if provided must match South African format:
  - Accepts: `+27 XX XXX XXXX` or `0XX XXX XXXX` or variations with/without spaces
  - Regex: `/^(\+27|0)[0-9]{9}$/` (after removing spaces/dashes)
  - Example valid: "+27 82 123 4567", "082 123 4567", "0821234567"
- Email: Optional, but if provided must be valid email format
- Notes: No validation, any text
- Status: Must be one of Active/Inactive/Lead

### Validation Timing

- On blur for individual fields (show inline error if format invalid)
- On save attempt (only blocks if name is empty or formats are invalid)

### Error Display

- Inline red text below invalid field
- Red border on invalid input
- Disable "Save Changes" button while invalid

### Error Messages

- Name: "Name is required"
- Phone: "Invalid SA phone number format (e.g., +27 82 123 4567 or 082 123 4567)"
- Email: "Invalid email format"

### Phone Formatting Helper

- Auto-format as user types (add spaces for readability)
- Store cleaned version (digits only with country code) in database

### Save Error Handling

If `upsertClient()` fails:
- Show error toast: "Failed to save changes. Please try again."
- Keep panel open with form data intact
- Log error to console for debugging

### Merge Error Handling

If `mergeClients()` fails:
- Show error toast: "Failed to merge clients. Please try again."
- Keep merge dialog open
- Don't delete source client

### Supabase Sync Errors

- Non-blocking (optimistic UI updates)
- Show warning toast if sync fails: "Changes saved locally but failed to sync to cloud"
- Retry sync on next app load

### Unsaved Changes Warning

When closing panel with unsaved changes:
- Show confirmation: "Discard unsaved changes?"
- "Cancel" (stay in panel) / "Discard" (close panel)

---

## Implementation Summary

### Files to Create
- `components/ClientEditPanel.tsx`
- `components/ClientMergeDialog.tsx`

### Files to Modify
- `lib/data-provider.tsx` - Add `deleteClient()` and `mergeClients()`
- `components/AcademyOffice.tsx` - Add click handler to client cards
- `components/LockerRoom.tsx` - Add edit button in parent section

### Key Features
1. ✅ Edit clients from both Accounts tab and Player detail view
2. ✅ Full editing: name, email, phone, status, notes, payments
3. ✅ Delete only if no linked players
4. ✅ Duplicate detection with smart merge preview
5. ✅ South African phone formatting (optional field)
6. ✅ Slide-out panel UI pattern
