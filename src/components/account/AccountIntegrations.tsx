import { Link } from "react-router-dom";
import { MessageSquare, Calendar, Sparkles, Users } from "lucide-react";

const items = [
  { title: "WhatsApp / Evolution", description: "Conecte seu número de WhatsApp Business ou Evolution API.", icon: MessageSquare, to: "/settings" },
  { title: "Google Calendar", description: "Sincronize agendamentos com sua agenda Google.", icon: Calendar, to: "/scheduling" },
  { title: "Inteligência Artificial", description: "Configure o prompt, voz e comportamento da Nina.", icon: Sparkles, to: "/settings" },
  { title: "Equipe & Distribuição", description: "Gerencie membros operacionais e distribuição de leads.", icon: Users, to: "/team" },
];

export default function AccountIntegrations() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Atalhos para configurar serviços conectados a esta conta.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it) => (
          <Link
            key={it.title}
            to={it.to}
            className="p-5 rounded-xl bg-card border border-border/40 hover:border-primary/40 hover:bg-secondary/30 transition group"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20">
                <it.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1">{it.title}</div>
                <p className="text-sm text-muted-foreground">{it.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
