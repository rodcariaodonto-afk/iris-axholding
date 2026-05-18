import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useBookableResources, useCreateCoworkingBooking } from '@/hooks/useCoworking';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string | null;
  defaultDate?: string;
  onCreated?: () => void;
}

export default function CoworkingBookingModal({ open, onOpenChange, contactId, defaultDate, onCreated }: Props) {
  const { resources } = useBookableResources({ onlyActive: true, onlyPublic: true });
  const create = useCreateCoworkingBooking();

  const [form, setForm] = useState({
    resource_id: '', title: '', date: defaultDate || '', time: '09:00',
    duration: 60, modality: 'presencial', internal_notes: '',
    requires_payment: false, amount: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resource_id || !form.title || !form.date) {
      toast.error('Preencha sala, título e data');
      return;
    }
    setSaving(true);
    try {
      await create({
        resource_id: form.resource_id,
        contact_id: contactId || null,
        title: form.title,
        date: form.date,
        time: form.time,
        duration: form.duration,
        modality: form.modality,
        internal_notes: form.internal_notes,
        requires_payment: form.requires_payment,
        amount: form.amount ? Number(form.amount) : undefined,
      });
      toast.success('Reserva criada com sucesso');
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao criar reserva');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova reserva de coworking</DialogTitle>
          <DialogDescription>Selecione uma sala disponível e os detalhes da reserva.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Sala</Label>
            <Select value={form.resource_id} onValueChange={v => setForm({ ...form, resource_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
              <SelectContent>
                {resources.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}{r.capacity ? ` (${r.capacity} pessoas)` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Sessão de coaching" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Hora</Label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={String(form.duration)} onValueChange={v => setForm({ ...form, duration: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1h</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.requires_payment} onCheckedChange={c => setForm({ ...form, requires_payment: !!c })} />
            Requer pagamento PIX manual
          </label>
          {form.requires_payment && (
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar reserva</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
