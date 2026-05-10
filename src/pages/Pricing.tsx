import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { tiers } from "@/lib/pricing-tiers";

const faqs = [
  { q: "Do I need a WhatsApp Business account?", a: "No — Starter uses our shared number. Growth and Scale plans onboard your own verified WhatsApp Business number." },
  { q: "How does M-Pesa reconciliation work?", a: "Tenants pay to your paybill or till. We match the reference and auto-issue a WhatsApp receipt within seconds." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no setup fees. Export your data any time as CSV." },
  { q: "Is my tenants' data safe?", a: "All data is encrypted in transit and at rest. We're compliant with Kenya's Data Protection Act, 2019." },
];

const Pricing = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot-password">("login");

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl gradient-gold flex items-center justify-center font-bold text-sidebar-primary-foreground">P</div>
            <div className="leading-tight">
              <div className="font-bold tracking-tight">PropertyHub</div>
              <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Kenya</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link to="/#features" className="hover:text-foreground">Features</Link>
            <Link to="/#how" className="hover:text-foreground">How it works</Link>
            <Link to="/pricing" className="text-foreground">Pricing</Link>
          </nav>
          <Button asChild size="sm" className="gradient-primary text-primary-foreground shadow-md">
                <Link to="/">Get started <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 size-[500px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 size-[500px] rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10 lg:pt-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold mb-6">
            <Sparkles className="size-3.5" /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Pricing that grows with your <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">portfolio</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free. Upgrade when you're ready. No hidden fees, no setup charges.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-3xl border p-8 flex flex-col ${
                t.highlight
                  ? "border-primary bg-card shadow-2xl scale-[1.02] gradient-hero text-white"
                  : "border-border bg-card"
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest">
                  Most popular
                </div>
              )}
              <div className={`text-sm font-semibold ${t.highlight ? "opacity-90" : "text-primary"}`}>{t.name}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <div className="text-4xl font-extrabold">{t.price}</div>
                {t.suffix && <div className={`text-sm ${t.highlight ? "opacity-80" : "text-muted-foreground"}`}>{t.suffix}</div>}
              </div>
              <p className={`mt-2 text-sm ${t.highlight ? "opacity-90" : "text-muted-foreground"}`}>{t.tagline}</p>

              <ul className="mt-6 space-y-3 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`size-4 mt-0.5 shrink-0 ${t.highlight ? "text-accent" : "text-success"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                className={`mt-8 ${t.highlight ? "bg-accent text-accent-foreground hover:bg-accent/90" : "gradient-primary text-primary-foreground"}`}
              >
                <Link to="/app">{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/40 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center">Frequently asked questions</h2>
          <div className="mt-12 grid sm:grid-cols-2 gap-6">
            {faqs.map((f) => (
              <div key={f.q} className="p-6 rounded-2xl bg-card border border-border">
                <div className="font-bold">{f.q}</div>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg gradient-gold flex items-center justify-center font-bold text-sidebar-primary-foreground text-xs">P</div>
            <span>© {new Date().getFullYear()} PropertyHub Kenya</span>
          </div>
            <div className="flex items-center gap-6">
              <Link to="/#features" className="hover:text-foreground">Features</Link>
              <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/#how" className="hover:text-foreground">How it works</Link>
              <button onClick={openLogin} className="hover:text-foreground">Open app</button>
            </div>
        </div>
      </footer>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </div>
  );
};

export default Pricing;