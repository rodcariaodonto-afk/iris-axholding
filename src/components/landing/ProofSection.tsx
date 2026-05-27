import { Zap, Target, Layers, ArrowRight } from "lucide-react";

const ITEMS = [
  {
    icon: Zap,
    title: "Atendimento instantâneo",
    desc: "Responda leads no momento em que demonstram interesse, sem depender da disponibilidade da equipe.",
  },
  {
    icon: Target,
    title: "Qualificação comercial",
    desc: "A FCE identifica intenção, interesses e etapa do lead para entregar oportunidades prontas para o vendedor.",
  },
  {
    icon: Layers,
    title: "Tudo centralizado",
    desc: "Conversas, contatos, oportunidades e histórico em uma única plataforma com pipeline visual.",
  },
  {
    icon: ArrowRight,
    title: "Próxima melhor ação",
    desc: "A IA sugere o próximo passo comercial para cada conversa, evitando que oportunidades esfriem.",
  },
];

export default function ProofSection() {
  return (
    <section id="beneficios" className="py-20 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">Benefícios</span>
        <h2
          className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
          style={{ fontFamily: "Plus Jakarta Sans" }}
        >
          Resultados reais para o seu time comercial
        </h2>
        <p className="mt-3 text-[#4B5563] max-w-2xl mx-auto">
          A FCE atua como uma camada de inteligência comercial em cima do seu WhatsApp,
          aumentando velocidade de resposta, qualificação e organização das oportunidades.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ITEMS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="text-left rounded-xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-[#e50789]/30 transition-all"
            >
              <div className="h-11 w-11 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-[#e50789]" strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]" style={{ fontFamily: "Plus Jakarta Sans" }}>
                {title}
              </h3>
              <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
