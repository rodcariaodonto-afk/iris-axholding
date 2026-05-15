import { Check, Bot, MessagesSquare, Sparkles } from "lucide-react";
import { DEFAULT_WHATSAPP_URL } from "./whatsappLink";

const PROVAS = [
  { titulo: "Atendimento 24/7", desc: "Resposta imediata no WhatsApp" },
  { titulo: "IA SDR qualifica", desc: "Lead score e próxima ação" },
  { titulo: "CRM integrado", desc: "Pipeline, contatos e oportunidades" },
];

export default function LandingHero() {
  return (
    <section id="top" className="relative pt-24 pb-16 sm:pt-28 sm:pb-20 bg-[#EFF6FF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-200 px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-sm"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
            Agente de IA SDR para WhatsApp
          </span>

          <h1
            className="mt-5 text-[36px] sm:text-[44px] lg:text-[52px] leading-[1.05] tracking-tight font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Transforme conversas do{" "}
            <span className="text-[#25D366]">WhatsApp</span> em vendas com uma{" "}
            <span className="text-[#06B6D4]">Agente SDR de IA</span> trabalhando por você.
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[#4B5563] max-w-xl" style={{ fontFamily: "Inter, sans-serif" }}>
            A IRIS atende, qualifica e organiza seus leads automaticamente, enquanto sua equipe acompanha
            conversas, contatos e oportunidades em uma plataforma inteligente com lead score e próxima
            melhor ação comercial.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a
              href={DEFAULT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center px-6 rounded-lg bg-[#25D366] text-white font-semibold hover:bg-[#1fbb59] shadow-sm transition-colors"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Quero implementar a IRIS
            </a>
            <a
              href="#como-funciona"
              className="inline-flex h-12 items-center justify-center px-6 rounded-lg border-2 border-[#06B6D4] text-[#0F172A] font-semibold hover:bg-[#06B6D4]/5 transition-colors"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Como funciona
            </a>
          </div>

          <ul className="mt-8 grid sm:grid-cols-3 gap-4">
            {PROVAS.map((p) => (
              <li key={p.titulo} className="flex items-start gap-2">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-[#25D366]/15 flex items-center justify-center">
                  <Check className="h-3 w-3 text-[#25D366]" strokeWidth={3} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]" style={{ fontFamily: "Plus Jakarta Sans" }}>
                    {p.titulo}
                  </p>
                  <p className="text-xs text-[#4B5563]">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-8">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-tr from-[#06B6D4]/20 via-[#7C3AED]/10 to-[#25D366]/20 rounded-3xl blur-2xl" />
      <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="ml-3 text-xs font-semibold text-slate-500">IRIS · Conversas</div>
        </div>
        {/* chat preview */}
        <div className="p-5 space-y-3 bg-white min-h-[360px]">
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              JM
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none px-3 py-2 text-sm text-[#0F172A] max-w-[75%]">
              Oi, vocês fazem orçamento para empresas?
            </div>
          </div>
          <div className="flex items-start gap-2 justify-end">
            <div className="bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white rounded-2xl rounded-tr-none px-3 py-2 text-sm max-w-[75%]">
              Olá, João! Sou a IRIS. Faço sim, posso entender melhor sua operação para te enviar
              uma proposta agora?
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#7C3AED] flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              JM
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none px-3 py-2 text-sm text-[#0F172A] max-w-[75%]">
              Perfeito. Somos uma clínica com 12 colaboradores.
            </div>
          </div>

          {/* lead score card */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-[#EFF6FF] to-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#06B6D4]" />
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">
                  Análise IRIS
                </span>
              </div>
              <span className="text-xs font-bold text-[#25D366]">Lead quente · 92</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Conversas" value="32" />
              <Stat label="Qualificados" value="18" />
              <Stat label="Oportunidades" value="9" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#4B5563]">
              <MessagesSquare className="h-3.5 w-3.5 text-[#7C3AED]" />
              Próxima ação: agendar demonstração
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 py-2">
      <p className="text-base font-extrabold text-[#0F172A]">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
    </div>
  );
}
