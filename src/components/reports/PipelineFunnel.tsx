import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { ReportData } from "@/services/reports";

const Section = ({ title, children }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-slate-200 mb-4">{title}</h3>
    {children}
  </div>
);

const PipelineFunnel: React.FC<{ data: ReportData }> = ({ data }) => {
  // Deals by stage
  const stageData = data.pipelineStages.map((stage) => {
    const dealsInStage = data.deals.filter((d) => d.stage_id === stage.id);
    const value = dealsInStage.reduce((s, d) => s + Number(d.value || 0), 0);
    return { name: stage.title, count: dealsInStage.length, value };
  });

  // Lost reasons
  const reasonMap: Record<string, number> = {};
  data.deals
    .filter((d) => d.lost_at && d.lost_reason)
    .forEach((d) => (reasonMap[d.lost_reason] = (reasonMap[d.lost_reason] || 0) + 1));
  const topReasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Deals por Estágio do Pipeline">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stageData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" stroke="#64748b" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={100} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
          {stageData.map((s) => (
            <div key={s.name} className="flex justify-between text-slate-400">
              <span>{s.name}</span>
              <span className="text-slate-300">{fmtBRL(s.value)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motivos de Perda">
        {topReasons.length ? (
          <ul className="space-y-2">
            {topReasons.map(([reason, count]) => {
              const max = topReasons[0][1];
              const pct = (count / max) * 100;
              return (
                <li key={reason} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300 truncate">{reason}</span>
                    <span className="text-red-400 font-semibold">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-slate-500 text-sm">Sem deals perdidos no período.</p>}
      </Section>
    </div>
  );
};

export default PipelineFunnel;
