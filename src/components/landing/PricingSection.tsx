import { Check } from "lucide-react";
import { buildWhatsAppUrl } from "./whatsappLink";

const SETUP_ITEMS = [
  "Configuração inicial da plataforma",
  "Personalização do agente IRIS (prompt, tom, regras)",
  "Integração com WhatsApp (Meta ou Evolution)",
  "Treinamento de qualificação e objeções",
  "Acompanhamento dos primeiros dias de operação",
];

type Plan = {
  code: string;
  name: string;
  price: string;
  priceSuffix?: string;
  highlight?: boolean;
  features: string[];
  cta: string;
  ctaMessage: string;
};

const PLANS: Plan[] = [
  {
    code: "starter",
    name: "Starter",
    price: "R$ 120",
    priceSuffix: "/ mês",
    features: [
      "1 usuário",
      "1 sessão de WhatsApp",
      "3.000 respostas de IA / mês",
      "Contatos e mensagens recebidas ilimitados",
      "CRM, pipeline e relatórios",
    ],
    cta: "Começar com Starter",
    ctaMessage:
      "Olá! Tenho interesse no Plano Starter da IRIS (Setup R$ 2.500 + R$ 120/mês). Pode me apresentar os próximos passos?",
  },
  {
    code: "pro",
    name: "Pro",
    price: "R$ 297",
    priceSuffix: "/ mês",
    highlight: true,
    features: [
      "Até 5 usuários",
      "Até 5 sessões de WhatsApp",
      "12.000 respostas de IA / mês",
      "Contatos e mensagens recebidas ilimitados",
      "CRM, pipeline e relatórios",
      "Agenda integrada (Google Calendar)",
    ],
    cta: "Quero o Plano Pro",
    ctaMessage:
      "Olá! Tenho interesse no Plano Pro da IRIS (Setup R$ 2.500 + R$ 297/mês). Pode me apresentar os próximos passos?",
  },
  {
    code: "business",
    name: "Business",
    price: "R$ 997",
    priceSuffix: "/ mês",
    features: [
      "Até 30 usuários",
      "Até 30 sessões de WhatsApp",
      "Contatos ilimitados",
      "Mensagens ilimitadas",
      "Multi-times e permissões avançadas",
      "Suporte prioritário",
    ],
    cta: "Quero o Plano Business",
    ctaMessage:
      "Olá! Tenho interesse no Plano Business da IRIS (Setup R$ 2.500 + R$ 997/mês). Pode me apresentar os próximos passos?",
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    features: [
      "Usuários ilimitados",
      "Sessões de WhatsApp ilimitadas",
      "SLA dedicado e infraestrutura sob medida",
      "Integrações e automações personalizadas",
      "Onboarding e treinamento dedicados",
    ],
    cta: "Falar com vendas",
    ctaMessage:
      "Olá! Tenho interesse no Plano Enterprise da IRIS. Pode me apresentar uma proposta sob medida?",
  },
];

const SETUP_WPP_URL = buildWhatsAppUrl(
  "Olá! Tenho interesse no Setup de Implantação da IRIS (R$ 2.500). Pode me apresentar os próximos passos?"
);

export default function PricingSection() {
  return (
    <section id="preco" className="py-20 bg-[#EFF6FF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">Planos</span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Setup único + plano mensal
          </h2>
          <p className="mt-3 text-[#4B5563]">
            Um setup de implantação que prepara sua operação para funcionar corretamente, mais o
            plano mensal que melhor se encaixa no seu time.
          </p>
        </div>

        {/* Setup */}
        <div className="mt-12 rounded-2xl border border-[#0F172A] bg-[#0F172A] text-white shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
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
                Configuração inicial, personalização do agente, integração e preparação completa da
                operação. Obrigatório para qualquer plano mensal.
              </p>
              <ul className="mt-6 space-y-2.5">
                {SETUP_ITEMS.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-slate-100">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#25D366]" strokeWidth={3} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 sm:p-10 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#06B6D4]/10 flex flex-col justify-center">
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#25D366]">
                Como funciona
              </span>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                Após o setup, você escolhe o plano mensal que melhor se encaixa no tamanho do seu
                time e na quantidade de números de WhatsApp que vai operar. Sem fidelidade.
              </p>
              <a
                href={SETUP_WPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-12 items-center justify-center px-6 rounded-lg bg-[#25D366] text-white font-semibold hover:bg-[#1fbb59] transition-colors shadow w-full sm:w-auto"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Quero contratar o setup
              </a>
            </div>
          </div>
        </div>

        {/* Planos mensais */}
        <div className="mt-10">
          <h3
            className="text-center text-2xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Escolha seu plano mensal
          </h3>
          <p className="text-center text-sm text-[#4B5563] mt-2">
            Todos os planos incluem contatos e mensagens ilimitados.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((p) => {
              const url = buildWhatsAppUrl(p.ctaMessage);
              return (
                <div
                  key={p.code}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    p.highlight
                      ? "border-[#06B6D4] bg-white shadow-xl ring-2 ring-[#06B6D4]/20 relative"
                      : "border-slate-200 bg-white shadow-sm"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#06B6D4] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                      Mais escolhido
                    </span>
                  )}
                  <div className="text-sm font-bold uppercase tracking-widest text-[#F97316]">
                    {p.name}
                  </div>
                  <p className="mt-3 flex items-baseline gap-1.5">
                    <span
                      className="text-3xl font-extrabold text-[#0F172A]"
                      style={{ fontFamily: "Plus Jakarta Sans" }}
                    >
                      {p.price}
                    </span>
                    {p.priceSuffix && (
                      <span className="text-xs text-slate-500">{p.priceSuffix}</span>
                    )}
                  </p>
                  <ul className="mt-5 space-y-2 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-[#0F172A]">
                        <Check
                          className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#25D366]"
                          strokeWidth={3}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-6 inline-flex h-11 items-center justify-center px-4 rounded-lg font-semibold text-sm transition-colors ${
                      p.highlight
                        ? "bg-[#0F172A] text-white hover:bg-[#1e293b]"
                        : "border border-[#0F172A] text-[#0F172A] hover:bg-[#0F172A] hover:text-white"
                    }`}
                    style={{ fontFamily: "Plus Jakarta Sans" }}
                  >
                    {p.cta}
                  </a>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-slate-500 max-w-2xl mx-auto">
            Valores podem variar caso a operação exija integrações, automações ou personalizações
            adicionais fora do escopo padrão. Sem fidelidade.
          </p>
        </div>
      </div>
    </section>
  );
}
