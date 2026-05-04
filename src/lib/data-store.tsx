import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import {
  properties as seedProperties,
  tenants as seedTenants,
  maintenance as seedMaintenance,
  messages as seedMessages,
  revenueByMonth as seedRevenue,
  collectionDonut as seedDonut,
  formatKsh,
  TenantStatus,
} from "./mock-data";

export type Property = (typeof seedProperties)[number];
export type Tenant = (typeof seedTenants)[number];

export type Payment = {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  period: string;          // e.g. "May 2026"
  method: string;          // M-Pesa, Bank, Cash
  reference?: string;
  paidAt: string;          // ISO
};

export type Complaint = {
  id: string;
  tenantId: string;
  tenantName: string;
  unit: string;
  property: string;
  category: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "resolved";
  source: "tenant" | "landlord";
  createdAt: string;       // ISO
};

export type AppNotification = {
  id: string;
  type: "complaint" | "maintenance" | "payment" | "whatsapp" | "system";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type WaMessage = {
  id: string;
  tenantId: string;
  direction: "in" | "out";
  body: string;
  timestamp: string;
  channel: "bot" | "landlord";
};

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

  payments: Payment[];
  complaints: Complaint[];
  notifications: AppNotification[];
  waMessages: WaMessage[];

  leaseFilterDays: number;            // dashboard expiry filter
  setLeaseFilterDays: (d: number) => void;
  expiringTenants: (days?: number) => Tenant[];

  addTenant: (t: Omit<Tenant, "id">) => Tenant;
  addTenantsBulk: (rows: Omit<Tenant, "id">[]) => number;
  addProperty: (p: Omit<Property, "id">) => void;
  saveProfile: (p: LandlordProfile) => void;

  recordPayment: (p: Omit<Payment, "id" | "paidAt"> & { paidAt?: string }) => void;
  recordComplaint: (input: {
    tenantId: string;
    category: string;
    description: string;
    priority?: Complaint["priority"];
    source?: Complaint["source"];
    notify?: boolean;
  }) => Complaint;

  sendWhatsApp: (tenantId: string, body: string, channel?: WaMessage["channel"]) => void;
  simulateInbound: (tenantId: string, body: string) => void;

  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;

  startDemo: () => void;
  startFresh: () => void;
  resetToOwnData: () => void;

  needsOnboarding: boolean;
  setNeedsOnboarding: (v: boolean) => void;
  tourActive: boolean;
  startTour: () => void;
  stopTour: () => void;
};

const DataCtx = createContext<Ctx | null>(null);
const KEY = "propertyhub:state:v2";

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

const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Parse dd/mm/yyyy → Date
const parseDMY = (s: string): Date | null => {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<Mode>("unset");
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [leaseFilterDays, setLeaseFilterDays] = useState(30);

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
        setPayments(s.payments ?? []);
        setComplaints(s.complaints ?? []);
        setNotifications(s.notifications ?? []);
        setWaMessages(s.waMessages ?? []);
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
      JSON.stringify({ mode, profile, properties, tenants, payments, complaints, notifications, waMessages })
    );
  }, [mode, profile, properties, tenants, payments, complaints, notifications, waMessages]);

  const pushNotification = useCallback((n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications(prev => [{ ...n, id: uid("n"), createdAt: new Date().toISOString(), read: false }, ...prev]);
  }, []);

  const startDemo = () => {
    setProperties(seedProperties);
    setTenants(seedTenants);
    setPayments([]);
    setComplaints([]);
    setNotifications([
      { id: uid("n"), type: "system", title: "Welcome to the demo", body: "Sample Nairobi tenants pre-loaded.", createdAt: new Date().toISOString(), read: false },
    ]);
    setWaMessages([]);
    setMode("demo");
    setNeedsOnboarding(false);
    setTimeout(() => setTourActive(true), 400);
  };

  const startFresh = () => {
    setProperties([]); setTenants([]); setPayments([]); setComplaints([]);
    setNotifications([]); setWaMessages([]);
    setMode("live"); setNeedsOnboarding(false);
  };

  const resetToOwnData = () => {
    setProperties([]); setTenants([]); setPayments([]); setComplaints([]);
    setNotifications([]); setWaMessages([]);
    setMode("live"); setTourActive(false);
  };

  const saveProfile = (p: LandlordProfile) => setProfile(p);

  const addTenant: Ctx["addTenant"] = (t) => {
    const tenant = { ...t, id: uid("t") } as Tenant;
    setTenants(prev => [tenant, ...prev]);
    return tenant;
  };

  const addTenantsBulk: Ctx["addTenantsBulk"] = (rows) => {
    const mapped = rows.map(r => ({ ...r, id: uid("t") } as Tenant));
    setTenants(prev => [...mapped, ...prev]);
    return mapped.length;
  };

  const addProperty: Ctx["addProperty"] = (p) =>
    setProperties(prev => [{ ...p, id: uid("p") } as Property, ...prev]);

  const recordPayment: Ctx["recordPayment"] = (p) => {
    const tenant = tenants.find(t => t.id === p.tenantId);
    const payment: Payment = {
      id: uid("pay"),
      paidAt: p.paidAt ?? new Date().toISOString(),
      ...p,
    };
    setPayments(prev => [payment, ...prev]);
    // mark tenant as paid
    setTenants(prev => prev.map(t => t.id === p.tenantId ? { ...t, status: "paid" as TenantStatus } : t));
    pushNotification({
      type: "payment",
      title: "Payment recorded",
      body: `${formatKsh(p.amount)} from ${p.tenantName} (${p.period})`,
    });
    if (tenant?.phone) {
      const body = `✅ *Payment Confirmed!*\n\nAmount: ${formatKsh(p.amount)}\nPeriod: ${p.period}\nDate: ${new Date(payment.paidAt).toLocaleDateString("en-KE")}\n\nThank you for your payment!`;
      _appendWa(p.tenantId, "out", body, "bot");
    }
  };

  // helper that doesn't depend on closure ordering
  const _appendWa = (tenantId: string, direction: WaMessage["direction"], body: string, channel: WaMessage["channel"]) => {
    setWaMessages(prev => [...prev, { id: uid("wa"), tenantId, direction, body, timestamp: new Date().toISOString(), channel }]);
  };

  const sendWhatsApp: Ctx["sendWhatsApp"] = (tenantId, body, channel = "landlord") => {
    _appendWa(tenantId, "out", body, channel);
  };

  const recordComplaint: Ctx["recordComplaint"] = ({ tenantId, category, description, priority = "medium", source = "tenant", notify = true }) => {
    const tenant = tenants.find(t => t.id === tenantId);
    const c: Complaint = {
      id: uid("c"),
      tenantId,
      tenantName: tenant?.name ?? "Unknown",
      unit: tenant?.unit ?? "—",
      property: tenant?.property ?? "—",
      category, description, priority, status: "pending", source,
      createdAt: new Date().toISOString(),
    };
    setComplaints(prev => [c, ...prev]);
    pushNotification({
      type: "complaint",
      title: source === "landlord" ? "Complaint logged on tenant's behalf" : "New tenant complaint",
      body: `${tenant?.name ?? "Tenant"} · ${category}: ${description.slice(0, 70)}`,
    });
    if (notify && tenant) {
      const ref = c.id.slice(-6).toUpperCase();
      const body = source === "landlord"
        ? `📝 *Complaint logged on your behalf*\n\nReference: #${ref}\nCategory: ${category}\nDetails: ${description}\n\nWe will address this shortly. Reply MENU for options.`
        : `✅ Complaint logged.\n\nReference: #${ref}\nStatus: Pending\n\nWe will address this as soon as possible.`;
      _appendWa(tenantId, "out", body, "bot");
    }
    return c;
  };

  // ---- Bot logic mirroring server ----
  const botProcess = useCallback((tenant: Tenant | undefined, raw: string): string => {
    const msg = raw.trim();
    const upper = msg.toUpperCase();
    const [cmd, ...rest] = upper.split(/\s+/);
    const args = rest.join(" ");
    const argsRaw = msg.split(/\s+/).slice(1).join(" ");

    if (!tenant) {
      return "⚠️ Your phone number is not registered. Contact your landlord to be added as a tenant.";
    }

    if (["MENU", "HELP", "START"].includes(cmd) || !cmd) {
      return [
        "🏠 *PropertyHub Kenya*",
        "",
        "💰 BALANCE — your rent balance",
        "🧾 RECEIPT — recent payments",
        "📝 COMPLAINT <issue> — file a complaint",
        "🔧 MAINTENANCE <request> — repairs",
        "🏡 RELOCATE <preference> — transfer unit",
        "💳 PAY — payment instructions",
        "ℹ️ INFO — your account details",
      ].join("\n");
    }

    if (["BALANCE", "BAL"].includes(cmd)) {
      const tPays = payments.filter(p => p.tenantId === tenant.id);
      const paid = tPays.reduce((s, p) => s + p.amount, 0);
      const due = tenant.status === "paid" ? 0 : tenant.rent;
      return `📊 *Balance for ${tenant.name}*\n\nTotal Paid: ${formatKsh(paid)}\nCurrent Due: ${formatKsh(due)}\nStatus: ${tenant.status.toUpperCase()}\n\n${due > 0 ? `Send PAY for M-Pesa instructions.` : "✅ Account up to date."}`;
    }

    if (["RECEIPT", "RECEIPTS"].includes(cmd)) {
      const tPays = payments.filter(p => p.tenantId === tenant.id).slice(0, 3);
      if (tPays.length === 0) return "📭 No receipts found yet.";
      return "🧾 *Recent Receipts*\n\n" + tPays.map((p, i) =>
        `${i + 1}. ${formatKsh(p.amount)} — ${p.period} (${new Date(p.paidAt).toLocaleDateString("en-KE")})`
      ).join("\n");
    }

    if (["COMPLAINT", "COMPLAIN"].includes(cmd)) {
      if (!argsRaw) return "📝 Send: COMPLAINT <description>\nExample: COMPLAINT Water leaking in kitchen";
      recordComplaint({ tenantId: tenant.id, category: "General", description: argsRaw, priority: "medium", source: "tenant", notify: false });
      return `✅ Complaint logged. We'll get back to you shortly.`;
    }

    if (["MAINTENANCE", "MAINTAIN", "FIX", "RENOVATE"].includes(cmd)) {
      if (!argsRaw) return "🔧 Send: MAINTENANCE <description>";
      recordComplaint({ tenantId: tenant.id, category: "Maintenance", description: argsRaw, priority: "medium", source: "tenant", notify: false });
      return `✅ Maintenance request submitted.`;
    }

    if (["RELOCATE", "MOVE", "TRANSFER"].includes(cmd)) {
      if (!argsRaw) return "🏡 Send: RELOCATE <preference>\nExample: RELOCATE 2 bedroom apartment";
      recordComplaint({ tenantId: tenant.id, category: "Relocation", description: argsRaw, priority: "low", source: "tenant", notify: false });
      return `✅ Relocation request received. We'll check availability.`;
    }

    if (["PAY", "PAYMENT"].includes(cmd)) {
      const due = tenant.status === "paid" ? 0 : tenant.rent;
      return `💳 *Payment Information*\n\nPaybill: 247247\nAccount: ${tenant.name}\nAmount Due: ${formatKsh(due)}\n\nM-Pesa → Paybill → enter details above.`;
    }

    if (["INFO", "DETAILS"].includes(cmd)) {
      return `ℹ️ *Your Account*\n\nName: ${tenant.name}\nPhone: ${tenant.phone}\nProperty: ${tenant.property}\nUnit: ${tenant.unit}\nLease ends: ${tenant.leaseEnd}`;
    }

    return `Unrecognized command. Send *MENU* to see options.`;
  }, [payments, recordComplaint]);

  const simulateInbound: Ctx["simulateInbound"] = (tenantId, body) => {
    const tenant = tenants.find(t => t.id === tenantId);
    _appendWa(tenantId, "in", body, "bot");
    const reply = botProcess(tenant, body);
    setTimeout(() => _appendWa(tenantId, "out", reply, "bot"), 450);
  };

  const expiringTenants = useCallback((days = leaseFilterDays) => {
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86400000);
    return tenants.filter(t => {
      const d = parseDMY(t.leaseEnd);
      return d && d >= now && d <= limit;
    });
  }, [tenants, leaseFilterDays]);

  const markAllNotificationsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const markNotificationRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const value = useMemo<Ctx>(() => {
    const isDemo = mode === "demo";
    return {
      mode, profile, properties, tenants,
      maintenance: isDemo ? seedMaintenance : [],
      messages: isDemo ? seedMessages : [],
      revenueByMonth: isDemo ? seedRevenue : emptyRevenue,
      collectionDonut: isDemo
        ? seedDonut
        : [
            { name: "Collected", value: tenants.filter(t => t.status === "paid").reduce((s, t) => s + t.rent, 0), color: "hsl(var(--success))" },
            { name: "Pending", value: tenants.filter(t => t.status === "pending").reduce((s, t) => s + t.rent, 0), color: "hsl(var(--warning))" },
            { name: "Overdue", value: tenants.filter(t => t.status === "overdue").reduce((s, t) => s + t.rent, 0), color: "hsl(var(--destructive))" },
          ],
      payments, complaints, notifications, waMessages,
      leaseFilterDays, setLeaseFilterDays, expiringTenants,
      addTenant, addTenantsBulk, addProperty, saveProfile,
      recordPayment, recordComplaint,
      sendWhatsApp, simulateInbound,
      markAllNotificationsRead, markNotificationRead,
      startDemo, startFresh, resetToOwnData,
      needsOnboarding, setNeedsOnboarding,
      tourActive, startTour: () => setTourActive(true), stopTour: () => setTourActive(false),
    };
  }, [mode, profile, properties, tenants, payments, complaints, notifications, waMessages, leaseFilterDays, needsOnboarding, tourActive, expiringTenants, botProcess]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
};

export type { TenantStatus };
