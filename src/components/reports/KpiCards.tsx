import React from "react";
import { Users, Target, TrendingUp, DollarSign, Clock, Calendar } from "lucide-react";
import { ReportData } from "@/services/reports";

const Card = ({ icon: Icon, label, value, hint, color }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5 hover:border-cyan-500/40 transition-all">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div className="text-2xl font-bold text-slate-100">{value}</div>
    <div className="text-xs text-slate-400 mt-1">{label}</div>
    {hint && <div className="text-xs text-slate-500 mt-2">{hint}</div>}
  </div>
);

const KpiCards: React.FC<{ data: ReportData }> = ({ data }) => {
  const totalLeads = data.contacts.length;
  const qualified = data.contacts.filter(
    (c) => (c.client_memory?.lead_profile?.qualification_score || 0) >= 70
  ).length;
  const qualifiedPct = totalLeads ? Math.round((qualified / totalLeads) * 100) : 0;

  const wonDeals = data.deals.filter((d) => d.won_at);
  const lostDeals = data.deals.filter((d) => d.lost_at);
  const closedTotal = wonDeals.length + lostDeals.length;
  const conversionRate = closedTotal ? Math.round((wonDeals.length / closedTotal) * 100) : 0;

  const totalRevenue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const avgTicket = wonDeals.length ? totalRevenue / wonDeals.length : 0;

  const ninaMessages = data.messages.filter((m) => m.processed_by_nina && m.nina_response_time);
  const avgResponseMs = ninaMessages.length
    ? ninaMessages.reduce((s, m) => s + (m.nina_response_time || 0), 0) / ninaMessages.length
    : 0;

  const scheduled = data.appointments.length;
  const completed = data.appointments.filter((a) => a.status === "completed").length;

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card icon={Users} label="Total de Leads" value={totalLeads} color="bg-blue-500/80" />
      <Card
        icon={Target}
        label="Taxa de Qualificação"
        value={`${qualifiedPct}%`}
        hint={`${qualified} qualificados`}
        color="bg-purple-500/80"
      />
      <Card
        icon={TrendingUp}
        label="Taxa de Conversão"
        value={`${conversionRate}%`}
        hint={`${wonDeals.length} ganhos / ${closedTotal} fechados`}
        color="bg-green-500/80"
      />
      <Card
        icon={DollarSign}
        label="Ticket Médio"
        value={fmtBRL(avgTicket)}
        hint={`Receita: ${fmtBRL(totalRevenue)}`}
        color="bg-amber-500/80"
      />
      <Card
        icon={Clock}
        label="Resposta Média FCE"
        value={`${(avgResponseMs / 1000).toFixed(1)}s`}
        hint={`${ninaMessages.length} respostas`}
        color="bg-cyan-500/80"
      />
      <Card
        icon={Calendar}
        label="Agendamentos"
        value={scheduled}
        hint={`${completed} realizados`}
        color="bg-pink-500/80"
      />
    </div>
  );
};

export default KpiCards;
