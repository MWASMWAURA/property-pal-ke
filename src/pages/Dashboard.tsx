import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, AlertTriangle, Home, CalendarClock, Wrench, ArrowUpRight, MessageCircle, Send, Download, Sparkles, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKsh } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const navigate = useNavigate();
  const { tenants, properties, maintenance, revenueByMonth, collectionDonut, mode, startTour, resetToOwnData, leaseFilterDays, setLeaseFilterDays, expiringTenants, profile } = useData();

  const overdueTenants = tenants.filter(t => t.status === "overdue");
  const overdueAmount = overdueTenants.reduce((s, t) => s + t.rent, 0);
  const totalUnits = properties.reduce((s, p) => s + p.units, 0);
  const occupiedUnits = tenants.length;
  const vacantUnits = totalUnits - occupiedUnits;
  const urgentMaint = maintenance.filter(m => m.status !== "resolved").length;
  const expiring = expiringTenants();
  const expiringLeases = expiring.length;
  const collectedTotal = collectionDonut.reduce((s, d) => s + d.value, 0);
  const collected = collectionDonut.find(d => d.name === "Collected")?.value ?? 0;
  const rate = collectedTotal > 0 ? (collected / collectedTotal) * 100 : 0;

  return (
    <AppShell
      title={`Habari, ${profile?.name?.split(' ')[0] || "Landlord"} 👋`}
      subtitle={`${new Date().toLocaleDateString("en-KE", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Here's your portfolio at a glance`}
    >
      {mode === "demo" && (
        <Card className="p-3 sm:p-4 mb-4 border-accent/40 bg-accent/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="size-9 rounded-lg gradient-gold flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-primary"/>
          </div>
          <div className="flex-1 text-sm">
            <div className="font-bold">You're exploring the demo</div>
            <div className="text-xs text-muted-foreground">Sample Nairobi properties pre-loaded. Restart the tour or switch to your own data anytime.</div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button size="sm" variant="outline" onClick={startTour}><Sparkles className="size-3.5"/> Restart tour</Button>
            <Button size="sm" className="gradient-primary text-primary-foreground" onClick={resetToOwnData}><RefreshCw className="size-3.5"/> Use my data</Button>
          </div>
        </Card>
      )}

      {/* HERO KPI BAND */}
      <section data-tour="hero-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-slide-up">
        <KpiCard
          urgent
          icon={<AlertTriangle className="size-5" />}
          label="Overdue"
          value={formatKsh(overdueAmount)}
          sub={`${overdueTenants.length} tenants behind`}
          action={<Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur touch-manipulation min-h-[44px] px-3 sm:px-4"><MessageCircle className="size-4 sm:size-3.5"/> <span className="hidden xs:inline">Chase via WhatsApp</span><span className="xs:hidden">Chase</span></Button>}
        />
        <KpiCard
          icon={<Home className="size-5" />}
          label="Vacant Units"
          value={`${vacantUnits}`}
          sub={`of ${totalUnits} total · ${totalUnits ? ((vacantUnits/totalUnits)*100).toFixed(1) : "0"}% vacancy`}
          trend={mode === "demo" ? "-2 vs last month" : undefined}
          trendUp
        />
        <KpiCard
          icon={<CalendarClock className="size-5" />}
          label={`Expiring Leases (${leaseFilterDays}d)`}
          value={`${expiringLeases}`}
          sub={expiring.slice(0,2).map(t => t.name).join(", ") || "None in window"}
          action={
            <select
              value={leaseFilterDays}
              onChange={e => setLeaseFilterDays(+e.target.value)}
              className="text-[11px] bg-muted/60 border border-border rounded px-2 py-1 font-semibold cursor-pointer"
            >
              {[7,14,30,60,90,180].map(d => <option key={d} value={d}>Next {d} days</option>)}
            </select>
          }
        />
        <KpiCard
          icon={<Wrench className="size-5" />}
          label="Urgent Maintenance"
          value={`${urgentMaint}`}
          sub={`${maintenance.filter(m=>m.priority==='urgent').length} marked urgent`}
          trend="Action needed"
        />
      </section>

      {/* CHARTS ROW */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card data-tour="revenue" className="lg:col-span-2 p-5 sm:p-6 shadow-card border-border/60">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-bold text-lg">Revenue Trend</h2>
              <p className="text-xs text-muted-foreground">Last 6 months · KSh</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono-num">{formatKsh(collected)}</div>
              <div className="flex items-center gap-1 text-xs text-success font-semibold justify-end">
                <TrendingUp className="size-3.5"/> {mode === "demo" ? "+12.4% YoY" : "Live"}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart key={revenueByMonth.map(d => `${d.month}-${d.collected}-${d.pending}`).join('|')} data={revenueByMonth} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} axisLine={false} tickLine={false}/>
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v)=>`${(v/1000000).toFixed(1)}M`}/>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => formatKsh(v)}
              />
              <Bar dataKey="collected" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              <Bar dataKey="pending" fill="hsl(var(--accent))" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card data-tour="collection" className="p-5 sm:p-6 shadow-card border-border/60 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-bold text-lg">Collection Rate</h2>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
            <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 font-semibold">{rate.toFixed(1)}%</Badge>
          </div>
          <div className="relative mx-auto w-full" style={{ maxWidth: 180, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={collectionDonut} dataKey="value" innerRadius={48} outerRadius={66} paddingAngle={3} stroke="none">
                  {collectionDonut.map((d) => <Cell key={d.name} fill={d.color}/>)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-base font-bold font-mono-num leading-tight">{formatKsh(collected)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</div>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {collectionDonut.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{background: d.color}}/>{d.name}</div>
                <span className="font-mono-num font-semibold">{formatKsh(d.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* COLLECTIONS TABLE + QUICK ACTIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-card border-border/60 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="font-bold text-lg">Collection Tracker</h2>
              <p className="text-xs text-muted-foreground">Recent rent payments & overdue accounts</p>
            </div>
            <Link to="/collections" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="size-3"/>
            </Link>
          </div>
          <div className="overflow-x-auto">
            {tenants.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No tenants yet — add your first tenant to start tracking collections.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Tenant</th>
                    <th className="text-left font-semibold px-5 py-3 hidden sm:table-cell">Unit</th>
                    <th className="text-right font-semibold px-5 py-3">Rent</th>
                    <th className="text-left font-semibold px-5 py-3 hidden md:table-cell">Method</th>
                    <th className="text-left font-semibold px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.slice(0,6).map(t => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{t.unit} · {t.property}</div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <div className="font-medium">{t.unit}</div>
                        <div className="text-xs text-muted-foreground">{t.property}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-num font-semibold">{formatKsh(t.rent)}</td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{t.method}</td>
                      <td className="px-5 py-3.5"><StatusPill status={t.status}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card data-tour="whatsapp" className="p-5 shadow-card border-border/60 gradient-hero text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"/>
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="size-4"/>
                <span className="text-xs uppercase tracking-widest font-semibold opacity-90">WhatsApp Hub</span>
              </div>
              <h3 className="font-bold text-xl mb-1">Bulk Reminders</h3>
              <p className="text-sm opacity-80 mb-4">Send rent reminders to all overdue tenants in one tap.</p>
              <Button className="bg-white text-primary hover:bg-white/90 font-semibold w-full">
                <Send className="size-4"/> Send to {overdueTenants.length} overdue
              </Button>
            </div>
          </Card>

          <Card className="p-5 shadow-card border-border/60">
            <h3 className="font-bold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <QuickAction icon={<Download className="size-4"/>} label="Import from Excel" sub="Bulk upload payments" onClick={() => navigate('/collections?import=bulk')}/>
              <QuickAction icon={<Wrench className="size-4"/>} label="Triage maintenance" sub={`${urgentMaint} pending tickets`} accent onClick={() => navigate('/maintenance')}/>
              <QuickAction icon={<CalendarClock className="size-4"/>} label="Send renewal notices" sub={`${expiringLeases} leases expiring`} onClick={() => navigate('/messages')}/>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
};

const KpiCard = ({ icon, label, value, sub, trend, trendUp, urgent, action }: { icon: React.ReactNode; label: string; value: string | number; sub: string; trend?: string; trendUp?: boolean; urgent?: boolean; action?: React.ReactNode }) => (
  <Card className={cn(
    "p-4 sm:p-5 shadow-card border-border/60 relative overflow-hidden transition-all hover:shadow-card-lg",
    urgent && "gradient-danger text-white border-0"
  )}>
    {urgent && <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10 blur-xl"/>}
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("size-9 rounded-xl flex items-center justify-center",
          urgent ? "bg-white/20" : "bg-primary/10 text-primary")}>{icon}</div>
        {trend && !urgent && (
          <span className={cn("text-[10px] font-semibold flex items-center gap-0.5", trendUp ? "text-success" : "text-muted-foreground")}>
            {trendUp && <TrendingDown className="size-3"/>}{trend}
          </span>
        )}
      </div>
      <div className={cn("text-[11px] uppercase tracking-wider font-semibold mb-1", urgent ? "text-white/80" : "text-muted-foreground")}>{label}</div>
      <div className="text-2xl sm:text-3xl font-bold font-mono-num leading-none mb-1">{value}</div>
      <div className={cn("text-xs", urgent ? "text-white/80" : "text-muted-foreground")}>{sub}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  </Card>
);

export const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    overdue: "bg-destructive/15 text-destructive",
    urgent: "bg-destructive/15 text-destructive",
    high: "bg-warning/15 text-warning",
    medium: "bg-info/15 text-info",
    low: "bg-muted text-muted-foreground",
    in_progress: "bg-info/15 text-info",
    resolved: "bg-success/15 text-success",
  };
  const labels: Record<string,string> = { in_progress: "In progress" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize", map[status] || "bg-muted")}>
      <span className="size-1.5 rounded-full bg-current"/>
      {labels[status] || status}
    </span>
  );
};

const QuickAction = ({ icon, label, sub, accent, onClick }: { icon: React.ReactNode; label: string; sub: string; accent?: boolean; onClick?: () => void }) => (
  <button onClick={onClick} className={cn(
    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-muted/40",
    accent ? "border-accent/40 bg-accent/5" : "border-border"
  )}>
    <div className={cn("size-9 rounded-lg flex items-center justify-center", accent ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary")}>{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
    <ArrowUpRight className="size-4 text-muted-foreground"/>
  </button>
);

export default Dashboard;
