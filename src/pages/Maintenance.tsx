import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { maintenance } from "@/lib/mock-data";
import { StatusPill } from "./Dashboard";
import { Wrench, Clock } from "lucide-react";

const Maintenance = () => (
  <AppShell title="Maintenance" subtitle="Tenant complaints & repair requests">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {(["pending","in_progress","resolved"] as const).map(col => (
        <div key={col}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{col.replace("_"," ")}</h3>
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-semibold">
              {maintenance.filter(m=>m.status===col).length}
            </span>
          </div>
          <div className="space-y-3">
            {maintenance.filter(m => m.status===col).map(m => (
              <Card key={m.id} className="p-4 shadow-card border-border/60 hover:shadow-card-lg transition-all">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Wrench className="size-4"/></div>
                    <div>
                      <div className="font-semibold text-sm">{m.category}</div>
                      <div className="text-xs text-muted-foreground">Unit {m.unit}</div>
                    </div>
                  </div>
                  <StatusPill status={m.priority}/>
                </div>
                <p className="text-sm text-foreground/80 my-3">{m.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span>{m.tenant}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3"/>{m.created}</span>
                </div>
                {col !== "resolved" && (
                  <Button size="sm" className="w-full mt-3 gradient-primary text-primary-foreground">
                    {col === "pending" ? "Assign contractor" : "Mark resolved"}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  </AppShell>
);
export default Maintenance;
