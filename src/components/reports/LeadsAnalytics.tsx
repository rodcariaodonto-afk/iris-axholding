import React from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { ReportData } from "@/services/reports";

const COLORS = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

const Section = ({ title, children }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-slate-200 mb-4">{title}</h3>
    {children}
  </div>
);

const LeadsAnalytics: React.FC<{ data: ReportData }> = ({ data }) => {
  // Lead stage distribution
  const stageMap: Record<string, number> = {};
  data.contacts.forEach((c) => {
    const stage = c.client_memory?.lead_profile?.lead_stage || "new";
    stageMap[stage] = (stageMap[stage] || 0) + 1;
  });
  const stageData = Object.entries(stageMap).map(([name, value]) => ({ name, value }));

  // Score buckets
  const buckets = { "0-30": 0, "31-60": 0, "61-80": 0, "81-100": 0 };
  data.contacts.forEach((c) => {
    const s = c.client_memory?.lead_profile?.qualification_score || 0;
    if (s <= 30) buckets["0-30"]++;
    else if (s <= 60) buckets["31-60"]++;
    else if (s <= 80) buckets["61-80"]++;
    else buckets["81-100"]++;
  });
  const scoreData = Object.entries(buckets).map(([range, count]) => ({ range, count }));

  // Top interests
  const interestMap: Record<string, number> = {};
  data.contacts.forEach((c) => {
    const interests: string[] = c.client_memory?.lead_profile?.interests || [];
    interests.forEach((i) => (interestMap[i] = (interestMap[i] || 0) + 1));
  });
  const topInterests = Object.entries(interestMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Top objections / pain points
  const painMap: Record<string, number> = {};
  data.contacts.forEach((c) => {
    const pains: string[] = c.client_memory?.sales_intelligence?.pain_points || [];
    const objs: string[] = c.client_memory?.lead_profile?.objections || [];
    [...pains, ...objs].forEach((p) => (painMap[p] = (painMap[p] || 0) + 1));
  });
  const topPains = Object.entries(painMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Distribuição por Estágio do Lead">
        {stageData.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {stageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-slate-500 text-sm">Sem dados.</p>}
      </Section>

      <Section title="Distribuição por Score de Qualificação">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={scoreData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="range" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Top 10 Interesses Mencionados">
        {topInterests.length ? (
          <ul className="space-y-2">
            {topInterests.map(([interest, count]) => (
              <li key={interest} className="flex justify-between items-center text-sm">
                <span className="text-slate-300 truncate">{interest}</span>
                <span className="text-cyan-400 font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-slate-500 text-sm">Sem interesses registrados.</p>}
      </Section>

      <Section title="Top Dores e Objeções">
        {topPains.length ? (
          <ul className="space-y-2">
            {topPains.map(([pain, count]) => (
              <li key={pain} className="flex justify-between items-center text-sm">
                <span className="text-slate-300 truncate">{pain}</span>
                <span className="text-amber-400 font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-slate-500 text-sm">Sem objeções registradas.</p>}
      </Section>
    </div>
  );
};

export default LeadsAnalytics;
