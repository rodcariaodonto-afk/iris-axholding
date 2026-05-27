import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { ReportData } from "@/services/reports";

const COLORS = ["#e50789", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

const Section = ({ title, children }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-slate-200 mb-4">{title}</h3>
    {children}
  </div>
);

const AiPerformance: React.FC<{ data: ReportData }> = ({ data }) => {
  // Volume by day
  const dailyMap: Record<string, number> = {};
  data.messages.forEach((m) => {
    const day = new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  });
  const dailyData = Object.entries(dailyMap).map(([day, count]) => ({ day, count }));

  // Type distribution
  const typeMap: Record<string, number> = {};
  data.messages.forEach((m) => (typeMap[m.type] = (typeMap[m.type] || 0) + 1));
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  // From type distribution
  const fromMap = { user: 0, nina: 0, human: 0 };
  data.messages.forEach((m) => {
    if (m.from_type in fromMap) fromMap[m.from_type as keyof typeof fromMap]++;
  });

  const totalFromBot = fromMap.nina + fromMap.human;
  const aiPct = totalFromBot ? Math.round((fromMap.nina / totalFromBot) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Volume de Mensagens por Dia">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Area type="monotone" dataKey="count" stroke="#e50789" fill="#e50789" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Tipos de Mensagem">
        {typeData.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-slate-500 text-sm">Sem dados.</p>}
      </Section>

      <Section title="Resolução: IA vs Humano">
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="text-center p-4 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-cyan-400">{fromMap.nina}</div>
            <div className="text-xs text-slate-400 mt-1">FCE (IA)</div>
          </div>
          <div className="text-center p-4 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">{fromMap.human}</div>
            <div className="text-xs text-slate-400 mt-1">Humano</div>
          </div>
          <div className="text-center p-4 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{aiPct}%</div>
            <div className="text-xs text-slate-400 mt-1">Auto-resolução</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Mensagens recebidas dos clientes: <span className="text-slate-300 font-semibold">{fromMap.user}</span>
        </div>
      </Section>

      <Section title="Conversas Ativas e Status">
        <div className="space-y-3">
          {(["nina", "human", "paused"] as const).map((status) => {
            const count = data.conversations.filter((c) => c.status === status).length;
            const total = data.conversations.length || 1;
            const pct = (count / total) * 100;
            const labels = { nina: "Atendidas pela FCE", human: "Atendidas por Humano", paused: "Pausadas" };
            const colors = { nina: "bg-pink-600", human: "bg-purple-500", paused: "bg-amber-500" };
            return (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{labels[status]}</span>
                  <span className="text-slate-400">{count}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${colors[status]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
};

export default AiPerformance;
