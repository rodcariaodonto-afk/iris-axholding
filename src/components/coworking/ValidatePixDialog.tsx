import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useValidateManualPix } from '@/hooks/useCoworking';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: { id: string; amount: number | null; proof_url: string | null } | null;
  onValidated?: () => void;
}

export default function ValidatePixDialog({ open, onOpenChange, payment, onValidated }: Props) {
  const validate = useValidateManualPix();
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!payment) return;
    setSaving(true);
    try {
      await validate(payment.id);
      toast.success('Pagamento confirmado');
      onValidated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao validar pagamento');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento PIX</DialogTitle>
          <DialogDescription>
            Marque este pagamento como recebido. O agendamento será automaticamente confirmado.
          </DialogDescription>
        </DialogHeader>
        {payment && (
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold">{payment.amount ? `R$ ${payment.amount.toFixed(2)}` : 'A definir'}</span>
            </div>
            {payment.proof_url && (
              <a href={payment.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver comprovante</a>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
