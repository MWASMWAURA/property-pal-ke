import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  properties as seedProperties,
  tenants as seedTenants,
  maintenance as seedMaintenance,
  messages as seedMessages,
  revenueByMonth as seedRevenue,
  collectionDonut as seedDonut,
  TenantStatus,
} from "./mock-data";

export type Property = (typeof seedProperties)[number];
export type Tenant = (typeof seedTenants)[number];

export type LandlordProfile = {
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  preferredChannel: "whatsapp" | "sms" | "email";
};

type Mode = "demo" | "live" | "unset";

type Ctx = {
  mode: Mode;
  profile: LandlordProfile | null;
  properties: Property[];
  tenants: Tenant[];
  maintenance: typeof seedMaintenance;
  messages: typeof seedMessages;
  revenueByMonth: typeof seedRevenue;
  collectionDonut: typeof seedDonut;
  addTenant: (t: Omit<Tenant, "id">) => void;
  addProperty: (p: Omit<Property, "id">) => void;
  saveProfile: (p: LandlordProfile) => void;
  startDemo: () => void;
  startFresh: () => void;
  resetToOwnData: () => void;
  // Onboarding & tour
  needsOnboarding: boolean;
  setNeedsOnboarding: (v: boolean) => void;
  tourActive: boolean;
  startTour: () => void;
  stopTour: () => void;
};

const DataCtx = createContext<Ctx | null>(null);
const KEY = "propertyhub:state:v1";

const emptyRevenue = [
  { month: "Nov", collected: 0, pending: 0 },
  { month: "Dec", collected: 0, pending: 0 },
  { month: "Jan", collected: 0, pending: 0 },
  { month: "Feb", collected: 0, pending: 0 },
  { month: "Mar", collected: 0, pending: 0 },
  { month: "Apr", collected: 0, pending: 0 },
];

const emptyDonut = [
  { name: "Collected", value: 0, color: "hsl(var(--success))" },
  { name: "Pending", value: 0, color: "hsl(var(--warning))" },
  { name: "Overdue", value: 0, color: "hsl(var(--destructive))" },
];

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<Mode>("unset");
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  // Hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setMode(s.mode ?? "unset");
        setProfile(s.profile ?? null);
        setProperties(s.properties ?? []);
        setTenants(s.tenants ?? []);
        if (s.mode === "unset" || !s.profile) setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(true);
      }
    } catch {
      setNeedsOnboarding(true);
    }
  }, []);

  // Persist
  useEffect(() => {
    if (mode === "unset") return;
    localStorage.setItem(
      KEY,
      JSON.stringify({ mode, profile, properties, tenants })
    );
  }, [mode, profile, properties, tenants]);

  const startDemo = () => {
    setProperties(seedProperties);
    setTenants(seedTenants);
    setMode("demo");
    setNeedsOnboarding(false);
    setTimeout(() => setTourActive(true), 400);
  };

  const startFresh = () => {
    setProperties([]);
    setTenants([]);
    setMode("live");
    setNeedsOnboarding(false);
  };

  const resetToOwnData = () => {
    setProperties([]);
    setTenants([]);
    setMode("live");
    setTourActive(false);
  };

  const saveProfile = (p: LandlordProfile) => setProfile(p);

  const addTenant: Ctx["addTenant"] = (t) =>
    setTenants((prev) => [{ ...t, id: `t${Date.now()}` }, ...prev]);

  const addProperty: Ctx["addProperty"] = (p) =>
    setProperties((prev) => [{ ...p, id: `p${Date.now()}` }, ...prev]);

  // Derived figures – use seed data for demo, otherwise compute
  const value = useMemo<Ctx>(() => {
    const isDemo = mode === "demo";
    return {
      mode,
      profile,
      properties,
      tenants,
      maintenance: isDemo ? seedMaintenance : [],
      messages: isDemo ? seedMessages : [],
      revenueByMonth: isDemo ? seedRevenue : emptyRevenue,
      collectionDonut: isDemo
        ? seedDonut
        : [
            { name: "Collected", value: tenants.filter(t => t.status === "paid").reduce((s,t)=>s+t.rent,0), color: "hsl(var(--success))" },
            { name: "Pending",   value: tenants.filter(t => t.status === "pending").reduce((s,t)=>s+t.rent,0), color: "hsl(var(--warning))" },
            { name: "Overdue",   value: tenants.filter(t => t.status === "overdue").reduce((s,t)=>s+t.rent,0), color: "hsl(var(--destructive))" },
          ],
      addTenant,
      addProperty,
      saveProfile,
      startDemo,
      startFresh,
      resetToOwnData,
      needsOnboarding,
      setNeedsOnboarding,
      tourActive,
      startTour: () => setTourActive(true),
      stopTour: () => setTourActive(false),
    };
  }, [mode, profile, properties, tenants, needsOnboarding, tourActive]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
};

export type { TenantStatus };
