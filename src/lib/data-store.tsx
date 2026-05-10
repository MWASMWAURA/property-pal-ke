import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { api } from "./api";
import {
  properties as seedProperties,
  tenants as seedTenants,
  maintenance as seedMaintenance,
  payments as seedPayments,
  messages as seedMessages,
  revenueByMonth as seedRevenue,
  collectionDonut as seedDonut,
  formatKsh,
  TenantStatus,
} from "./mock-data";

export type Property = (typeof seedProperties)[number] & { unitNames: string[] };
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
  status: "paid" | "pending" | "overdue";
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



type Mode = "demo" | "live" | "unset";

export type LandlordProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  preferredChannel: "whatsapp" | "sms" | "email";
  collectionMonthStart: number;
};

type Ctx = {
  mode: Mode;
  profile: LandlordProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;
  addProperty: (p: Omit<Property, "id">) => void;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  deleteUnit: (propertyId: string, unitName: string) => boolean;
  saveProfile: (p: LandlordProfile) => void;

  recordPayment: (p: Omit<Payment, "id" | "paidAt"> & { paidAt?: string }) => void;
  recordComplaint: (input: {
    tenantId: string;
    category: string;
    description: string;
    priority?: Complaint["priority"];
    source?: Complaint["source"];
    notify?: boolean;
  }) => Promise<Complaint>;
  updateComplaintStatus: (id: string, status: Complaint["status"]) => void;

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

  // Authentication methods
  register: (data: { name: string; email: string; phone?: string; company?: string; city?: string; password: string; preferredChannel?: string; collectionMonthStart?: number }) => Promise<{ landlord: LandlordProfile; token: string }>;
  login: (email: string, password: string) => Promise<{ landlord: LandlordProfile; token: string }>;
  logout: () => void;
  loadProfile: () => Promise<void>;
};

const DataCtx = createContext<Ctx | null>(null);
const KEY = "propertyhub:state:v2";
const USER_DATA_KEY = "propertyhub:user-data:v1";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<typeof seedMaintenance>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [leaseFilterDays, setLeaseFilterDays] = useState(30);

  // Authentication methods (inside component so they can access state setters)
  const register = async (data: Parameters<Ctx["register"]>[0]): Promise<ReturnType<Ctx["register"]>> => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    // Store token and profile
    localStorage.setItem('auth_token', result.token);
    setProfile(result.landlord);
    setIsAuthenticated(true);
    setMode('live');
    setNeedsOnboarding(true);

    return result;
  };

  const login = async (email: string, password: string): Promise<ReturnType<Ctx["login"]>> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    // Store token and profile
    localStorage.setItem('auth_token', result.token);
    setProfile(result.landlord);
    setIsAuthenticated(true);
    setMode('live');
    setNeedsOnboarding(false);

    return result;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setProfile(null);
    setIsAuthenticated(false);
    setMode('unset');
    setProperties([]);
    setTenants([]);
    setPayments([]);
    setComplaints([]);
    setNotifications([]);
    setWaMessages([]);
  };

  const loadProfile = async (): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();

      if (response.ok) {
        setProfile(result);
        setIsAuthenticated(true);
        setMode('live');
      } else {
        // Token invalid, clear it
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load authentication and profile
  useEffect(() => {
    loadProfile();
  }, []);

  // Hydrate other data (only after authentication)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const loadData = async () => {
      try {
        // Try to load from server first
        const serverProperties = await api.fetchProperties();
        const serverTenants = await api.fetchTenants();
        const serverPayments = await api.fetchPayments();

        console.log('✅ Loaded data from database:', {
          properties: serverProperties.length,
          tenants: serverTenants.length,
          payments: serverPayments.length
        });
          // Ensure properties have unitNames
          const propertiesWithUnitNames = serverProperties.map((p: any) => ({
            ...p,
            unitNames: p.unitNames || Array.from({ length: p.units }, (_, i) => `Unit ${i + 1}`)
          }));
          setProperties(propertiesWithUnitNames);
          setTenants(serverTenants);
          setPayments(serverPayments);
          // Save to localStorage as backup
          localStorage.setItem(KEY, JSON.stringify({
            properties: propertiesWithUnitNames,
            tenants: serverTenants,
            payments: serverPayments,
            maintenance: [],
            complaints: [],
            notifications: [],
            waMessages: []
          }));
      } catch (error) {
        console.error('Failed to load data from database, using local data:', error);
        // Fall back to localStorage
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          // Ensure properties have unitNames
          const propertiesWithUnitNames = (s.properties ?? []).map((p: any) => ({
            ...p,
            unitNames: p.unitNames || Array.from({ length: p.units }, (_, i) => `Unit ${i + 1}`)
          }));
          setProperties(propertiesWithUnitNames);
          setTenants(s.tenants ?? []);
          setPayments(s.payments ?? []);
          setMaintenance(s.maintenance ?? []);
          setComplaints(s.complaints ?? []);
          setNotifications(s.notifications ?? []);
          setWaMessages(s.waMessages ?? []);
        } else {
          console.log('ℹ️ No local data found, starting with empty state');
          setProperties([]);
          setTenants([]);
          setPayments([]);
          setMaintenance([]);
          setComplaints([]);
          setNotifications([]);
          setWaMessages([]);
        }
      } catch (error) {
        console.error('Failed to load data from database, using local data:', error);
        // Fall back to localStorage
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          // Ensure properties have unitNames
          const propertiesWithUnitNames = (s.properties ?? []).map((p: any) => ({
            ...p,
            unitNames: p.unitNames || Array.from({ length: p.units }, (_, i) => `Unit ${i + 1}`)
          }));
          setProperties(propertiesWithUnitNames);
          setTenants(s.tenants ?? []);
          setPayments(s.payments ?? []);
          setMaintenance(s.maintenance ?? []);
          setComplaints(s.complaints ?? []);
          setNotifications(s.notifications ?? []);
          setWaMessages(s.waMessages ?? []);
        } else {
          console.log('ℹ️ No local data found, starting with empty state');
          setProperties([]);
          setTenants([]);
          setPayments([]);
          setMaintenance([]);
          setComplaints([]);
          setNotifications([]);
          setWaMessages([]);
        }
      }
    };

    loadData();
  }, [isAuthenticated, isLoading]);

  // Persist
  useEffect(() => {
    if (mode === "unset") return;
    localStorage.setItem(
      KEY,
      JSON.stringify({ mode, profile, properties, tenants, payments, complaints, notifications, waMessages })
    );
  }, [mode, profile, properties, tenants, payments, complaints, notifications, waMessages]);

  // Add this inside DataProvider, after the hydration useEffect
  useEffect(() => {
    if (mode === 'unset') return;

    const poll = async () => {
      try {
        const serverNotifs = await api.getNotifications();
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newOnes = serverNotifs
            .filter((n: any) => !existingIds.has(n.id))
            .map((n: any) => ({
              id: n.id,
              type: n.type as AppNotification['type'],
              title: n.title,
              body: n.body,
              createdAt: n.created_at,
              read: n.read,
            }));
          return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
        });
      } catch {
        // Server offline — silent fail, local data still works
      }
    };

    poll(); // run once immediately
    const interval = setInterval(poll, 15000); // then every 15 seconds
    return () => clearInterval(interval);
  }, [mode]);

  // Poll for complaints from server
  useEffect(() => {
    if (mode === 'unset') return;

    const pollComplaints = async () => {
      try {
        const serverComplaints = await api.getComplaints();
        console.log('Polled complaints from server:', serverComplaints.length);
        setComplaints(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newOnes = serverComplaints
            .filter((c: any) => !existingIds.has(c.id))
            .map((c: any) => ({
              id: c.id,
              tenantId: c.tenant_id,
              tenantName: c.tenant_name,
              unit: c.unit,
              property: c.property,
              category: c.category,
              description: c.description,
              priority: c.priority as Complaint['priority'],
              status: c.status as Complaint['status'],
              source: c.source as Complaint['source'],
              createdAt: c.created_at,
            }));
          if (newOnes.length > 0) {
            console.log('Added new complaints:', newOnes.length);
          }
          return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
        });
      } catch (error) {
        console.warn('Failed to poll complaints from server:', error);
        // Server offline — silent fail, local data still works
      }
    };

    pollComplaints(); // run once immediately
    const interval = setInterval(pollComplaints, 5000); // poll every 5 seconds for faster updates
    return () => clearInterval(interval);
  }, [mode]);

  const pushNotification = useCallback((n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications(prev => [{ ...n, id: uid("n"), createdAt: new Date().toISOString(), read: false }, ...prev]);
  }, []);

  const startDemo = () => {
    // Backup current user data before switching to demo
    const currentData = {
      properties, tenants, payments, maintenance, complaints, notifications, waMessages, profile
    };
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(currentData));

    if (!profile) {
      setProfile({
        name: "James Kariuki",
        email: "james.kariuki@demo.com",
        phone: "+254 712 345 678",
        company: "Demo Properties Ltd",
        city: "Nairobi",
        preferredChannel: "whatsapp",
        collectionMonthStart: 1,
      });
    }
    setProperties(seedProperties);
    setTenants(seedTenants);
    setMaintenance(seedMaintenance);
    setPayments(seedPayments);
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
    // Clear any backed up user data since we're starting fresh
    localStorage.removeItem(USER_DATA_KEY);
    setProperties([]); setTenants([]); setMaintenance([]); setPayments([]); setComplaints([]);
    setNotifications([]); setWaMessages([]);
    setMode("live"); setNeedsOnboarding(false);
  };

  const resetToOwnData = () => {
    // Restore user data from backup
    try {
      const userDataRaw = localStorage.getItem(USER_DATA_KEY);
      if (userDataRaw) {
        const userData = JSON.parse(userDataRaw);
        setProperties(userData.properties || []);
        setTenants(userData.tenants || []);
        setPayments(userData.payments || []);
        setMaintenance(userData.maintenance || []);
        setComplaints(userData.complaints || []);
        setNotifications(userData.notifications || []);
        setWaMessages(userData.waMessages || []);
        if (userData.profile) setProfile(userData.profile);
      }
    } catch (e) {
      console.warn('Failed to restore user data:', e);
      // Fallback to empty state
      setProperties([]); setTenants([]); setMaintenance([]); setPayments([]); setComplaints([]);
      setNotifications([]); setWaMessages([]);
    }
    setMode("live"); setTourActive(false);
  };

  const saveProfile = async (p: LandlordProfile) => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(p),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setProfile(p);
    } catch (error) {
      console.error('Failed to save profile:', error);
      // Still update local state for offline functionality
      setProfile(p);
    }
  };

  // Helper function for auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  const addTenant: Ctx["addTenant"] = (t) => {
    const tenant = { ...t, id: uid("t"), createdAt: new Date().toISOString() } as Tenant;
    setTenants(prev => [tenant, ...prev]);

    // If tenant is added with "paid" status, create a payment record
    if (t.status === "paid") {
      const payment: Payment = {
        id: uid("pay"),
        tenantId: tenant.id,
        tenantName: tenant.name,
        amount: tenant.rent,
        period: "Initial Payment", // Or current period
        method: tenant.method,
        reference: `INIT-${tenant.id.slice(-6).toUpperCase()}`,
        paidAt: new Date().toISOString(),
        status: "paid",
        createdAt: new Date().toISOString(),
      };
      setPayments(prev => [payment, ...prev]);

      // Sync payment to server
      api.syncPayment({ ...payment }).catch(e => console.warn('Payment sync failed', e));

      pushNotification({
        type: "payment",
        title: "Initial payment recorded",
        body: `${formatKsh(payment.amount)} from ${payment.tenantName} (${payment.period})`,
      });
    }

    // Update property occupancy and unitNames
    const property = properties.find(p => p.name === t.property);
    if (property) {
      const updates: Partial<Property> = { occupied: property.occupied + 1 };

      // Check if this unit name already exists
      if (!property.unitNames.includes(t.unit)) {
        // Find vacant unit names (unitNames that don't have tenants)
        const occupiedUnits = tenants.filter(tn => tn.property === t.property).map(tn => tn.unit);
        const vacantUnitNames = property.unitNames.filter(name => !occupiedUnits.includes(name));

        if (vacantUnitNames.length > 0) {
          // Replace a vacant unit name with the new one (rename operation)
          const indexToReplace = property.unitNames.indexOf(vacantUnitNames[0]);
          const newUnitNames = [...property.unitNames];
          newUnitNames[indexToReplace] = t.unit;
          updates.unitNames = newUnitNames;
        } else {
          // Add new unit name and increment count
          updates.unitNames = [...property.unitNames, t.unit];
          updates.units = property.units + 1;
        }
      }

      updateProperty(property.id, updates);
    }

    // Sync to server so WhatsApp bot can look up by phone
    api.syncTenant(tenant).catch(e => console.warn('Tenant sync failed', e));

    return tenant;
  };

  const addTenantsBulk: Ctx["addTenantsBulk"] = (rows) => {
    const mapped = rows.map(r => ({ ...r, id: uid("t") } as Tenant));
    setTenants(prev => [...mapped, ...prev]);

    // Sync all tenants to server so WhatsApp bot can look up by phone
    mapped.forEach(tenant => {
      api.syncTenant(tenant).catch(e => console.warn('Tenant sync failed', e));
    });

    return mapped.length;
  };

  const addProperty: Ctx["addProperty"] = (p) =>
    setProperties(prev => [{ ...p, id: uid("p") } as Property, ...prev]);

  const updateProperty: Ctx["updateProperty"] = (id, updates) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateTenant: Ctx["updateTenant"] = (id, updates) => {
    setTenants(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        // Sync updated tenant to server so WhatsApp bot can look up by phone
        api.syncTenant(updated).catch(e => console.warn('Tenant update sync failed', e));
        return updated;
      }
      return t;
    }));
  };

  const deleteTenant: Ctx["deleteTenant"] = (id) => {
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return;

    // Remove tenant and all associated data
    setTenants(prev => prev.filter(t => t.id !== id));
    setPayments(prev => prev.filter(p => p.tenantId !== id));
    setComplaints(prev => prev.filter(c => c.tenantId !== id));
    setWaMessages(prev => prev.filter(m => m.tenantId !== id));

    // Update property occupied count
    const property = properties.find(p => p.name === tenant.property);
    if (property) {
      updateProperty(property.id, { occupied: Math.max(0, property.occupied - 1) });
    }
  };

  const deleteUnit: Ctx["deleteUnit"] = (propertyId, unitName) => {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return false;

    // Check if unit has a tenant
    const hasTenant = tenants.some(t => t.property === property.name && t.unit === unitName);
    if (hasTenant) return false; // Cannot delete occupied unit

    // Unit is vacant, decrement unit count and remove from unitNames
    updateProperty(propertyId, {
      units: Math.max(0, property.units - 1),
      unitNames: property.unitNames.filter(name => name !== unitName)
    });
    return true;
  };

  const recordPayment: Ctx["recordPayment"] = async (p) => {
    const tenant = tenants.find(t => t.id === p.tenantId);
    const payment: Payment = {
      id: uid("pay"),
      paidAt: p.paidAt ?? new Date().toISOString(),
      status: "paid",
      ...p,
    };

    // Update payments first
    setPayments(prev => {
      const newPayments = [payment, ...prev];

      // Then update tenant status based on total payments vs rent
      setTenants(prevTenants => prevTenants.map(t => {
        if (t.id === p.tenantId) {
          // Calculate total paid for this tenant (including new payment)
          const tenantPayments = newPayments.filter(pay => pay.tenantId === t.id);
          const totalPaid = tenantPayments.reduce((sum, pay) => sum + pay.amount, 0);

          // Update status based on payment progress
          let newStatus: TenantStatus;
          if (totalPaid >= t.rent) {
            newStatus = "paid";
          } else if (t.status === "overdue") {
            newStatus = "overdue"; // Keep overdue status
          } else {
            newStatus = "pending";
          }

          // Sync updated tenant to server
          const updatedTenant = { ...t, status: newStatus };
          api.syncTenant(updatedTenant).catch(e => console.warn('Tenant status sync failed', e));

          return updatedTenant;
        }
        return t;
      }));

      return newPayments;
    });
    pushNotification({
      type: "payment",
      title: "Payment recorded",
      body: `${formatKsh(p.amount)} from ${p.tenantName} (${p.period})`,
    });

    // Sync to server — server sends the real WhatsApp receipt
    try {
      await api.syncPayment({ ...payment });
    } catch (e) {
      console.warn('Server sync failed, continuing locally', e);
    }

    // Keep local WA thread updated for the Messages page
    if (tenant?.phone) {
      const totalPaid = payments.filter(pay => pay.tenantId === tenant.id).reduce((sum, pay) => sum + pay.amount, 0) + p.amount;
      const overpayment = Math.max(0, totalPaid - tenant.rent);
      const body = `✅ *Payment Confirmed!*\n\nAmount: ${formatKsh(p.amount)}\nPeriod: ${p.period}\nDate: ${new Date(payment.paidAt).toLocaleDateString("en-KE")}\n${overpayment > 0 ? `💰 Overpayment: ${formatKsh(overpayment)} (credited to next period)\n` : ''}\nThank you for your payment!`;
      _appendWa(p.tenantId, "out", body, "bot");
    }
  };

  // helper that doesn't depend on closure ordering
  const _appendWa = (tenantId: string, direction: WaMessage["direction"], body: string, channel: WaMessage["channel"]) => {
    setWaMessages(prev => [...prev, { id: uid("wa"), tenantId, direction, body, timestamp: new Date().toISOString(), channel }]);
  };

  const sendWhatsApp: Ctx["sendWhatsApp"] = async (tenantId, body, channel = "landlord") => {
    _appendWa(tenantId, "out", body, channel);

    // Send real WhatsApp via server
    try {
      await api.sendWhatsApp(tenantId, body, 'out', channel);
    } catch (e) {
      console.warn('WhatsApp send failed, message saved locally', e);
    }
  };

  const recordComplaint: Ctx["recordComplaint"] = async ({ tenantId, category, description, priority = "medium", source = "tenant", notify = true }) => {
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
      // Send actual WhatsApp message and add to local state
      await sendWhatsApp(tenantId, body, "bot");
    }
    return c;
  };

  const updateComplaintStatus: Ctx["updateComplaintStatus"] = async (id, status) => {
    try {
      await api.updateComplaintStatus(id, status);
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch (error) {
      console.error('Failed to update complaint status:', error);
      // Still update local state for offline functionality
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    }
  };

  const updateMaintenanceStatus = (id: string, status: typeof seedMaintenance[number]["status"]) => {
    setMaintenance(prev => prev.map(m => m.id === id ? { ...m, status } : m));
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

  // Calculate collection donut data based on tenant balances
  const calculateCollectionDonut = useCallback(() => {
    return tenants.reduce((acc, tenant) => {
      // Calculate total paid for this tenant (only paid payments)
      const tenantPayments = payments.filter(p => p.tenantId === tenant.id && p.status === "paid");
      const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.max(0, tenant.rent - totalPaid);

      // Add only paid amounts to collected
      acc[0].value += totalPaid;

      // Add outstanding balances to appropriate categories
      if (outstanding > 0) {
        if (tenant.status === "overdue") {
          acc[2].value += outstanding; // Overdue
        } else {
          acc[1].value += outstanding; // Pending
        }
      }

      return acc;
    }, [
      { name: "Collected", value: 0, color: "hsl(var(--success))" },
      { name: "Pending", value: 0, color: "hsl(var(--warning))" },
      { name: "Overdue", value: 0, color: "hsl(var(--destructive))" },
    ]);
  }, [tenants, payments]);

  // Calculate revenue by custom month periods based on collectionMonthStart
  const calculateRevenueByMonth = useCallback(() => {
    const monthStart = profile?.collectionMonthStart || 1;
    const revenueMap = new Map<string, { collected: number; pending: number }>();

    // Generate last 6 months (showing current and past 5) - always show bars even with zero data
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      revenueMap.set(monthKey, { collected: 0, pending: 0 });
    }

    // Calculate collected from paid payments
    payments.filter(p => p.status === 'paid').forEach(payment => {
      const paymentDate = new Date(payment.paidAt);
      const paymentYear = paymentDate.getFullYear();
      const paymentMonth = paymentDate.getMonth(); // 0-based
      const paymentDay = paymentDate.getDate();

      // Determine which collection period this payment belongs to
      let collectionMonth = paymentMonth;
      let collectionYear = paymentYear;

      if (paymentDay < monthStart) {
        // Payment is before the collection start date, so it belongs to previous month's collection
        collectionMonth = paymentMonth - 1;
        if (collectionMonth < 0) {
          collectionMonth = 11;
          collectionYear = paymentYear - 1;
        }
      }

      const monthKey = new Date(collectionYear, collectionMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (revenueMap.has(monthKey)) {
        revenueMap.get(monthKey)!.collected += payment.amount;
      }
    });

    // For pending amounts, show expected revenue for current/future months
    const currentDate = new Date();
    const totalMonthlyRent = tenants.reduce((sum, t) => sum + t.rent, 0);

    revenueMap.forEach((data, monthKey) => {
      const [monthName, yearStr] = monthKey.split(' ');
      const monthDate = new Date(`${monthName} 1, ${yearStr}`);
      const isCurrentOrFuture = monthDate >= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      if (isCurrentOrFuture) {
        // For current and future periods, pending = total expected - collected
        data.pending = Math.max(0, totalMonthlyRent - data.collected);
      } else {
        // For past periods, pending = 0 (historical)
        data.pending = 0;
      }
    });

    // Convert to array format, sorted by date (oldest first)
    return Array.from(revenueMap.entries())
      .map(([month, data]) => ({ month, collected: data.collected, pending: data.pending }))
      .sort((a, b) => {
        const [monthA, yearA] = a.month.split(' ');
        const [monthB, yearB] = b.month.split(' ');
        const dateA = new Date(`${monthA} 1, ${yearA}`);
        const dateB = new Date(`${monthB} 1, ${yearB}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [payments, profile?.collectionMonthStart]);

  const value = useMemo<Ctx>(() => {
    const isDemo = mode === "demo";
    return {
      mode, profile, isAuthenticated, isLoading, properties, tenants,
      maintenance,
  messages: isDemo ? seedMessages : [],
  revenueByMonth: isDemo ? seedRevenue : calculateRevenueByMonth(),
  collectionDonut: isDemo
    ? seedDonut
    : calculateCollectionDonut(),
      payments, complaints, notifications, waMessages,
      leaseFilterDays, setLeaseFilterDays, expiringTenants,
      addTenant, addTenantsBulk, updateTenant, deleteTenant, addProperty, updateProperty, deleteUnit, saveProfile,
      recordPayment, recordComplaint, updateComplaintStatus, updateMaintenanceStatus,
      sendWhatsApp, simulateInbound,
      markAllNotificationsRead, markNotificationRead,
      startDemo, startFresh, resetToOwnData,
      needsOnboarding, setNeedsOnboarding,
      tourActive, startTour: () => setTourActive(true), stopTour: () => setTourActive(false),
      register, login, logout, loadProfile,
    };
  }, [mode, profile, isAuthenticated, isLoading, properties, tenants, payments, complaints, notifications, waMessages, leaseFilterDays, needsOnboarding, tourActive, expiringTenants, botProcess, calculateRevenueByMonth, calculateCollectionDonut]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
};

export type { TenantStatus };
