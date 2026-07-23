import { useState } from 'react';
import { Loader2, Building2, RefreshCw, Check, X, Lock } from 'lucide-react';
import { useBookableResources, useCoworkingEnabled, useToggleCoworking, useBootstrapDefaults, useCoworkingModuleAvailable } from '@/hooks/useCoworking';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CoworkingSettings() {
  const { role, isSuperAdmin } = useActiveAccount();
  const canManage = isSuperAdmin || role === 'owner' || role === 'admin';
  const { available: moduleAvailable, loading: loadingModule } = useCoworkingModuleAvailable();
  const { enabled, loading: loadingEnabled, refresh } = useCoworkingEnabled();
  const { toggle, saving } = useToggleCoworking();
  const { resources, loading: loadingRes } = useBookableResources();
  const bootstrap = useBootstrapDefaults();
  const [bootstrapping, setBootstrapping] = useState(false);

  const handleToggle = async (val: boolean) => {
    if (val && !moduleAvailable) {
      toast.error('Módulo Coworking não liberado para esta conta');
      return;
    }

    try {
      await toggle(val);
      toast.success(val ? 'Coworking ativado — salas padrão criadas' : 'Coworking desativado');
      refresh();
    } catch (e) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      await bootstrap();
      toast.success('Salas padrão verificadas');
    } catch (e) {
      toast.error('Erro ao criar salas padrão');
    } finally { setBootstrapping(false); }
  };

  if (loadingEnabled || loadingModule) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6 text-slate-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Módulo Coworking
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Gestão de salas reserváveis, controle de conflitos e validação de pagamento PIX manual.
            </p>
          </div>
          {canManage && moduleAvailable ? (
            <Switch checked={enabled} disabled={saving} onCheckedChange={handleToggle} />
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-400"><Lock className="w-3 h-3" /> {moduleAvailable ? 'Somente leitura' : 'Não liberado'}</span>
          )}
        </div>
        {!enabled && moduleAvailable && (
          <p className="text-xs text-slate-500 mt-4">
            Ao ativar, 4 salas padrão (Sala 01-04) serão criadas automaticamente. O campo "Sala" aparecerá no modal de novo agendamento.
          </p>
        )}
      </div>

      {enabled && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-white">Salas cadastradas</h4>
              <p className="text-xs text-slate-500 mt-0.5">{resources.length} sala(s) na conta</p>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" onClick={handleBootstrap} disabled={bootstrapping} className="gap-2">
                {bootstrapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Recriar salas padrão
              </Button>
            )}
          </div>
          {loadingRes ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : resources.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhuma sala cadastrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nome</th>
                  <th className="text-left px-4 py-2 font-medium">Capacidade</th>
                  <th className="text-left px-4 py-2 font-medium">Prioridade</th>
                  <th className="text-center px-4 py-2 font-medium">Ativa</th>
                  <th className="text-center px-4 py-2 font-medium">Pública</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(r => (
                  <tr key={r.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{r.name}{r.description && <div className="text-xs text-slate-500 font-normal">{r.description}</div>}</td>
                    <td className="px-4 py-3 text-slate-300">{r.capacity ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{r.allocation_priority}</td>
                    <td className="px-4 py-3 text-center">{r.is_active ? <Check className="w-4 h-4 text-emerald-400 inline" /> : <X className="w-4 h-4 text-slate-600 inline" />}</td>
                    <td className="px-4 py-3 text-center">{r.is_publicly_bookable ? <Check className="w-4 h-4 text-emerald-400 inline" /> : <X className="w-4 h-4 text-slate-600 inline" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
