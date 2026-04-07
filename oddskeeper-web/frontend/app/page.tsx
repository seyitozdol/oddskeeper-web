import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import PositioningStrip from "../components/landing/PositioningStrip";
import CapabilitiesSection from "../components/landing/CapabilitiesSection";
import WorkflowSection from "../components/landing/WorkflowSection";
import WhyItMattersSection from "../components/landing/WhyItMattersSection";
import WhoItsForSection from "../components/landing/WhoItsForSection";
import FinalCTASection from "../components/landing/FinalCTASection";
import Footer from "../components/landing/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <Navbar />
      <HeroSection />
      <PositioningStrip />
      <CapabilitiesSection />
      <WorkflowSection />
      <WhyItMattersSection />
      <WhoItsForSection />
      <FinalCTASection />
      <Footer />
    </main>
  );
}