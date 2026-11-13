import { useEffect, useRef } from "react";
import Nav from "./landing/Nav";
import Hero from "./landing/Hero";
import { Statement, Features, HowItWorks } from "./landing/Story";
import { FinanceShowcase, MealShowcase, ChatShowcase, FinalCta, Footer } from "./landing/Showcases";
import { useRevealAll } from "./landing/motion";
import "../styles/landing.css";

export default function Landing() {
  const root = useRef(null);
  useRevealAll(root);
  // Arriving from another page via /#section: jump to that section.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []);
  return (
    <div className="lp" ref={root}>
      <a href="#main" className="sr-only">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <Statement />
        <Features />
        <HowItWorks />
        <FinanceShowcase />
        <MealShowcase />
        <ChatShowcase />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
