import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data-store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatKsh } from "@/lib/mock-data";
import { Phone, MessageCircle, Receipt, MessageSquareWarning, FileText, Edit, Trash2 } from "lucide-react";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { RecordComplaintDialog } from "./RecordComplaintDialog";
import { EditTenantDialog } from "./EditTenantDialog";

export const TenantDetailDialog = ({
  trigger, tenantId,
}: { trigger: React.ReactNode; tenantId: string }) => {
  const { tenants, payments, complaints, waMessages, deleteTenant } = useData();
  const [open, setOpen] = useState(false);
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) return null;

  const tPays = payments.filter(p => p.tenantId === tenantId && p.status === "paid");
  const tComplaints = complaints.filter(c => c.tenantId === tenantId);
  const tMsgs = waMessages.filter(m => m.tenantId === tenantId);
  const totalPaid = tPays.reduce((s, p) => s + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold">
              {tenant.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1">
              <DialogTitle>{tenant.name}</DialogTitle>
              <DialogDescription>{tenant.unit} · {tenant.property} · {tenant.phone}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Rent" value={formatKsh(tenant.rent)} />
          <Stat label="Total paid" value={formatKsh(totalPaid)} accent="text-success" />
          <Stat label="Status" value={tenant.status.toUpperCase()} accent={tenant.status === "overdue" ? "text-destructive" : tenant.status === "pending" ? "text-warning" : "text-success"} />
        </div>

        <div className="flex flex-wrap gap-2">
          <RecordPaymentDialog defaultTenantId={tenant.id} trigger={
            <Button size="sm" className="gradient-primary text-primary-foreground"><Receipt className="size-3.5" /> Record payment</Button>
          } />
          <RecordComplaintDialog defaultTenantId={tenant.id} trigger={
            <Button size="sm" variant="outline"><MessageSquareWarning className="size-3.5" /> Log complaint</Button>
          } />
          <EditTenantDialog tenantId={tenant.id} trigger={
            <Button size="sm" variant="outline"><Edit className="size-3.5" /> Edit tenant</Button>
          } />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /> Delete tenant</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete tenant</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {tenant.name}? This will remove all their payment history, complaints, and messages. The unit will become vacant.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { deleteTenant(tenant.id); setOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="outline"><MessageCircle className="size-3.5" /> WhatsApp</Button>
          <Button size="sm" variant="outline"><Phone className="size-3.5" /> Call</Button>
        </div>

        <Section title="Payment history" icon={<Receipt className="size-4" />} empty={tPays.length === 0 ? "No payments recorded yet." : null}>
          {tPays.map(p => (
            <Row key={p.id} left={<><div className="font-semibold">{formatKsh(p.amount)}</div><div className="text-xs text-muted-foreground">{p.period} · {p.method}</div></>}
              right={new Date(p.paidAt).toLocaleDateString("en-KE")} />
          ))}
        </Section>

        <Section title="Complaints" icon={<MessageSquareWarning className="size-4" />} empty={tComplaints.length === 0 ? "No complaints filed." : null}>
          {tComplaints.map(c => (
            <Row key={c.id} left={<><div className="font-semibold">{c.category} · <span className="text-xs uppercase">{c.priority}</span></div><div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div></>}
              right={c.status} />
          ))}
        </Section>

        <Section title="WhatsApp transcript" icon={<FileText className="size-4" />} empty={tMsgs.length === 0 ? "No messages yet." : null}>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {tMsgs.map(m => (
              <div key={m.id} className={`text-xs p-2 rounded-lg max-w-[85%] ${m.direction === "in" ? "bg-muted" : "bg-primary/10 ml-auto text-right"}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.timestamp).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        </Section>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value, accent = "text-foreground" }: any) => (
  <div className="rounded-lg bg-muted/40 p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`font-mono-num font-bold text-sm ${accent}`}>{value}</div>
  </div>
);

const Section = ({ title, icon, children, empty }: any) => (
  <div className="border border-border rounded-lg overflow-hidden">
    <div className="px-3 py-2 bg-muted/40 flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
    <div className="p-3 space-y-2">{empty ? <p className="text-xs text-muted-foreground">{empty}</p> : children}</div>
  </div>
);

const Row = ({ left, right }: any) => (
  <div className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
    <div>{left}</div>
    <div className="text-xs text-muted-foreground capitalize">{right}</div>
  </div>
);
