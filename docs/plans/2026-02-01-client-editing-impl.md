# Client Editing Feature - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ability to edit, delete, and merge parent/client accounts from both AcademyOffice and LockerRoom.

**Architecture:** Create a slide-out panel component (ClientEditPanel) that handles contact editing, payment management, and deletion. Add a merge dialog for duplicate detection. Extend DataProvider with deleteClient and mergeClients functions.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, existing shadcn/ui patterns (Button, Input, Select)

---

## Task 1: Extend DataProvider with deleteClient

**Files:**
- Modify: `lib/data-provider.tsx:122-133` (context type)
- Modify: `lib/data-provider.tsx:489-500` (after upsertClient)
- Modify: `lib/data-provider.tsx:652-660` (provider value)

**Step 1: Add deleteClient to context type**

In `lib/data-provider.tsx`, add to the `DataContextType` interface around line 123:

```typescript
  upsertClient: (client: Client) => void;
  deleteClient: (clientId: string) => void;  // ADD THIS LINE
  upsertSession: (session: TrainingSession) => void;
```

**Step 2: Implement deleteClient function**

After the `upsertClient` callback (around line 500), add:

```typescript
  const deleteClient = useCallback((clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    syncToSupabase('clients', { id: clientId }, 'delete');
  }, []);
```

**Step 3: Export deleteClient in provider value**

In the Provider return (around line 658), add `deleteClient` to the value object:

```typescript
      addPlayer, updatePlayer, deletePlayer, upsertClient, deleteClient, upsertSession, deleteSession, upsertLog,
```

**Step 4: Verify build compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No TypeScript errors related to deleteClient

**Step 5: Commit**

```bash
git add lib/data-provider.tsx
git commit -m "feat(data): add deleteClient to DataProvider"
```

---

## Task 2: Extend DataProvider with mergeClients

**Files:**
- Modify: `lib/data-provider.tsx:122-133` (context type)
- Modify: `lib/data-provider.tsx:501-510` (after deleteClient)
- Modify: `lib/data-provider.tsx:652-660` (provider value)

**Step 1: Add mergeClients to context type**

```typescript
  deleteClient: (clientId: string) => void;
  mergeClients: (sourceId: string, targetId: string) => void;  // ADD THIS LINE
  upsertSession: (session: TrainingSession) => void;
```

**Step 2: Implement mergeClients function**

After the `deleteClient` callback, add:

```typescript
  const mergeClients = useCallback((sourceId: string, targetId: string) => {
    const source = clients.find(c => c.id === sourceId);
    const target = clients.find(c => c.id === targetId);
    if (!source || !target) return;

    // Create merged client - prefer most recent non-empty values
    const merged: Client = {
      ...target,
      email: (source.updatedAt > target.updatedAt && source.email) ? source.email : (target.email || source.email),
      phone: (source.updatedAt > target.updatedAt && source.phone) ? source.phone : (target.phone || source.phone),
      notes: [target.notes, source.notes].filter(Boolean).join('\n---\n') || undefined,
      payments: [...(target.payments || []), ...(source.payments || [])],
      status: target.status === 'Active' || source.status === 'Active' ? 'Active' : target.status,
      updatedAt: Date.now()
    };

    // Update all players from source to target
    setPlayers(prev => prev.map(p =>
      p.clientId === sourceId ? { ...p, clientId: targetId, updatedAt: Date.now() } : p
    ));

    // Upsert merged client
    setClients(prev => {
      const withoutSource = prev.filter(c => c.id !== sourceId);
      const idx = withoutSource.findIndex(c => c.id === targetId);
      if (idx >= 0) {
        const next = [...withoutSource];
        next[idx] = merged;
        return next;
      }
      return withoutSource;
    });

    syncToSupabase('clients', merged, 'upsert');
    syncToSupabase('clients', { id: sourceId }, 'delete');
  }, [clients]);
```

**Step 3: Export mergeClients in provider value**

```typescript
      addPlayer, updatePlayer, deletePlayer, upsertClient, deleteClient, mergeClients, upsertSession, deleteSession, upsertLog,
```

**Step 4: Verify build compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add lib/data-provider.tsx
git commit -m "feat(data): add mergeClients to DataProvider"
```

---

## Task 3: Create ClientEditPanel Component - Basic Structure

**Files:**
- Create: `components/ClientEditPanel.tsx`

**Step 1: Create the component file with basic structure**

Create `components/ClientEditPanel.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { X, Trash2, Users, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Client, Player, Payment } from '@/lib/playbook';

interface ClientEditPanelProps {
  client: Client;
  players: Player[];
  allClients: Client[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onMerge: (sourceId: string, targetId: string) => void;
}

// South African phone validation
const SA_PHONE_REGEX = /^(\+27|0)[0-9]{9}$/;

function formatSAPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('27')) {
    const rest = digits.slice(2);
    if (rest.length <= 2) return `+27 ${rest}`;
    if (rest.length <= 5) return `+27 ${rest.slice(0, 2)} ${rest.slice(2)}`;
    return `+27 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 9)}`;
  }
  if (digits.startsWith('0')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  return value;
}

function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  const cleaned = phone.replace(/[\s-]/g, '');
  return SA_PHONE_REGEX.test(cleaned);
}

function validateEmail(email: string): boolean {
  if (!email) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ClientEditPanel({
  client,
  players,
  allClients,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onMerge
}: ClientEditPanelProps) {
  // Form state
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Lead'>(client.status);
  const [notes, setNotes] = useState(client.notes || '');
  const [payments, setPayments] = useState<Payment[]>(client.payments || []);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicates, setDuplicates] = useState<Client[]>([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Linked players
  const linkedPlayers = players.filter(p => p.clientId === client.id);
  const canDelete = linkedPlayers.length === 0;

  // Reset form when client changes
  useEffect(() => {
    setName(client.name);
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setStatus(client.status);
    setNotes(client.notes || '');
    setPayments(client.payments || []);
    setErrors({});
    setIsDirty(false);
    setShowDeleteConfirm(false);
    setDuplicates([]);
  }, [client]);

  // Mark dirty on any change
  useEffect(() => {
    const hasChanges =
      name !== client.name ||
      email !== (client.email || '') ||
      phone !== (client.phone || '') ||
      status !== client.status ||
      notes !== (client.notes || '') ||
      JSON.stringify(payments) !== JSON.stringify(client.payments || []);
    setIsDirty(hasChanges);
  }, [name, email, phone, status, notes, payments, client]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name || name.length < 2) newErrors.name = 'Name is required (min 2 characters)';
    if (!validateEmail(email)) newErrors.email = 'Invalid email format';
    if (!validatePhone(phone)) newErrors.phone = 'Invalid SA phone format (e.g., +27 82 123 4567)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const updated: Client = {
      ...client,
      name: name.trim(),
      email: email.trim() || '',
      phone: phone.replace(/[\s-]/g, ''),
      status,
      notes: notes.trim() || undefined,
      payments,
      updatedAt: Date.now()
    };
    onSave(updated);
    onClose();
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    onClose();
  };

  const handleDelete = () => {
    if (!canDelete) {
      alert(`Cannot delete. ${linkedPlayers.length} player(s) still linked.`);
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(client.id);
    onClose();
  };

  const checkDuplicates = () => {
    const found = allClients.filter(c =>
      c.id !== client.id &&
      c.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    setDuplicates(found);
    if (found.length > 0) {
      setShowMergeDialog(true);
    } else {
      alert('No duplicates found.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-background border-l border-border z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="font-bold text-lg truncate">{client.name}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={!canDelete}
              className={cn(
                "text-muted-foreground",
                canDelete && "hover:text-destructive hover:bg-destructive/10"
              )}
              title={canDelete ? "Delete client" : `Cannot delete: ${linkedPlayers.length} linked player(s)`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Contact Details Section */}
          <section className="space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contact Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={cn(errors.name && "border-destructive")}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className={cn(errors.email && "border-destructive")}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone (SA)</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(formatSAPhone(e.target.value))}
                  placeholder="+27 82 123 4567"
                  className={cn(errors.phone && "border-destructive")}
                />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Internal notes..."
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={checkDuplicates}
                className="w-full"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Check for Duplicates
              </Button>

              {duplicates.length > 0 && !showMergeDialog && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Found {duplicates.length} client(s) with the same name
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowMergeDialog(true)}
                    className="px-0 h-auto text-amber-600"
                  >
                    Review &rarr;
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Linked Players Section */}
          <section className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Linked Players ({linkedPlayers.length})
            </h3>

            {linkedPlayers.length > 0 ? (
              <div className="space-y-2">
                {linkedPlayers.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-card/50 border border-border">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.level}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No linked players</p>
            )}
          </section>

          {/* Payments Section */}
          <section className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payments ({payments.length})
            </h3>
            <PaymentEditor payments={payments} onChange={setPayments} />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border shrink-0 bg-card/50">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isDirty}>Save Changes</Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl p-6 max-w-sm mx-4 shadow-2xl border border-border">
            <h3 className="font-bold text-lg mb-2">Delete Client?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{client.name}</strong>? This cannot be undone.
            </p>
            {client.email && <p className="text-xs text-muted-foreground">Email: {client.email}</p>}
            {client.phone && <p className="text-xs text-muted-foreground">Phone: {client.phone}</p>}
            {payments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Payments: {payments.length} (R {payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()})
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} className="flex-1">
                Delete Client
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Dialog */}
      {showMergeDialog && duplicates.length > 0 && (
        <ClientMergeDialog
          currentClient={{ ...client, name, email, phone, status, notes, payments }}
          duplicates={duplicates}
          players={players}
          onClose={() => setShowMergeDialog(false)}
          onMerge={(sourceId) => {
            onMerge(sourceId, client.id);
            setShowMergeDialog(false);
            setDuplicates([]);
          }}
        />
      )}
    </>
  );
}

// Payment Editor Sub-component
function PaymentEditor({ payments, onChange }: { payments: Payment[], onChange: (p: Payment[]) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  const handleAdd = (payment: Payment) => {
    onChange([...payments, payment]);
    setIsAdding(false);
  };

  const handleUpdate = (payment: Payment) => {
    onChange(payments.map(p => p.id === payment.id ? payment : p));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (payment && window.confirm(`Delete payment of R ${payment.amount} from ${payment.date}?`)) {
      onChange(payments.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-2">
      {sortedPayments.map(p => (
        editingId === p.id ? (
          <PaymentForm
            key={p.id}
            payment={p}
            onSave={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border text-sm">
            <span className="text-muted-foreground w-24">{p.date}</span>
            <span className="flex-1 truncate">{p.reference || '-'}</span>
            <span className="font-bold">R {p.amount.toLocaleString()}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingId(p.id)}>
              <span className="text-xs">Edit</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(p.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )
      ))}

      {isAdding ? (
        <PaymentForm onSave={handleAdd} onCancel={() => setIsAdding(false)} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} className="w-full">
          + Add Payment
        </Button>
      )}
    </div>
  );
}

// Payment Form Sub-component
function PaymentForm({
  payment,
  onSave,
  onCancel
}: {
  payment?: Payment,
  onSave: (p: Payment) => void,
  onCancel: () => void
}) {
  const [date, setDate] = useState(payment?.date || new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(payment?.amount?.toString() || '');
  const [reference, setReference] = useState(payment?.reference || '');
  const [note, setNote] = useState(payment?.note || '');

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!date || isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid date and amount');
      return;
    }
    onSave({
      id: payment?.id || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date,
      amount: numAmount,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined
    });
  };

  return (
    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
          className="h-8 text-sm"
        />
      </div>
      <Input
        value={reference}
        onChange={e => setReference(e.target.value)}
        placeholder="Reference (e.g., EFT - January)"
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1 h-7">Cancel</Button>
        <Button size="sm" onClick={handleSubmit} className="flex-1 h-7">{payment ? 'Save' : 'Add'}</Button>
      </div>
    </div>
  );
}

// Merge Dialog Sub-component
function ClientMergeDialog({
  currentClient,
  duplicates,
  players,
  onClose,
  onMerge
}: {
  currentClient: Client;
  duplicates: Client[];
  players: Player[];
  onClose: () => void;
  onMerge: (sourceId: string) => void;
}) {
  const [selectedDuplicateId, setSelectedDuplicateId] = useState(duplicates[0]?.id || '');
  const duplicate = duplicates.find(d => d.id === selectedDuplicateId);

  if (!duplicate) return null;

  const currentPlayers = players.filter(p => p.clientId === currentClient.id);
  const duplicatePlayers = players.filter(p => p.clientId === duplicate.id);

  const currentPaymentTotal = (currentClient.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const duplicatePaymentTotal = (duplicate.payments || []).reduce((sum, p) => sum + p.amount, 0);

  // Preview merged data
  const mergedEmail = (currentClient.updatedAt > duplicate.updatedAt && currentClient.email)
    ? currentClient.email
    : (duplicate.email || currentClient.email);
  const mergedPhone = (currentClient.updatedAt > duplicate.updatedAt && currentClient.phone)
    ? currentClient.phone
    : (duplicate.phone || currentClient.phone);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="font-bold text-lg">Merge Clients</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {duplicates.length > 1 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Select duplicate to merge:</label>
              <Select value={selectedDuplicateId} onValueChange={setSelectedDuplicateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {duplicates.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({d.email || d.phone || 'No contact'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Client */}
            <div className="p-4 rounded-lg border border-border bg-card/50">
              <h4 className="font-bold text-sm mb-2 text-primary">Keep: {currentClient.name}</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Email: {currentClient.email || '-'}</p>
                <p>Phone: {currentClient.phone || '-'}</p>
                <p>Status: {currentClient.status}</p>
                <p>Players: {currentPlayers.length}</p>
                <p>Payments: {(currentClient.payments || []).length} (R {currentPaymentTotal.toLocaleString()})</p>
              </div>
            </div>

            {/* Duplicate */}
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <h4 className="font-bold text-sm mb-2 text-destructive">Merge & Delete: {duplicate.name}</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Email: {duplicate.email || '-'}</p>
                <p>Phone: {duplicate.phone || '-'}</p>
                <p>Status: {duplicate.status}</p>
                <p>Players: {duplicatePlayers.length}</p>
                <p>Payments: {(duplicate.payments || []).length} (R {duplicatePaymentTotal.toLocaleString()})</p>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
              <h4 className="font-bold text-sm mb-2 text-green-600 dark:text-green-400">Result Preview</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Name: {currentClient.name}</p>
                <p>Email: {mergedEmail || '-'}</p>
                <p>Phone: {mergedPhone || '-'}</p>
                <p>Players: {currentPlayers.length + duplicatePlayers.length}</p>
                <p>Payments: {(currentClient.payments || []).length + (duplicate.payments || []).length} (R {(currentPaymentTotal + duplicatePaymentTotal).toLocaleString()})</p>
              </div>
            </div>
          </div>

          {duplicatePlayers.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                These players will be moved to {currentClient.name}:
              </p>
              <div className="flex flex-wrap gap-2">
                {duplicatePlayers.map(p => (
                  <span key={p.id} className="px-2 py-1 rounded bg-background text-xs font-medium">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => onMerge(duplicate.id)} className="flex-1">
            Merge Clients
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add components/ClientEditPanel.tsx
git commit -m "feat(ui): add ClientEditPanel component with payments and merge"
```

---

## Task 4: Integrate ClientEditPanel into AcademyOffice

**Files:**
- Modify: `components/AcademyOffice.tsx:568-590`

**Step 1: Import ClientEditPanel**

At the top of `components/AcademyOffice.tsx`, add import:

```typescript
import { ClientEditPanel } from '@/components/ClientEditPanel';
```

**Step 2: Add state and handlers to AccountsWorkspace**

Replace the `AccountsWorkspace` function (around line 568) with:

```typescript
function AccountsWorkspace({ clients, players, onUpsertClient, onDeleteClient, onMergeClients }: {
   clients: Client[];
   players: Player[];
   onUpsertClient: (client: Client) => void;
   onDeleteClient?: (clientId: string) => void;
   onMergeClients?: (sourceId: string, targetId: string) => void;
}) {
   const [q, setQ] = useState('');
   const [editingClient, setEditingClient] = useState<Client | null>(null);

   const filtered = clients.filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase()));

   return (
      <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
         <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black">Client Accounts</h2>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input className="pl-9 w-64 bg-card/50" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c: Client) => (
               <div
                  key={c.id}
                  onClick={() => setEditingClient(c)}
                  className="p-5 rounded-2xl glass-card flex flex-col hover:border-primary/30 transition-all cursor-pointer"
               >
                  <div className="font-bold text-lg">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone || "No Phone"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                     {players.filter(p => p.clientId === c.id).length} player(s)
                  </div>
               </div>
            ))}
         </div>

         {editingClient && (
            <ClientEditPanel
               client={editingClient}
               players={players}
               allClients={clients}
               isOpen={true}
               onClose={() => setEditingClient(null)}
               onSave={(updated) => {
                  onUpsertClient(updated);
                  setEditingClient(null);
               }}
               onDelete={(id) => {
                  if (onDeleteClient) onDeleteClient(id);
                  setEditingClient(null);
               }}
               onMerge={(sourceId, targetId) => {
                  if (onMergeClients) onMergeClients(sourceId, targetId);
                  setEditingClient(null);
               }}
            />
         )}
      </div>
   );
}
```

**Step 3: Update AccountsWorkspace call in AcademyOffice**

Find where `AccountsWorkspace` is called (around line 102) and update to pass the new props:

```typescript
<AccountsWorkspace
   clients={clients}
   players={players}
   onUpsertClient={onUpsertClient}
   onDeleteClient={onDeleteClient}
   onMergeClients={onMergeClients}
/>
```

**Step 4: Update AcademyOffice props**

The `AcademyOffice` component needs to receive the new callbacks. Find the component declaration and add:

```typescript
interface AcademyOfficeProps {
  // ... existing props
  onDeleteClient?: (clientId: string) => void;
  onMergeClients?: (sourceId: string, targetId: string) => void;
}
```

And destructure them in the function signature.

**Step 5: Verify build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add components/AcademyOffice.tsx
git commit -m "feat(office): integrate ClientEditPanel into Accounts tab"
```

---

## Task 5: Wire up new DataProvider methods in App.tsx

**Files:**
- Modify: `App.tsx` (find AcademyOffice usage and add props)

**Step 1: Find AcademyOffice usage in App.tsx**

Search for where `<AcademyOffice` is rendered and add the new props:

```typescript
<AcademyOffice
  // ... existing props
  onDeleteClient={deleteClient}
  onMergeClients={mergeClients}
/>
```

**Step 2: Import deleteClient and mergeClients from useData()**

Find the `useData()` destructuring in App.tsx and add:

```typescript
const {
  // ... existing
  deleteClient,
  mergeClients,
  // ... rest
} = useData();
```

**Step 3: Verify build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

**Step 4: Test in browser**

Run: `npm run dev`
Navigate to: Academy Office > Accounts tab
Expected: Click on a client card opens the edit panel

**Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat(app): wire deleteClient and mergeClients to AcademyOffice"
```

---

## Task 6: Add Edit Button to LockerRoom Parent Section

**Files:**
- Modify: `components/LockerRoom.tsx:693-730`

**Step 1: Import ClientEditPanel**

At the top of `components/LockerRoom.tsx`:

```typescript
import { ClientEditPanel } from '@/components/ClientEditPanel';
```

**Step 2: Add state for editing client in PlayerDetailView**

Inside `PlayerDetailView` component, add state (around line 391):

```typescript
const [editingClient, setEditingClient] = useState<Client | null>(null);
```

**Step 3: Add Edit button next to linked client**

Find the linked client display (around line 693-703) and add an Edit button:

```typescript
{linkedClient ? (
   <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border">
      <div>
         <p className="text-xs font-bold uppercase tracking-widest text-primary">Linked Account</p>
         <p className="font-bold text-lg">{linkedClient.name}</p>
         <p className="text-xs text-muted-foreground">{linkedClient.phone}</p>
      </div>
      <div className="flex gap-2">
         <Button variant="outline" size="sm" onClick={() => setEditingClient(linkedClient)}>
            Edit
         </Button>
         <Button variant="ghost" size="sm" onClick={() => onUpdate({ ...player, clientId: undefined, updatedAt: Date.now() })}>
            Unlink
         </Button>
      </div>
   </div>
) : (
   // ... existing create/link UI
)}
```

**Step 4: Add ClientEditPanel render**

After the parent/guardian section, add the panel render:

```typescript
{editingClient && (
   <ClientEditPanel
      client={editingClient}
      players={players}
      allClients={clients}
      isOpen={true}
      onClose={() => setEditingClient(null)}
      onSave={(updated) => {
         if (onUpsertClient) onUpsertClient(updated);
         setEditingClient(null);
      }}
      onDelete={(id) => {
         if (onDeleteClient) onDeleteClient(id);
         setEditingClient(null);
      }}
      onMerge={(sourceId, targetId) => {
         if (onMergeClients) onMergeClients(sourceId, targetId);
         setEditingClient(null);
      }}
   />
)}
```

**Step 5: Update PlayerDetailView props**

Add the new optional props to the function signature:

```typescript
function PlayerDetailView({
  player,
  players,
  clients,
  onUpdate,
  onBack,
  onDelete,
  drills,
  onUpsertClient,
  onDeleteClient,
  onMergeClients
}: {
  // ... existing types
  onDeleteClient?: (clientId: string) => void;
  onMergeClients?: (sourceId: string, targetId: string) => void;
}) {
```

**Step 6: Pass props from LockerRoom to PlayerDetailView**

Where `PlayerDetailView` is rendered in `LockerRoom`, add the new props.

**Step 7: Update LockerRoom component props**

Add to LockerRoom props interface:

```typescript
onDeleteClient?: (clientId: string) => void;
onMergeClients?: (sourceId: string, targetId: string) => void;
```

**Step 8: Verify build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

**Step 9: Commit**

```bash
git add components/LockerRoom.tsx
git commit -m "feat(locker): add Edit button for parent account in player detail"
```

---

## Task 7: Wire LockerRoom to App.tsx

**Files:**
- Modify: `App.tsx` (find LockerRoom usage)

**Step 1: Find LockerRoom usage and add props**

```typescript
<LockerRoom
  // ... existing props
  onDeleteClient={deleteClient}
  onMergeClients={mergeClients}
/>
```

**Step 2: Verify build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

**Step 3: Test in browser**

Run: `npm run dev`
Navigate to: LockerRoom > Select a player with linked parent > Click "Edit" on parent
Expected: Edit panel opens

**Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(app): wire client editing to LockerRoom"
```

---

## Task 8: Final Testing and Cleanup

**Step 1: Full build verification**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Manual testing checklist**

Test each of these scenarios:
- [ ] Open edit panel from Accounts tab
- [ ] Edit name, email, phone, notes, status
- [ ] Add a new payment
- [ ] Edit an existing payment
- [ ] Delete a payment
- [ ] Check for duplicates (create two clients with same name to test)
- [ ] Merge duplicates
- [ ] Delete a client with no linked players
- [ ] Try to delete a client with linked players (should be blocked)
- [ ] Open edit panel from LockerRoom player detail
- [ ] Verify unsaved changes warning on close

**Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: complete client editing feature

- Add/edit/delete client contact details
- Add/edit/delete payment records
- Duplicate detection with smart merge
- Delete protection for clients with linked players
- Edit access from Accounts tab and LockerRoom
- South African phone formatting"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add deleteClient to DataProvider | lib/data-provider.tsx |
| 2 | Add mergeClients to DataProvider | lib/data-provider.tsx |
| 3 | Create ClientEditPanel component | components/ClientEditPanel.tsx |
| 4 | Integrate into AcademyOffice | components/AcademyOffice.tsx |
| 5 | Wire up App.tsx for AcademyOffice | App.tsx |
| 6 | Add Edit button to LockerRoom | components/LockerRoom.tsx |
| 7 | Wire up App.tsx for LockerRoom | App.tsx |
| 8 | Final testing and cleanup | All |
