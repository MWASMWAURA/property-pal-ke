import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useData, LandlordProfile } from "@/lib/data-store";
import { Building2, Sparkles, Rocket, CheckCircle2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const OnboardingDialog = () => {
  const { needsOnboarding, setNeedsOnboarding, saveProfile, startDemo, startFresh, profile: currentProfile } = useData();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<LandlordProfile>(currentProfile || {
    name: "", email: "", phone: "", company: "", city: "Nairobi", preferredChannel: "whatsapp", collectionMonthStart: 1,
  });
  const [phoneVerified, setPhoneVerified] = useState(!!currentProfile?.phone); // Assume phone is verified if profile exists

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(0, s - 1));

  const finishWithDemo = () => {
    saveProfile(profile);
    startDemo();
    setStep(0);
  };
  const finishFresh = () => {
    saveProfile(profile);
    startFresh();
    setStep(0);
  };

  return (
    <Dialog open={needsOnboarding} onOpenChange={(o) => !o && setNeedsOnboarding(false)}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 max-h-[92vh] overflow-y-auto">
        {/* Header banner */}
        <div className="gradient-hero text-white p-6 relative">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl"/>
          <div className="relative">
            <div className="text-[11px] uppercase tracking-widest font-semibold opacity-80 mb-1">Welcome to PropertyHub Kenya</div>
            <h2 className="text-2xl font-bold">Let's set up your command center</h2>
            <p className="text-sm opacity-80 mt-1">Step {step + 1} of 3</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Your name</Label>
                <Input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="James Kariuki"/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} placeholder="you@example.com"/>
                </div>
                  <div className="space-y-2">
                    <Label>Phone {phoneVerified && "✓ Verified"}</Label>
                    <Input
                      value={profile.phone}
                      onChange={e => !phoneVerified && setProfile({...profile, phone: e.target.value})}
                      placeholder="+254 …"
                      disabled={phoneVerified}
                    />
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Company / agency</Label>
                  <Input value={profile.company} onChange={e => setProfile({...profile, company: e.target.value})} placeholder="Optional"/>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})}/>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preferred tenant channel</Label>
                <Select value={profile.preferredChannel} onValueChange={(v: any) => setProfile({...profile, preferredChannel: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-bold text-lg">What you'll get</h3>
              {[
                { i: <Building2 className="size-4"/>, t: "Portfolio overview", d: "Track every property, unit and occupancy at a glance." },
                { i: <CheckCircle2 className="size-4"/>, t: "95%+ collection rate", d: "Hero overdue widget chases late tenants automatically." },
                { i: <MessageCircle className="size-4"/>, t: "WhatsApp hub", d: "Bulk reminders, receipts and balance commands." },
                { i: <Sparkles className="size-4"/>, t: "Audit-ready reports", d: "Monthly statements & tax exports in one click." },
              ].map(f => (
                <div key={f.t} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{f.i}</div>
                  <div>
                    <div className="font-semibold text-sm">{f.t}</div>
                    <div className="text-xs text-muted-foreground">{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-bold text-lg">Choose how to start</h3>
              <button
                onClick={finishWithDemo}
                className="w-full text-left p-4 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg gradient-primary text-primary-foreground flex items-center justify-center"><Sparkles className="size-5"/></div>
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-2">Try the guided demo <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-bold">Recommended</span></div>
                    <div className="text-xs text-muted-foreground">Explore with sample Nairobi properties + a built-in tour. You can reset anytime.</div>
                  </div>
                </div>
              </button>
              <button
                onClick={finishFresh}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-muted text-foreground flex items-center justify-center"><Rocket className="size-5"/></div>
                  <div className="flex-1">
                    <div className="font-bold">Start fresh with my data</div>
                    <div className="text-xs text-muted-foreground">Empty workspace — add your own properties and tenants right away.</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Stepper footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-primary" : "w-1.5 bg-border")}/>
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && <Button variant="ghost" onClick={back}>Back</Button>}
              {step < 2 && (
                <Button
                  onClick={next}
                  disabled={step === 0 && !profile.name}
                  className="gradient-primary text-primary-foreground"
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
