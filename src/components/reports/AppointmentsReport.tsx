import React from "react";
import { ReportData } from "@/services/reports";

const Section = ({ title, children }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-slate-200 mb-4">{title}</h3>
    {children}
  </div>
);

const AppointmentsReport: React.FC<{ data: ReportData }> = ({ data }) => {
  const statusMap: Record<string, number> = {};
  data.appointments.forEach((a) => {
    const s = a.status || "scheduled";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  const completed = statusMap["completed"] || 0;
  const total = data.appointments.length;
  const showRate = total ? Math.round((completed / total) * 100) : 0;

  // Upcoming
  const today = new Date();
  const upcoming = data.appointments
    .filter((a) => new Date(a.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-500",
    completed: "bg-green-500",
    cancelled: "bg-red-500",
    no_show: "bg-amber-500",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Agendamentos por Status">
        <div className="space-y-3">
          {Object.entries(statusMap).map(([status, count]) => {
            const pct = (count / (total || 1)) * 100;
            return (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 capitalize">{status.replace("_", " ")}</span>
                  <span className="text-slate-400">{count}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${statusColors[status] || "bg-slate-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between">
          <div className="text-xs text-slate-400">Taxa de comparecimento</div>
          <div className="text-lg font-bold text-green-400">{showRate}%</div>
        </div>
      </Section>

      <Section title="Próximos Agendamentos">
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <li key={a.id} className="p-3 bg-slate-800/50 rounded-lg flex justify-between items-center">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{a.title}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(a.date).toLocaleDateString("pt-BR")} às {a.time?.slice(0, 5)}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 capitalize">
                  {a.type}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-slate-500 text-sm">Nenhum agendamento próximo.</p>}
      </Section>
    </div>
  );
};

export default AppointmentsReport;
