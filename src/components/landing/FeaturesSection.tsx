import {
  MessageCircle,
  Bot,
  Users,
  Kanban,
  BarChart3,
  Calendar,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Integração com WhatsApp",
    desc: "Atendimento conectado ao canal onde o cliente já conversa, com Meta Cloud API ou Evolution API.",
  },
  {
    icon: Bot,
    title: "Agente configurável por prompt",
    desc: "A IA segue o tom, regras, objeções e processo comercial da sua empresa.",
  },
  {
    icon: Users,
    title: "Contatos e CRM",
    desc: "Cadastro completo, tags, histórico de conversas e segmentação por interesse.",
  },
  {
    icon: Kanban,
    title: "Pipeline visual (Kanban)",
    desc: "Organize oportunidades por etapa, com motivos de perda e valores estimados.",
  },
  {
    icon: BarChart3,
    title: "Dashboard executivo",
    desc: "Métricas de atendimento, conversão, leads qualificados e desempenho da operação.",
  },
  {
    icon: Calendar,
    title: "Agenda integrada",
    desc: "A IRIS agenda demonstrações e reuniões direto no Google Calendar da sua equipe.",
  },
  {
    icon: Sparkles,
    title: "Lead score com IA",
    desc: "Cada lead recebe pontuação e próxima melhor ação para acelerar a venda.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-time e permissões",
    desc: "Times, funções e governança para operar com segurança e rastreabilidade.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316]">Funcionalidades</span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Tudo que sua operação comercial precisa
          </h2>
          <p className="mt-3 text-[#4B5563]">
            Plataforma completa para atender, qualificar, organizar e converter leads do WhatsApp.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-[#06B6D4]/30 transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-[#06B6D4]" strokeWidth={2} />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A]" style={{ fontFamily: "Plus Jakarta Sans" }}>
                {title}
              </h3>
              <p className="mt-2 text-xs text-[#4B5563] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
