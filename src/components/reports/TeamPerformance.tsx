import React from "react";
import { ReportData } from "@/services/reports";

const TeamPerformance: React.FC<{ data: ReportData }> = ({ data }) => {
  if (!data.teamMembers.length) return null;

  const stats = data.teamMembers.map((m) => {
    const dealsWon = data.deals.filter((d) => d.owner_id === m.id && d.won_at).length;
    const dealsLost = data.deals.filter((d) => d.owner_id === m.id && d.lost_at).length;
    const revenue = data.deals
      .filter((d) => d.owner_id === m.id && d.won_at)
      .reduce((s, d) => s + Number(d.value || 0), 0);
    const conversations = data.conversations.filter((c) => c.assigned_user_id === m.user_id).length;
    return { name: m.name, dealsWon, dealsLost, revenue, conversations };
  });

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Performance da Equipe</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
              <th className="py-2 px-3">Membro</th>
              <th className="py-2 px-3">Conversas</th>
              <th className="py-2 px-3">Ganhos</th>
              <th className="py-2 px-3">Perdidos</th>
              <th className="py-2 px-3">Receita</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-3 px-3 text-slate-200">{s.name}</td>
                <td className="py-3 px-3 text-slate-300">{s.conversations}</td>
                <td className="py-3 px-3 text-green-400">{s.dealsWon}</td>
                <td className="py-3 px-3 text-red-400">{s.dealsLost}</td>
                <td className="py-3 px-3 text-cyan-400 font-semibold">{fmtBRL(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamPerformance;
