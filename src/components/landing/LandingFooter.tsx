const LINKS = [
  { href: "#beneficios", label: "Benefícios" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#preco", label: "Preço" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingFooter() {
  return (
    <footer className="bg-[#0F172A] text-slate-300 py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p
              className="text-2xl font-extrabold bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] bg-clip-text text-transparent"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              IRIS
            </p>
            <p className="mt-1 text-sm text-slate-400 max-w-md">
              Agente SDR de IA para WhatsApp. Atende, qualifica e organiza seus leads
              com plataforma integrada de CRM, pipeline e dashboard.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Rodapé">
            {LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-sm text-slate-300 hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} IRIS · AXHolding. Todos os direitos reservados.</p>
          <p>Feito com IA, processo e governança.</p>
        </div>
      </div>
    </footer>
  );
}
