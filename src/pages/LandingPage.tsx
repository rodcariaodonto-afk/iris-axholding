import { useEffect } from "react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import ProofSection from "@/components/landing/ProofSection";
import TransformSection from "@/components/landing/TransformSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";
import ContactSection from "@/components/landing/ContactSection";
import LandingFooter from "@/components/landing/LandingFooter";
import WhatsAppFAB from "@/components/landing/WhatsAppFAB";

export default function LandingPage() {
  useEffect(() => {
    document.title = "FCE Agente de IA SDR — Atendimento e Vendas pelo WhatsApp";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Transforme conversas do WhatsApp em oportunidades comerciais com a FCE, uma agente de IA SDR para atender, qualificar e organizar leads."
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0F172A]" style={{ fontFamily: "Inter, sans-serif" }}>
      <LandingHeader />
      <main>
        <LandingHero />
        <ProofSection />
        <TransformSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <FaqSection />
        <ContactSection />
      </main>
      <LandingFooter />
      <WhatsAppFAB />
    </div>
  );
}
