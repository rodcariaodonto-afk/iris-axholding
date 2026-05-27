// WhatsApp helper for FCE landing page
export const SUPPORT_WHATSAPP_NUMBER = "5500000000000"; // TODO: substituir pelo número da Rosana

export function buildWhatsAppUrl(message?: string): string {
  const text =
    message ??
    "Olá, quero implementar a FCE Agente de IA na minha empresa. Pode me apresentar a plataforma?";
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const DEFAULT_WHATSAPP_URL = buildWhatsAppUrl();
