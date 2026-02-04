import React, { useState, useEffect } from 'react';
import { X, Trash2, Users, CreditCard, AlertTriangle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Client, Player, Payment, TrainingSession } from '@/lib/playbook';
import { ClientStatementDocument } from './ClientStatementDocument';

interface ClientEditPanelProps {
  client: Client;
  players: Player[];
  allClients: Client[];
  sessions: TrainingSession[];
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
  sessions,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onMerge
}: ClientEditPanelProps): React.ReactElement | null {
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
  const [showStatement, setShowStatement] = useState(false);

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

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name || name.length < 2) newErrors.name = 'Name is required (min 2 characters)';
    if (!validateEmail(email)) newErrors.email = 'Invalid email format';
    if (!validatePhone(phone)) newErrors.phone = 'Invalid SA phone format (e.g., +27 82 123 4567)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave(): void {
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
  }

  function handleClose(): void {
    if (isDirty) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    onClose();
  }

  function handleDelete(): void {
    if (!canDelete) {
      alert(`Cannot delete. ${linkedPlayers.length} player(s) still linked.`);
      return;
    }
    setShowDeleteConfirm(true);
  }

  function confirmDelete(): void {
    onDelete(client.id);
    onClose();
  }

  function checkDuplicates(): void {
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
  }

  if (!isOpen) return null;

  if (showStatement) {
     return (
        <ClientStatementDocument 
           client={{ ...client, payments }} 
           players={players} 
           sessions={sessions} 
           onClose={() => setShowStatement(false)} 
        />
     );
  }

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
                <Select value={status} onValueChange={(v: 'Active' | 'Inactive' | 'Lead') => setStatus(v)}>
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
          <Button variant="outline" onClick={() => setShowStatement(true)}>
            <Printer className="w-4 h-4 mr-2" /> Print Statement
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!isDirty}>Save Changes</Button>
          </div>
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
function PaymentEditor({ payments, onChange }: { payments: Payment[], onChange: (p: Payment[]) => void }): React.ReactElement {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  function handleAdd(payment: Payment): void {
    onChange([...payments, payment]);
    setIsAdding(false);
  }

  function handleUpdate(payment: Payment): void {
    onChange(payments.map(p => p.id === payment.id ? payment : p));
    setEditingId(null);
  }

  function handleDelete(id: string): void {
    const payment = payments.find(p => p.id === id);
    if (payment && window.confirm(`Delete payment of R ${payment.amount} from ${payment.date}?`)) {
      onChange(payments.filter(p => p.id !== id));
    }
  }

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
  onCancel,
  key
}: {
  payment?: Payment,
  onSave: (p: Payment) => void,
  onCancel: () => void,
  key?: any
}): React.ReactElement {
  const [date, setDate] = useState(payment?.date || new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(payment?.amount?.toString() || '');
  const [reference, setReference] = useState(payment?.reference || '');
  const [note, setNote] = useState(payment?.note || '');

  function handleSubmit(): void {
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
  }

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
}): React.ReactElement | null {
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
