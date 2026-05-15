import { X, Check } from "lucide-react";

const ANTES = [
  "Atendimento reativo e manual",
  "Leads sem resposta no WhatsApp",
  "Conversas espalhadas e oportunidades perdidas",
  "Equipe não sabe quem está quente ou frio",
  "Sem histórico nem visibilidade do pipeline",
];

const DEPOIS = [
  "Atendimento inteligente com IA apoiando a operação",
  "IRIS responde 24/7 e qualifica o primeiro contato",
  "Conversas, contatos e oportunidades centralizados",
  "Lead score e próxima melhor ação para cada conversa",
  "Dashboard com métricas, histórico e evolução comercial",
];

export default function TransformSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">Antes & Depois</span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            De um WhatsApp desorganizado para uma operação comercial inteligente
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-[#0F172A]" style={{ fontFamily: "Plus Jakarta Sans" }}>
              Antes da IRIS
            </h3>
            <ul className="mt-5 space-y-3">
              {ANTES.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-[#4B5563]">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <X className="h-3 w-3 text-red-500" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#06B6D4]/30 bg-gradient-to-br from-[#EFF6FF] to-white p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#0F172A]" style={{ fontFamily: "Plus Jakarta Sans" }}>
              Depois da IRIS
            </h3>
            <ul className="mt-5 space-y-3">
              {DEPOIS.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-[#0F172A]">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-[#25D366]" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
