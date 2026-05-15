const STEPS = [
  {
    n: "01",
    title: "Diagnóstico comercial",
    desc: "Entendemos o seu processo, público, objeções e perfis de cliente para configurar a IRIS sob medida.",
  },
  {
    n: "02",
    title: "Setup da IRIS",
    desc: "Configuramos a plataforma, identidade do agente, regras de atendimento e estrutura inicial do CRM.",
  },
  {
    n: "03",
    title: "Integração WhatsApp",
    desc: "Conectamos sua operação ao WhatsApp via Meta Cloud API ou Evolution API.",
  },
  {
    n: "04",
    title: "Treinamento do agente",
    desc: "Ajustamos prompt, abordagem, tom de voz, objeções e perguntas de qualificação.",
  },
  {
    n: "05",
    title: "Operação e acompanhamento",
    desc: "Acompanhamos os primeiros dias da operação para refinar a IA com base em conversas reais.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">Como funciona</span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Implementação guiada em 5 passos
          </h2>
          <p className="mt-3 text-[#4B5563]">
            Em poucos dias sua operação comercial está rodando com IA, integrada ao WhatsApp e ao CRM.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-5 gap-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
            >
              <span className="text-3xl font-extrabold bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] bg-clip-text text-transparent">
                {s.n}
              </span>
              <h3 className="mt-3 text-base font-bold text-[#0F172A]" style={{ fontFamily: "Plus Jakarta Sans" }}>
                {s.title}
              </h3>
              <p className="mt-2 text-xs text-[#4B5563] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
