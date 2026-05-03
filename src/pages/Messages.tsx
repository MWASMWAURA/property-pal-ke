import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messages } from "@/lib/mock-data";
import { Send, Paperclip, Search, MessageCircle, Users, AlertCircle } from "lucide-react";

const Messages = () => (
  <AppShell title="WhatsApp Hub" subtitle="Messages, broadcasts & tenant commands">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <QuickStat icon={<MessageCircle className="size-4"/>} label="Active threads" value="12"/>
      <QuickStat icon={<Users className="size-4"/>} label="Last broadcast" value="42 sent" sub="Rent reminder · Yesterday"/>
      <QuickStat icon={<AlertCircle className="size-4"/>} label="Unread" value="3" accent/>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[600px]">
      <Card className="lg:col-span-1 shadow-card border-border/60 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
            <Input placeholder="Search conversations" className="pl-9 bg-muted/40 border-transparent"/>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {messages.map((m, i) => (
            <button key={m.id} className={`w-full p-4 flex items-start gap-3 border-b border-border hover:bg-muted/40 text-left transition-colors ${i===0 ? "bg-muted/40" : ""}`}>
              <div className="size-11 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                {m.tenant.split(" ").map(n=>n[0]).slice(0,2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm truncate">{m.tenant}</div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{m.time}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.preview}</div>
              </div>
              {m.unread > 0 && <span className="size-5 rounded-full bg-success text-success-foreground text-[10px] font-bold flex items-center justify-center">{m.unread}</span>}
            </button>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-2 shadow-card border-border/60 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="size-10 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold">BO</div>
          <div className="flex-1">
            <div className="font-bold">Brian Otieno</div>
            <div className="text-xs text-success flex items-center gap-1"><span className="size-1.5 rounded-full bg-success"/>Online · +254 722 998 411</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20 min-h-[300px]">
          <Bubble side="in">Habari Brian, kindly note your rent of KSh 65,000 for April is now overdue. Please revert ASAP.</Bubble>
          <Bubble side="out">Sawa, nimepokea. I'll send by Friday via M-Pesa Paybill.</Bubble>
          <Bubble side="in">Asante. Reply RECEIPT once paid for confirmation.</Bubble>
          <Bubble side="out">Will do 👍</Bubble>
        </div>
        <div className="p-3 border-t border-border flex items-center gap-2">
          <Button size="icon" variant="ghost"><Paperclip className="size-4"/></Button>
          <Input placeholder="Type a message…" className="flex-1"/>
          <Button className="gradient-primary text-primary-foreground"><Send className="size-4"/></Button>
        </div>
      </Card>
    </div>
  </AppShell>
);

const Bubble = ({ side, children }: { side: "in"|"out"; children: React.ReactNode }) => (
  <div className={`flex ${side === "out" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
      side === "out"
        ? "bg-primary text-primary-foreground rounded-br-sm"
        : "bg-card text-foreground rounded-bl-sm border border-border"
    }`}>{children}</div>
  </div>
);

const QuickStat = ({icon, label, value, sub, accent}:any) => (
  <Card className={`p-4 shadow-card border-border/60 ${accent ? "border-destructive/30 bg-destructive/5" : ""}`}>
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
    <div className="font-bold text-xl font-mono-num">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </Card>
);

export default Messages;
