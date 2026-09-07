import { Header } from "@/components/landing/header"
import { HeroSection } from "@/components/landing/hero-section"
import { AuthorSection } from "@/components/landing/author-section"
import { CTAFooterSection } from "@/components/landing/cta-footer-section"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <AuthorSection />
      <CTAFooterSection />
    </main>
  )
}
