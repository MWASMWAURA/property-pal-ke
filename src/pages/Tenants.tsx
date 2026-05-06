import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MessageCircle, Phone, Users, Upload, CalendarClock } from "lucide-react";
import { formatKsh } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { StatusPill } from "./Dashboard";
import { AddTenantDialog } from "@/components/dialogs/AddTenantDialog";
import { BulkImportDialog } from "@/components/dialogs/BulkImportDialog";
import { TenantDetailDialog } from "@/components/dialogs/TenantDetailDialog";

const parseDMY = (s: string) => {
  const m = s?.match?.(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
};

const Tenants = () => {
  const { tenants, properties } = useData();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "overdue">("all");
  const [expiry, setExpiry] = useState<0 | 30 | 60 | 90>(0);

  const filtered = useMemo(() => {
    const now = new Date();
    return tenants.filter(t => {
      if (status !== "all" && t.status !== status) return false;
      if (q && !`${t.name} ${t.unit} ${t.property} ${t.phone}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (expiry > 0) {
        const d = parseDMY(t.leaseEnd);
        if (!d) return false;
        const diff = (d.getTime() - now.getTime()) / 86400000;
        if (diff < 0 || diff > expiry) return false;
      }
      return true;
    });
  }, [tenants, q, status, expiry]);

  return (
    <AppShell title="Tenants" subtitle={`${tenants.length} active tenants across ${properties.length} properties`}>
      <Card className="p-4 mb-4 shadow-card border-border/60 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search by name, unit, phone…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value as any)} className="text-sm bg-muted/40 border border-border rounded-md px-3 py-2">
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={expiry} onChange={e => setExpiry(+e.target.value as any)} className="text-sm bg-muted/40 border border-border rounded-md px-3 py-2">
          <option value={0}>All leases</option>
          <option value={30}>Expiring in 30 days</option>
          <option value={60}>Expiring in 60 days</option>
          <option value={90}>Expiring in 90 days</option>
        </select>
        <BulkImportDialog trigger={<Button variant="outline"><Upload className="size-4" /> Bulk Import</Button>} />
        <AddTenantDialog trigger={<Button data-tour="add-tenant" className="gradient-primary text-primary-foreground"><Plus className="size-4" /> Add Tenant</Button>} />
      </Card>

      {tenants.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Users className="size-6" /></div>
          <h3 className="font-bold text-lg mb-1">No tenants yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add a tenant manually or bulk import from a CSV.</p>
          <div className="flex justify-center gap-2">
            <BulkImportDialog trigger={<Button variant="outline"><Upload className="size-4" /> Bulk import</Button>} />
            <AddTenantDialog trigger={<Button className="gradient-primary text-primary-foreground"><Plus className="size-4" /> Add tenant</Button>} />
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No tenants match your filters.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => {
            const leaseDate = parseDMY(t.leaseEnd);
            const daysToExpiry = leaseDate ? Math.round((leaseDate.getTime() - Date.now()) / 86400000) : null;
            return (
              <TenantDetailDialog key={t.id} tenantId={t.id} trigger={
                <Card className="p-5 shadow-card border-border/60 hover:shadow-card-lg transition-all cursor-pointer text-left">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="size-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                      {t.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{t.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{t.unit} · {t.property}</p>
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rent</div>
                      <div className="font-mono-num font-bold">{formatKsh(t.rent)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3" />Lease ends</div>
                      <div className="font-semibold">
                        {t.leaseEnd}
                        {daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30 && (
                          <span className="ml-1 text-[10px] font-bold text-destructive">{daysToExpiry}d</span>
                        )}
                      </div>
                    </div>
                  </div>
                   <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                     <Button size="sm" variant="outline" className="flex-1" onClick={() => t.phone && window.open(`https://wa.me/${t.phone.replace(/\s+/g, '')}`, '_blank')} disabled={!t.phone}><MessageCircle className="size-3.5" /> WhatsApp</Button>
                     <Button size="sm" variant="outline" className="flex-1" onClick={() => t.phone && window.open(`tel:${t.phone}`)} disabled={!t.phone}><Phone className="size-3.5" /> Call</Button>
                   </div>
                </Card>
              } />
            );
          })}
        </div>
      )}
    </AppShell>
  );
};
export default Tenants;
