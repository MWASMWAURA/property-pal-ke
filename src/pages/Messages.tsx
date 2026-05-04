import { useState, useEffect, useRef, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/data-store";
import { Send, Search, MessageCircle, Users, AlertCircle, Bot } from "lucide-react";

const COMMAND_CHIPS = ["MENU", "BALANCE", "RECEIPT", "PAY", "INFO", "COMPLAINT Water leaking", "MAINTENANCE Faulty socket"];

const Messages = () => {
  const { tenants, waMessages, simulateInbound, sendWhatsApp } = useData();
  const [selectedId, setSelectedId] = useState<string>(tenants[0]?.id ?? "");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [asLandlord, setAsLandlord] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId && tenants[0]) setSelectedId(tenants[0].id);
  }, [tenants, selectedId]);

  const conversations = useMemo(() => {
    return tenants.map(t => {
      const msgs = waMessages.filter(m => m.tenantId === t.id);
      const last = msgs[msgs.length - 1];
      return { tenant: t, last, count: msgs.length };
    }).filter(c => !search || c.tenant.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.last?.timestamp ?? "").localeCompare(a.last?.timestamp ?? ""));
  }, [tenants, waMessages, search]);

  const selectedTenant = tenants.find(t => t.id === selectedId);
  const thread = waMessages.filter(m => m.tenantId === selectedId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length]);

  const send = () => {
    if (!text.trim() || !selectedTenant) return;
    if (asLandlord) {
      sendWhatsApp(selectedTenant.id, text.trim(), "landlord");
    } else {
      simulateInbound(selectedTenant.id, text.trim());
    }
    setText("");
  };

  return (
    <AppShell title="WhatsApp Hub" subtitle="Bot simulator · type a message AS the tenant to test commands">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <QuickStat icon={<MessageCircle className="size-4" />} label="Active threads" value={`${conversations.filter(c => c.count > 0).length}`} />
        <QuickStat icon={<Users className="size-4" />} label="Tenants reachable" value={`${tenants.filter(t => t.phone).length}`} />
        <QuickStat icon={<AlertCircle className="size-4" />} label="Bot mode" value="Simulated" sub="Tenant ↔ Bot" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[600px]">
        {/* Conversations */}
        <Card className="lg:col-span-1 shadow-card border-border/60 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search conversations" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/40 border-transparent" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {conversations.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">No tenants. Add one to start chatting.</div>
            )}
            {conversations.map(({ tenant, last, count }) => (
              <button
                key={tenant.id}
                onClick={() => setSelectedId(tenant.id)}
                className={`w-full p-4 flex items-start gap-3 border-b border-border hover:bg-muted/40 text-left transition-colors ${selectedId === tenant.id ? "bg-muted/40" : ""}`}
              >
                <div className="size-11 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  {tenant.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{tenant.name}</div>
                    {count > 0 && <div className="text-[10px] text-muted-foreground shrink-0">{new Date(last.timestamp).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{last?.body ?? "No messages yet — say hi"}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Thread */}
        <Card className="lg:col-span-2 shadow-card border-border/60 overflow-hidden flex flex-col">
          {selectedTenant ? (
            <>
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="size-10 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold">
                  {selectedTenant.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{selectedTenant.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{selectedTenant.unit} · {selectedTenant.property} · {selectedTenant.phone}</div>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => setAsLandlord(false)} className={`px-2.5 py-1 rounded-md font-semibold ${!asLandlord ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>As tenant</button>
                  <button onClick={() => setAsLandlord(true)} className={`px-2.5 py-1 rounded-md font-semibold ${asLandlord ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>As landlord</button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-muted/20 min-h-[280px]">
                {thread.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground p-6">
                    <Bot className="size-8 mx-auto mb-2 text-primary" />
                    Send any command (try MENU) to test the bot reply.
                  </div>
                )}
                {thread.map(m => (
                  <Bubble key={m.id} side={m.direction === "in" ? "in" : "out"} channel={m.channel}>
                    {m.body}
                  </Bubble>
                ))}
              </div>

              <div className="px-3 pt-2 pb-2 border-t border-border space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {COMMAND_CHIPS.map(c => (
                    <button key={c} onClick={() => setText(c)} className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground font-mono">{c}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={asLandlord ? "Send a direct message…" : "Type a command as the tenant…"}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && send()}
                    className="flex-1"
                  />
                  <Button onClick={send} className="gradient-primary text-primary-foreground"><Send className="size-4" /></Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a tenant to start chatting.</div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

const Bubble = ({ side, children, channel }: { side: "in" | "out"; channel: "bot" | "landlord"; children: React.ReactNode }) => (
  <div className={`flex ${side === "out" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
      side === "out"
        ? channel === "bot" ? "bg-primary/90 text-primary-foreground rounded-br-sm" : "bg-accent text-accent-foreground rounded-br-sm"
        : "bg-card text-foreground rounded-bl-sm border border-border"
    }`}>
      {side === "out" && <div className="text-[9px] opacity-70 uppercase font-bold mb-0.5">{channel === "bot" ? "🤖 Bot" : "👤 Landlord"}</div>}
      {children}
    </div>
  </div>
);

const QuickStat = ({ icon, label, value, sub, accent }: any) => (
  <Card className={`p-4 shadow-card border-border/60 ${accent ? "border-destructive/30 bg-destructive/5" : ""}`}>
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
    <div className="font-bold text-xl font-mono-num">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </Card>
);

export default Messages;
