import { Check } from "lucide-react";
import { buildWhatsAppUrl } from "./whatsappLink";

const SETUP = [
  "Configuração inicial da plataforma",
  "Personalização do agente IRIS (prompt, tom, regras)",
  "Integração com WhatsApp (Meta ou Evolution)",
  "Treinamento de qualificação e objeções",
  "Acompanhamento dos primeiros dias de operação",
];

const MENSAL = [
  "Uso contínuo da plataforma IRIS",
  "Conversas ilimitadas com IA SDR",
  "CRM completo: contatos, pipeline, oportunidades",
  "Dashboard executivo e relatórios",
  "Agenda integrada com Google Calendar",
  "Suporte e atualizações contínuas",
];

const WPP_URL = buildWhatsAppUrl(
  "Olá! Tenho interesse no Plano de Implantação IRIS (Setup R$ 2.500 + R$ 120/mês). Pode me apresentar os próximos passos?"
);

export default function PricingSection() {
  return (
    <section id="preco" className="py-20 bg-[#EFF6FF]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">Preço</span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Plano de Implantação IRIS
          </h2>
          <p className="mt-3 text-[#4B5563]">
            Um único plano transparente: setup que prepara sua operação para funcionar corretamente,
            mais mensalidade acessível para manter a plataforma ativa.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-[#0F172A] bg-[#0F172A] text-white shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Setup */}
            <div className="p-8 sm:p-10 border-b md:border-b-0 md:border-r border-white/10">
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#06B6D4]">
                Setup de implantação
              </span>
              <p className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-5xl font-extrabold text-white"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  R$ 2.500
                </span>
                <span className="text-sm text-slate-400">pagamento único</span>
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Configuração inicial, personalização do agente, integração e preparação completa da operação.
              </p>
              <ul className="mt-6 space-y-2.5">
                {SETUP.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-slate-100">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#25D366]" strokeWidth={3} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mensalidade */}
            <div className="p-8 sm:p-10 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#06B6D4]/10">
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#25D366]">
                Mensalidade
              </span>
              <p className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-5xl font-extrabold text-white"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  R$ 120
                </span>
                <span className="text-sm text-slate-400">/ mês</span>
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Uso contínuo da plataforma, gestão de conversas, CRM e operação recorrente do agente.
              </p>
              <ul className="mt-6 space-y-2.5">
                {MENSAL.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-slate-100">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#25D366]" strokeWidth={3} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="px-8 sm:px-10 py-6 border-t border-white/10 bg-black/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-slate-400 max-w-md">
              Valores podem variar caso a operação exija integrações, automações ou personalizações
              adicionais fora do escopo padrão.
            </p>
            <a
              href={WPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center px-6 rounded-lg bg-[#25D366] text-white font-semibold hover:bg-[#1fbb59] transition-colors shadow"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Quero implementar a IRIS
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
