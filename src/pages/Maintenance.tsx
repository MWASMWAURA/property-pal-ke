import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data-store";
import { StatusPill } from "./Dashboard";
import { Wrench, Clock, Plus, MessageSquareWarning } from "lucide-react";
import { RecordComplaintDialog } from "@/components/dialogs/RecordComplaintDialog";
import { toast } from "@/hooks/use-toast";

const Maintenance = () => {
  const { maintenance, complaints, updateComplaintStatus, updateMaintenanceStatus } = useData();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Merge demo maintenance + recorded complaints
  const merged = [
    ...maintenance.map(m => ({
      id: m.id, tenantName: m.tenant, unit: m.unit, category: m.category,
      description: m.description, priority: m.priority, status: m.status,
      created: m.created, source: "tenant" as const, type: "maintenance" as const,
    })),
    ...complaints.map(c => ({
      id: c.id, tenantName: c.tenantName, unit: c.unit, category: c.category,
      description: c.description, priority: c.priority, status: c.status,
      created: new Date(c.createdAt).toLocaleDateString("en-KE"), source: c.source, type: "complaint" as const,
    })),
  ];

  return (
    <AppShell title="Maintenance & Complaints" subtitle="Tenant-reported and landlord-logged tickets">
      <div className="flex justify-end mb-4">
        <RecordComplaintDialog trigger={
          <Button className="gradient-primary text-primary-foreground"><Plus className="size-4" /> Log complaint on behalf</Button>
        } />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(["pending", "in_progress", "resolved"] as const).map(col => (
          <div key={col}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{col.replace("_", " ")}</h3>
              <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-semibold">
                {merged.filter(m => m.status === col).length}
              </span>
            </div>
            <div className="space-y-3">
              {merged.filter(m => m.status === col).length === 0 && (
                <Card className="p-6 text-center text-xs text-muted-foreground border-dashed">No tickets here.</Card>
              )}
              {merged.filter(m => m.status === col).map(m => (
                <Card key={m.id} className="p-4 shadow-card border-border/60 hover:shadow-card-lg transition-all">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Wrench className="size-4" /></div>
                      <div>
                        <div className="font-semibold text-sm">{m.category}</div>
                        <div className="text-xs text-muted-foreground">Unit {m.unit}</div>
                      </div>
                    </div>
                    <StatusPill status={m.priority} />
                  </div>
                  <p className="text-sm text-foreground/80 my-3">{m.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="flex items-center gap-1.5">
                      {m.tenantName}
                      {m.source === "landlord" && <span className="text-[9px] bg-warning/15 text-warning px-1.5 py-0.5 rounded font-bold">VIA LANDLORD</span>}
                      {m.source === "tenant" && <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded font-bold">#{m.id.slice(-6).toUpperCase()}</span>}
                    </span>
                    <span className="flex items-center gap-1"><Clock className="size-3" />{m.created}</span>
                  </div>
                    {col !== "resolved" && (
                      <Button
                        size="sm"
                        className="w-full mt-3 gradient-primary text-primary-foreground"
                        disabled={updatingIds.has(m.id)}
                        onClick={async () => {
                          setUpdatingIds(prev => new Set(prev).add(m.id));
                          try {
                            const newStatus = col === "pending" ? "in_progress" : "resolved";
                            if (m.type === "complaint") {
                              await updateComplaintStatus(m.id, newStatus);
                              toast({
                                title: "Status updated",
                                description: `Complaint ${newStatus === "in_progress" ? "assigned to contractor" : "marked as resolved"}`,
                              });
                            } else if (m.type === "maintenance") {
                              updateMaintenanceStatus(m.id, newStatus);
                              toast({
                                title: "Status updated",
                                description: `Maintenance ${newStatus === "in_progress" ? "assigned to contractor" : "marked as resolved"}`,
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Update failed",
                              description: "Failed to update status. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setUpdatingIds(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(m.id);
                              return newSet;
                            });
                          }
                        }}
                      >
                       <MessageSquareWarning className="size-3.5" /> {updatingIds.has(m.id) ? "Updating..." : (col === "pending" ? "Assign contractor" : "Mark resolved")}
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
};
export default Maintenance;
