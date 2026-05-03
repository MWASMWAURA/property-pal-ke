import { useEffect, useState } from "react";
import { useData } from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, Sparkles } from "lucide-react";

type Step = {
  selector: string;
  title: string;
  body: string;
  route?: string;
};

const STEPS: Step[] = [
  { selector: "[data-tour='hero-kpis']",   title: "Hero KPIs",        body: "Overdue rent and vacancies are surfaced first — your daily money signal.", route: "/" },
  { selector: "[data-tour='revenue']",     title: "Revenue trend",    body: "Last 6 months of collected vs pending rent across your portfolio." },
  { selector: "[data-tour='collection']",  title: "Collection rate",  body: "Healthy target is 95%+. The donut shows paid, pending and overdue at a glance." },
  { selector: "[data-tour='whatsapp']",    title: "WhatsApp hub",     body: "Send bulk reminders to all overdue tenants in one tap." },
  { selector: "[data-tour='nav-properties']", title: "Properties",   body: "Manage every building and its occupancy here.", route: "/properties" },
  { selector: "[data-tour='add-property']", title: "Add a property", body: "Use this button to add your own buildings when you're ready." },
  { selector: "[data-tour='nav-tenants']", title: "Tenants",          body: "Search, message and review every tenant.", route: "/tenants" },
  { selector: "[data-tour='add-tenant']",  title: "Add a tenant",     body: "Capture name, unit and rent — it appears instantly in your tracker." },
];

export const TourGuide = () => {
  const { tourActive, stopTour, mode, resetToOwnData } = useData();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const navigate = useNavigate();

  const step = STEPS[idx];

  // Navigate when step changes route
  useEffect(() => {
    if (!tourActive) return;
    if (step?.route) navigate(step.route);
  }, [idx, tourActive]);

  // Find target & track its position
  useEffect(() => {
    if (!tourActive) return;
    let raf = 0;
    const update = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(update);
    };
    const t = setTimeout(update, 350);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [idx, tourActive, step]);

  if (!tourActive) return null;

  const finish = () => { stopTour(); setIdx(0); };
  const next = () => idx < STEPS.length - 1 ? setIdx(idx + 1) : null;
  const last = idx === STEPS.length - 1;

  // Tooltip placement
  const margin = 12;
  const tipW = 320;
  const tipH = 200;
  let top = rect ? rect.bottom + margin : window.innerHeight / 2 - tipH / 2;
  let left = rect ? rect.left : window.innerWidth / 2 - tipW / 2;
  if (rect && top + tipH > window.innerHeight - 20) top = Math.max(20, rect.top - tipH - margin);
  left = Math.min(Math.max(12, left), window.innerWidth - tipW - 12);

  const padding = 8;
  const highlight = rect ? {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  } : null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dim overlay using SVG mask for the cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={() => {}}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white"/>
            {highlight && (
              <rect
                x={highlight.left} y={highlight.top}
                width={highlight.width} height={highlight.height}
                rx={14} fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="hsl(165 25% 8% / 0.7)" mask="url(#tour-mask)"/>
        {highlight && (
          <rect
            x={highlight.left} y={highlight.top}
            width={highlight.width} height={highlight.height}
            rx={14} fill="none" stroke="hsl(var(--accent))" strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        className="absolute pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl p-5 w-[320px] animate-slide-up"
        style={{ top, left }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg gradient-gold flex items-center justify-center"><Sparkles className="size-3.5"/></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Demo tour · {idx + 1}/{STEPS.length}</span>
          </div>
          <button onClick={finish} className="text-muted-foreground hover:text-foreground"><X className="size-4"/></button>
        </div>
        <h3 className="font-bold text-base mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
          {!last ? (
            <Button size="sm" onClick={next} className="gradient-primary text-primary-foreground">
              Next <ArrowRight className="size-3.5"/>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={finish}>Keep exploring</Button>
              {mode === "demo" && (
                <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => { resetToOwnData(); finish(); navigate("/"); }}>
                  Use my own data
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
