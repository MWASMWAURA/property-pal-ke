import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data-store";
import { Building2, MapPin, Plus, ArrowUpRight } from "lucide-react";
import { AddPropertyDialog } from "@/components/dialogs/AddPropertyDialog";

const Properties = () => {
  const navigate = useNavigate();
  const { properties, tenants } = useData();
  return (
    <AppShell title="Properties" subtitle={`${properties.length} buildings · ${properties.reduce((s,p)=>s + (typeof p.units === 'number' ? p.units : p.unitNames?.length || 0),0)} total units`}>
      <div className="flex justify-end mb-4">
        <AddPropertyDialog
          trigger={
            <Button data-tour="add-property" className="gradient-primary text-primary-foreground"><Plus className="size-4"/> Add Property</Button>
          }
        />
      </div>
      {properties.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Building2 className="size-6"/></div>
          <h3 className="font-bold text-lg mb-1">No properties yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your first building to start tracking units, occupancy and rent.</p>
          <AddPropertyDialog trigger={<Button className="gradient-primary text-primary-foreground"><Plus className="size-4"/> Add your first property</Button>}/>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map(p => {
            const occupied = tenants.filter(t => t.property === p.name).length;
            const unitsCount = typeof p.units === 'number' ? p.units : p.unitNames?.length || 0;
            const occ = unitsCount ? (occupied / unitsCount) * 100 : 0;
            const vacant = unitsCount - occupied;
            return (
              <Card key={p.id} className="overflow-hidden shadow-card border-border/60 group hover:shadow-card-lg transition-all">
                <div className="h-32 gradient-hero relative">
                  <div className="absolute inset-0 bg-black/10"/>
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest opacity-80">Occupancy</div>
                      <div className="text-3xl font-bold font-mono-num">{occ.toFixed(0)}%</div>
                    </div>
                    <Building2 className="size-10 opacity-50"/>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg">{p.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-4"><MapPin className="size-3"/>{p.location}</p>
                   <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <Stat label="Total" value={unitsCount}/>
                     <Stat label="Occupied" value={occupied} accent="text-success"/>
                     <Stat label="Vacant" value={vacant} accent={vacant ? "text-destructive" : "text-muted-foreground"}/>
                   </div>
                   <Button variant="outline" className="w-full" onClick={() => navigate(`/properties/${p.id}/units`)}>View units <ArrowUpRight className="size-3.5"/></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
};

const Stat = ({label, value, accent = "text-foreground"}: { label: string; value: number; accent?: string }) => (
  <div className="rounded-lg bg-muted/40 py-2.5">
    <div className={`font-mono-num font-bold text-lg ${accent}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

export default Properties;
