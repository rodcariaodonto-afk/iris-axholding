import { MessageCircle } from "lucide-react";
import { DEFAULT_WHATSAPP_URL } from "./whatsappLink";

export default function WhatsAppFAB() {
  return (
    <a
      href={DEFAULT_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      title="Quero implementar a IRIS"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl hover:bg-[#1fbb59] hover:scale-105 transition-all"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
