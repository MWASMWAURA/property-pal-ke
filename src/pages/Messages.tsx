import { useState, useEffect, useRef, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/data-store";
import { api } from "@/lib/api";
import { Send, Search, MessageCircle, Users, AlertCircle, Bot, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const COMMAND_CHIPS = ["MENU", "BALANCE", "RECEIPT", "PAY", "INFO", "COMPLAINT Water leaking", "MAINTENANCE Faulty socket"];

interface RealThread {
  id: string;
  tenantId: string;
  tenantName: string;
  unit: string;
  property: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  messages: Array<{ id: string; direction: 'in' | 'out'; body: string; timestamp: string; channel: string }>;
}

const Messages = () => {
  const { tenants, waMessages, simulateInbound, sendWhatsApp } = useData();
  const [mode, setMode] = useState<'simulator' | 'real'>('simulator');
  const [selectedId, setSelectedId] = useState<string>(tenants[0]?.id ?? "");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [asLandlord, setAsLandlord] = useState(false);
  const [serverThreads, setServerThreads] = useState<Record<string, any[]>>({});
  const [realThreads, setRealThreads] = useState<RealThread[]>([]);
  const [selectedRealThread, setSelectedRealThread] = useState<RealThread | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId && tenants[0]) setSelectedId(tenants[0].id);
  }, [tenants, selectedId]);

  // Load real server thread when tenant changes
  useEffect(() => {
    if (!selectedId) return;
    api.getWaMessages(selectedId)
      .then(msgs => setServerThreads(prev => ({ ...prev, [selectedId]: msgs })))
      .catch(() => {}); // silent fail
  }, [selectedId]);

  // Load real threads from WhatsApp when mode changes to real
  useEffect(() => {
    if (mode === 'real') {
      setLoading(true);
      api.getRealThreads()
        .then(threads => {
          setRealThreads(threads);
          if (threads.length > 0 && !selectedRealThread) {
            setSelectedRealThread(threads[0]);
          }
        })
        .catch(err => {
          console.error('Failed to load real threads:', err);
          toast({ title: "No real requests yet", description: "Waiting for tenants to send complaints via WhatsApp..." });
        })
        .finally(() => setLoading(false));
    }
  }, [mode]);

  const conversations = useMemo(() => {
    return tenants.map(t => {
      const msgs = waMessages.filter(m => m.tenantId === t.id);
      const last = msgs[msgs.length - 1];
      return { tenant: t, last, count: msgs.length };
    }).filter(c => !search || c.tenant.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.last?.timestamp ?? "").localeCompare(a.last?.timestamp ?? ""));
  }, [tenants, waMessages, search]);

  const selectedTenant = tenants.find(t => t.id === selectedId);
  const thread = useMemo(() => {
    const local = waMessages.filter(m => m.tenantId === selectedId);
    const server = (Array.isArray(serverThreads[selectedId]) ? serverThreads[selectedId] : []).map((m: any) => ({
      id: m.id,
      tenantId: m.tenant_id,
      direction: m.direction as 'in' | 'out',
      body: m.body,
      timestamp: m.timestamp,
      channel: m.channel as 'bot' | 'landlord',
    }));
    const merged = [...server, ...local];
    const seen = new Set<string>();
    return merged
      .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [waMessages, serverThreads, selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length, selectedRealThread?.messages]);

  const send = async () => {
    if (!text.trim()) return;

    if (mode === 'simulator') {
      if (!selectedTenant) return;
      if (asLandlord) {
        sendWhatsApp(selectedTenant.id, text.trim(), "landlord");
      } else {
        simulateInbound(selectedTenant.id, text.trim());
      }
    } else {
      // Send real reply
      if (!selectedRealThread) return;
      try {
        await api.sendReply(selectedRealThread.id, selectedRealThread.tenantId, text.trim());
        toast({ title: "Reply sent", description: `Message sent to ${selectedRealThread.tenantName} within 23-hour window.` });
        setText("");
        // Reload threads
        const threads = await api.getRealThreads();
        setRealThreads(threads);
        const updated = threads.find(t => t.id === selectedRealThread.id);
        if (updated) setSelectedRealThread(updated);
      } catch (error) {
        toast({ title: "Error", description: "Failed to send reply. Make sure WhatsApp credentials are configured.", variant: "destructive" });
      }
    }
    setText("");
  };

  return (
    <AppShell title="WhatsApp Hub" subtitle={mode === 'simulator' ? 'Bot simulator · type a message AS the tenant to test commands' : 'Real tenant requests · reply within 23 hours'}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <QuickStat icon={<MessageCircle className="size-4" />} label={mode === 'simulator' ? 'Active threads' : 'Pending requests'} value={`${mode === 'simulator' ? conversations.filter(c => c.count > 0).length : realThreads.length}`} />
        <QuickStat icon={<Users className="size-4" />} label="Tenants reachable" value={`${tenants.filter(t => t.phone).length}`} />
        <QuickStat icon={<AlertCircle className="size-4" />} label="Mode" value={mode === 'simulator' ? 'Simulated' : 'Real'} sub={mode === 'simulator' ? 'Tenant ↔ Bot' : 'WhatsApp API'} />
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        <Button 
          onClick={() => setMode('simulator')}
          variant={mode === 'simulator' ? 'default' : 'outline'}
          className={mode === 'simulator' ? 'gradient-primary text-primary-foreground' : ''}
          size="sm"
        >
          <Bot className="size-4 mr-2" />
          Bot Simulator
        </Button>
        <Button 
          onClick={() => setMode('real')}
          variant={mode === 'real' ? 'default' : 'outline'}
          className={mode === 'real' ? 'gradient-primary text-primary-foreground' : ''}
          size="sm"
        >
          <Zap className="size-4 mr-2" />
          Real Requests
          {realThreads.length > 0 && <Badge className="ml-2">{realThreads.length}</Badge>}
        </Button>
      </div>

      {mode === 'simulator' ? (
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[600px]">
          {/* Real threads list */}
          <Card className="lg:col-span-1 shadow-card border-border/60 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Pending Requests</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search requests" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/40 border-transparent" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
              ) : realThreads.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No pending requests. Tenants will appear here when they send complaints or maintenance requests via WhatsApp.</div>
              ) : (
                realThreads.filter(t => !search || t.tenantName.toLowerCase().includes(search.toLowerCase())).map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedRealThread(thread)}
                    className={`w-full p-4 flex items-start gap-3 border-b border-border hover:bg-muted/40 text-left transition-colors ${selectedRealThread?.id === thread.id ? "bg-muted/40" : ""}`}
                  >
                    <div className="size-11 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 text-sm">
                      {thread.tenantName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm truncate">{thread.tenantName}</div>
                        <Badge variant={thread.priority === 'urgent' ? 'destructive' : thread.priority === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                          {thread.priority}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{thread.category}</div>
                      <div className="text-xs line-clamp-2">{thread.description}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Real thread detail */}
          <Card className="lg:col-span-2 shadow-card border-border/60 overflow-hidden flex flex-col">
            {selectedRealThread ? (
              <>
                <div className="p-4 border-b border-border">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="size-10 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold">
                      {selectedRealThread.tenantName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{selectedRealThread.tenantName}</div>
                      <div className="text-xs text-muted-foreground">{selectedRealThread.unit} · {selectedRealThread.property}</div>
                    </div>
                    <Badge variant={selectedRealThread.priority === 'urgent' ? 'destructive' : 'default'}>
                      {selectedRealThread.priority}
                    </Badge>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{selectedRealThread.category}</div>
                    <div>{selectedRealThread.description}</div>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-muted/20 min-h-[280px]">
                  {selectedRealThread.messages.map(m => (
                    <Bubble key={m.id} side={m.direction === "in" ? "in" : "out"} channel={m.channel as 'bot' | 'landlord'}>
                      {m.body}
                    </Bubble>
                  ))}
                </div>

                <div className="px-3 pt-2 pb-2 border-t border-border">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Reply within 23 hours</div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Send your response to the tenant..."
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
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a request to view details and reply.</div>
            )}
          </Card>
        </div>
      )}
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
