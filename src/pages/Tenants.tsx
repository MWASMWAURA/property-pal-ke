import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Plus, MessageCircle, Phone, Users } from "lucide-react";
import { formatKsh } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { StatusPill } from "./Dashboard";
import { AddTenantDialog } from "@/components/dialogs/AddTenantDialog";

const Tenants = () => {
  const { tenants, properties } = useData();
  return (
    <AppShell title="Tenants" subtitle={`${tenants.length} active tenants across ${properties.length} properties`}>
      <Card className="p-4 mb-4 shadow-card border-border/60 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
          <Input placeholder="Search by name, unit, or phone…" className="pl-9"/>
        </div>
        <Button variant="outline"><Filter className="size-4"/> Filter</Button>
        <AddTenantDialog
          trigger={<Button data-tour="add-tenant" className="gradient-primary text-primary-foreground"><Plus className="size-4"/> Add Tenant</Button>}
        />
      </Card>

      {tenants.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Users className="size-6"/></div>
          <h3 className="font-bold text-lg mb-1">No tenants yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your first tenant to start tracking rent collection.</p>
          <AddTenantDialog trigger={<Button className="gradient-primary text-primary-foreground"><Plus className="size-4"/> Add your first tenant</Button>}/>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenants.map(t => (
            <Card key={t.id} className="p-5 shadow-card border-border/60 hover:shadow-card-lg transition-all">
              <div className="flex items-start gap-3 mb-4">
                <div className="size-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                  {t.name.split(" ").map(n=>n[0]).slice(0,2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{t.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{t.unit} · {t.property}</p>
                </div>
                <StatusPill status={t.status}/>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rent</div>
                  <div className="font-mono-num font-bold">{formatKsh(t.rent)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lease ends</div>
                  <div className="font-semibold">{t.leaseEnd}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1"><MessageCircle className="size-3.5"/> WhatsApp</Button>
                <Button size="sm" variant="outline" className="flex-1"><Phone className="size-3.5"/> Call</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
export default Tenants;
