import React, { useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchReportData, getDateRange, exportToCsv, ReportData } from "@/services/reports";
import KpiCards from "./reports/KpiCards";
import LeadsAnalytics from "./reports/LeadsAnalytics";
import PipelineFunnel from "./reports/PipelineFunnel";
import AiPerformance from "./reports/AiPerformance";
import AppointmentsReport from "./reports/AppointmentsReport";
import TeamPerformance from "./reports/TeamPerformance";
import { toast } from "sonner";

const PERIODS = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
];

const Reports: React.FC = () => {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const range = getDateRange(period);
      const result = await fetchReportData(range);
      setData(result);
    } catch (e: any) {
      toast.error("Erro ao carregar relatórios: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const handleExport = () => {
    if (!data) return;
    const rows = data.contacts.map((c) => ({
      nome: c.name || c.call_name || "",
      telefone: c.phone_number,
      email: c.email || "",
      score: c.client_memory?.lead_profile?.qualification_score || 0,
      estagio: c.client_memory?.lead_profile?.lead_stage || "new",
      orcamento: c.client_memory?.sales_intelligence?.budget_indication || "",
      criado_em: new Date(c.created_at).toLocaleDateString("pt-BR"),
    }));
    exportToCsv(`relatorio-leads-${period}-${Date.now()}.csv`, rows);
    toast.success("Relatório exportado!");
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Central de Relatórios</h1>
            <p className="text-sm text-slate-400">Análise completa de leads, pipeline e performance da Iris</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p.id
                    ? "bg-cyan-500 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!data}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando dados…
        </div>
      ) : data ? (
        <>
          <KpiCards data={data} />

          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Análise de Leads</h2>
            <LeadsAnalytics data={data} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Pipeline & Conversões</h2>
            <PipelineFunnel data={data} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Performance da Iris</h2>
            <AiPerformance data={data} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Agendamentos</h2>
            <AppointmentsReport data={data} />
          </div>

          {data.teamMembers.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Equipe</h2>
              <TeamPerformance data={data} />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default Reports;
