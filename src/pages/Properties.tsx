import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { properties } from "@/lib/mock-data";
import { Building2, MapPin, Plus, ArrowUpRight } from "lucide-react";

const Properties = () => (
  <AppShell title="Properties" subtitle={`${properties.length} buildings · ${properties.reduce((s,p)=>s+p.units,0)} total units`}>
    <div className="flex justify-end mb-4">
      <Button className="gradient-primary text-primary-foreground"><Plus className="size-4"/> Add Property</Button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {properties.map(p => {
        const occ = (p.occupied / p.units) * 100;
        const vacant = p.units - p.occupied;
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
                <Stat label="Total" value={p.units}/>
                <Stat label="Occupied" value={p.occupied} accent="text-success"/>
                <Stat label="Vacant" value={vacant} accent={vacant ? "text-destructive" : "text-muted-foreground"}/>
              </div>
              <Button variant="outline" className="w-full">View units <ArrowUpRight className="size-3.5"/></Button>
            </div>
          </Card>
        );
      })}
    </div>
  </AppShell>
);

const Stat = ({label, value, accent="text-foreground"}:any) => (
  <div className="rounded-lg bg-muted/40 py-2.5">
    <div className={`font-mono-num font-bold text-lg ${accent}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

export default Properties;
