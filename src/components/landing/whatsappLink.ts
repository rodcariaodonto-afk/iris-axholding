// WhatsApp helper for IRIS landing page
export const SUPPORT_WHATSAPP_NUMBER = "5511939171383";

export function buildWhatsAppUrl(message?: string): string {
  const text =
    message ??
    "Olá, quero implementar a IRIS Agente de IA na minha empresa. Pode me apresentar a plataforma?";
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const DEFAULT_WHATSAPP_URL = buildWhatsAppUrl();
