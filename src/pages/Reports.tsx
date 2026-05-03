import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileBarChart, TrendingUp, Home, Receipt, Wrench } from "lucide-react";

const reports = [
  { icon: Receipt, name: "Collections Report", desc: "Monthly rent collections by property", color: "text-success bg-success/10" },
  { icon: Home, name: "Occupancy Report", desc: "Vacancy trends & turnover", color: "text-info bg-info/10" },
  { icon: TrendingUp, name: "Revenue Statement", desc: "P&L by property · year-to-date", color: "text-primary bg-primary/10" },
  { icon: Wrench, name: "Maintenance Log", desc: "All tickets, costs & resolution times", color: "text-warning bg-warning/10" },
  { icon: FileBarChart, name: "Tenant Aging Report", desc: "Days outstanding by tenant", color: "text-destructive bg-destructive/10" },
  { icon: Receipt, name: "Bank Reconciliation", desc: "M-Pesa & bank deposits matched", color: "text-accent-foreground bg-accent/20" },
];

const Reports = () => (
  <AppShell title="Reports" subtitle="Audit-ready exports for accounting & compliance">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {reports.map(r => (
        <Card key={r.name} className="p-5 shadow-card border-border/60 hover:shadow-card-lg transition-all group">
          <div className={`size-12 rounded-xl flex items-center justify-center mb-4 ${r.color}`}>
            <r.icon className="size-6"/>
          </div>
          <h3 className="font-bold mb-1">{r.name}</h3>
          <p className="text-sm text-muted-foreground mb-4">{r.desc}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1">Preview</Button>
            <Button size="sm" className="gradient-primary text-primary-foreground flex-1"><Download className="size-3.5"/> Export</Button>
          </div>
        </Card>
      ))}
    </div>
  </AppShell>
);
export default Reports;
