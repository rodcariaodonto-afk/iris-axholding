import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    q: "A IRIS substitui o vendedor?",
    a: "Não. A IRIS apoia a equipe respondendo, qualificando e organizando os leads para que os vendedores foquem nas melhores oportunidades.",
  },
  {
    q: "A plataforma funciona com WhatsApp?",
    a: "Sim. A IRIS foi pensada para operações comerciais que usam WhatsApp como canal central de atendimento, integrando com Meta Cloud API ou Evolution API.",
  },
  {
    q: "O que está incluído no setup de R$ 2.500?",
    a: "O setup inclui configuração inicial, personalização do agente, preparação do fluxo comercial, apoio na integração com o WhatsApp e orientação para o início da operação.",
  },
  {
    q: "Quanto tempo leva para começar a operar?",
    a: "Em geral, em poucos dias após o início do setup a operação já está rodando. O prazo final depende das integrações e personalizações da sua empresa.",
  },
  {
    q: "Preciso ter conhecimento técnico?",
    a: "Não. A nossa equipe configura a plataforma, integra o WhatsApp e treina o agente para você. Sua equipe foca na operação comercial.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. A mensalidade é mensal e sem fidelidade obrigatória.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">FAQ</span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Perguntas frequentes
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="text-sm sm:text-base font-semibold text-[#0F172A]"
                    style={{ fontFamily: "Plus Jakarta Sans" }}
                  >
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-[#4B5563] leading-relaxed">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
