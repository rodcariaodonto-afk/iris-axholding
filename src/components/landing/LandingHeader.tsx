import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { DEFAULT_WHATSAPP_URL } from "./whatsappLink";

const NAV = [
  { href: "#beneficios", label: "Benefícios" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#preco", label: "Preço" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2" aria-label="FCE — início">
          <span
            className="text-2xl font-extrabold bg-gradient-to-r from-[#e50789] to-[#8f1b3f] bg-clip-text text-transparent"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            FCE
          </span>
          <span className="hidden sm:inline text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Agente SDR
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#4B5563] hover:text-[#0F172A] transition-colors"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/auth"
            className="hidden sm:inline-flex h-10 items-center px-4 rounded-lg text-sm font-semibold text-[#0F172A] hover:bg-slate-100 transition-colors"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Já sou cliente
          </Link>
          <a
            href={DEFAULT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center px-4 sm:px-5 rounded-lg text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1fbb59] transition-colors shadow-sm"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Quero implementar
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg text-[#0F172A] hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-medium text-[#0F172A] hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/auth"
              className="px-3 py-2 rounded-md text-sm font-semibold text-[#0F172A] hover:bg-slate-100"
            >
              Já sou cliente
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
