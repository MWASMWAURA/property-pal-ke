import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/AuthDialog";
import useEmblaCarousel from "embla-carousel-react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonials = [
  {
    name: "James Mwangi",
    role: "Landlord · Kileleshwa, Nairobi",
    units: "32 units",
    quote:
      "PropertyHub cut my rent collection time from 2 weeks to 3 days. Tenants love getting M-Pesa receipts on WhatsApp instantly.",
    initials: "JM",
  },
  {
    name: "Aisha Hassan",
    role: "Property Manager · Mombasa",
    units: "120 units",
    quote:
      "The WhatsApp bot handles 80% of tenant queries automatically. My phone finally stopped ringing at 10pm with balance questions.",
    initials: "AH",
  },
  {
    name: "Peter Kamau",
    role: "Landlord · Ruiru",
    units: "18 units",
    quote:
      "I used to chase rent in an Excel sheet. Now I see overdue balances the moment I open the app. Collection rate jumped to 97%.",
    initials: "PK",
  },
  {
    name: "Grace Wanjiru",
    role: "Real Estate Agent · Kisumu",
    units: "60 units",
    quote:
      "The maintenance Kanban changed everything. Vendors get tickets via WhatsApp and tenants stay updated automatically.",
    initials: "GW",
  },
  {
    name: "David Otieno",
    role: "Landlord · Westlands",
    units: "45 units",
    quote:
      "Owner reports I can WhatsApp to investors in one tap. PropertyHub feels like a fintech, not a property tool.",
    initials: "DO",
  },
];

const TestimonialsCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => {
      emblaApi.off("select", onSelect);
      clearInterval(interval);
    };
  }, [emblaApi]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="text-xs uppercase tracking-widest text-primary font-bold">Loved by landlords</div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">
          Trusted by landlords across Kenya
        </h2>
        <div className="mt-4 flex items-center justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="size-5 fill-accent text-accent" />
          ))}
          <span className="ml-2 text-sm text-muted-foreground font-semibold">4.9/5 from 200+ landlords</span>
        </div>
      </div>

      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {testimonials.map((t) => (
              <div key={t.name} className="flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%] min-w-0 px-3">
                <div className="h-full p-7 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg transition-shadow">
                  <Quote className="size-8 text-primary/20" />
                  <p className="mt-4 text-foreground leading-relaxed">"{t.quote}"</p>
                  <div className="mt-6 pt-6 border-t border-border flex items-center gap-3">
                    <div className="size-11 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                      {t.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                      {t.units}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="size-10 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`size-2 rounded-full transition-all ${
                  selected === i ? "bg-primary w-6" : "bg-border"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="size-10 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
import {
  Building2, MessageCircle, Receipt, Wrench, BarChart3, ShieldCheck,
  Sparkles, ArrowRight, CheckCircle2, Zap, Users, Bot, Smartphone,
} from "lucide-react";

const features = [
  { icon: Receipt, title: "Smart Collections", desc: "Auto-track rent, M-Pesa receipts, and overdue balances. Hit 95%+ collection rates." },
  { icon: Bot, title: "WhatsApp Bot", desc: "Tenants self-serve balances, receipts and complaints — 24/7, in their language." },
  { icon: Wrench, title: "Maintenance Kanban", desc: "Triaged tickets from chat to closure with vendor SLAs and photos." },
  { icon: BarChart3, title: "Owner Reports", desc: "P&L, occupancy and arrears insights you can WhatsApp to investors in one tap." },
  { icon: Users, title: "Tenant CRM", desc: "Lease timelines, payment history and chat transcripts in one tenant card." },
  { icon: ShieldCheck, title: "Built for Kenya", desc: "KSh, M-Pesa, county-aware. Bulk import existing tenants in minutes." },
];

const stats = [
  { v: "95%+", l: "Collection rate" },
  { v: "0%", l: "Vacancy loss" },
  { v: "24/7", l: "Tenant self-service" },
  { v: "10×", l: "Faster reporting" },
];

const steps = [
  { n: "01", t: "Onboard in 2 minutes", d: "Tell us about your portfolio. Bulk import tenants from CSV with column mapping." },
  { n: "02", t: "Connect WhatsApp", d: "Tenants message your number — the bot answers balances, receipts and complaints." },
  { n: "03", t: "Get paid faster", d: "Auto-reminders, M-Pesa reconciliation, and a hero overdue dashboard." },
];

const Landing = () => {
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
      {/* NAV */}
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
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button onClick={openLogin} variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign in
            </Button>
            <Button onClick={openRegister} size="sm" className="gradient-primary text-primary-foreground shadow-md">
              Get started <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 size-[500px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 size-[500px] rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold mb-6">
              <Sparkles className="size-3.5" /> Built for Kenyan landlords · WhatsApp-first
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Run your rentals like a <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">fintech.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Collect rent, automate WhatsApp replies, and resolve maintenance — all from one dashboard built for landlords managing 5 to 500 units.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={openRegister} size="lg" className="gradient-primary text-primary-foreground shadow-lg h-12 px-7 text-base">
                Get started free <ArrowRight className="size-5" />
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-7 text-base">
                <a href="#how">See how it works</a>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" /> No credit card</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" /> Demo data included</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" /> M-Pesa ready</div>
            </div>
          </div>

          {/* Hero mock */}
          <div className="relative">
            <div className="absolute inset-0 gradient-hero rounded-3xl rotate-2 opacity-90" />
            <div className="relative bg-card rounded-3xl shadow-2xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-muted/40">
                <div className="size-2.5 rounded-full bg-destructive/60" />
                <div className="size-2.5 rounded-full bg-accent/70" />
                <div className="size-2.5 rounded-full bg-success/70" />
                <div className="ml-3 text-xs text-muted-foreground font-mono">propertyhub.ke/app</div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3">
                <div className="col-span-2 p-4 rounded-2xl gradient-hero text-white">
                  <div className="text-[11px] uppercase tracking-widest opacity-80">Overdue this month</div>
                  <div className="text-3xl font-extrabold mt-1">KSh 142,500</div>
                  <div className="text-xs opacity-80 mt-1">8 tenants · 3 escalations</div>
                </div>
                <div className="p-4 rounded-xl bg-secondary">
                  <div className="text-xs text-muted-foreground">Collection</div>
                  <div className="text-2xl font-bold text-primary">96.4%</div>
                </div>
                <div className="p-4 rounded-xl bg-accent/15">
                  <div className="text-xs text-muted-foreground">Occupancy</div>
                  <div className="text-2xl font-bold text-foreground">98%</div>
                </div>
                <div className="col-span-2 p-3 rounded-xl border border-border flex items-center gap-3">
                  <div className="size-9 rounded-full bg-success/15 flex items-center justify-center">
                    <MessageCircle className="size-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Wanjiku replied via WhatsApp</div>
                    <div className="text-xs text-muted-foreground truncate">"Paid KSh 25,000 — MPESA QFG23..."</div>
                  </div>
                  <div className="text-[10px] text-success font-bold">AUTO ✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.l} className="text-center">
              <div className="text-3xl md:text-4xl font-extrabold text-primary">{s.v}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-primary font-bold">Everything you need</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">One platform. Every rental task.</h2>
          <p className="mt-4 text-muted-foreground">From the first tenant inquiry to the monthly P&L — PropertyHub handles it.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => (
            <div key={f.title} className="group p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="size-11 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shadow-md">
                <f.icon className="size-5" />
              </div>
              <div className="mt-4 font-bold text-lg">{f.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <TestimonialsCarousel />

      {/* HOW */}
      <section id="how" className="bg-muted/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-widest text-primary font-bold">How it works</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">Live on PropertyHub today.</h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {steps.map(s => (
              <div key={s.n} className="relative p-7 rounded-2xl bg-card border border-border">
                <div className="text-5xl font-extrabold text-primary/15">{s.n}</div>
                <div className="mt-2 text-xl font-bold">{s.t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
        <div className="rounded-3xl gradient-hero text-white p-10 lg:p-14 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-16 -bottom-16 size-64 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold opacity-80">Free forever for landlords with under 10 units</div>
              <h3 className="text-3xl lg:text-4xl font-extrabold mt-3">Start collecting smarter today.</h3>
              <p className="mt-3 opacity-90">Ship a working WhatsApp landlord workspace in under 5 minutes — no install, no card.</p>
            </div>
            <div className="lg:justify-self-end">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 h-14 px-8 text-base font-bold shadow-2xl">
                <Link to="/app">Get started <ArrowRight className="size-5" /></Link>
              </Button>
              <div className="text-xs opacity-80 mt-3 text-center lg:text-right">Demo data loads automatically.</div>
            </div>
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
              <a href="#features" className="hover:text-foreground">Features</a>
              <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground">Features</button>
              <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground">How it works</button>
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

export default Landing;
