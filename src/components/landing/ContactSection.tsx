import { MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DEFAULT_WHATSAPP_URL } from "./whatsappLink";

export default function ContactSection() {
  return (
    <section id="contato" className="py-20 bg-gradient-to-br from-[#0F172A] via-[#0B1220] to-[#0F172A] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-[#e50789]">
          Comece agora
        </span>
        <h2
          className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold"
          style={{ fontFamily: "Plus Jakarta Sans" }}
        >
          Pronto para colocar uma{" "}
          <span className="bg-gradient-to-r from-[#e50789] to-[#8f1b3f] bg-clip-text text-transparent">
            Agente SDR de IA
          </span>{" "}
          trabalhando no seu WhatsApp?
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
          Fale com a equipe FCE e tenha sua operação comercial inteligente rodando em poucos dias.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={DEFAULT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center px-6 rounded-lg bg-[#25D366] text-white font-semibold hover:bg-[#1fbb59] shadow-lg transition-colors"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Quero implementar a FCE
          </a>
          <Link
            to="/auth"
            className="inline-flex h-12 items-center justify-center px-6 rounded-lg border-2 border-white/20 text-white font-semibold hover:bg-white/5 transition-colors"
            style={{ fontFamily: "Plus Jakarta Sans" }}
          >
            Acessar plataforma
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>
    </section>
  );
}
