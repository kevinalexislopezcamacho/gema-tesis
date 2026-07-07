import { Header } from "@/components/landing/header"
import { HeroSection } from "@/components/landing/hero-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { LearningPathSection } from "@/components/landing/learning-path-section"
import { CTASection } from "@/components/landing/cta-section"
import { Footer } from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <section id="como-funciona">
        <HowItWorksSection />
      </section>
      <section id="features">
        <FeaturesSection />
      </section>
      <section id="modules">
        <LearningPathSection />
      </section>
      <CTASection />
      <Footer />
    </main>
  )
}
