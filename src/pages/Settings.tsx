import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { tiers, getTierForProperties } from "@/lib/pricing-tiers";
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  CreditCard,
  ShieldCheck,
  Zap,
  Bell,
} from "lucide-react";

const TOP_UP_OPTIONS = [500, 1000, 2500, 5000];

const formatKsh = (value: number) => `KSh ${value.toLocaleString("en-KE")}`;

const Settings = () => {
  const { profile, properties, saveProfile, startDemo, resetToOwnData } = useData();
  const currentPlan = useMemo(() => getTierForProperties(properties), [properties]);
  const recommendedPlan = currentPlan.name;
  const currentSubscription = profile?.billing?.currentPlan || recommendedPlan;

  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    company: profile?.company || "",
    city: profile?.city || "",
    preferredChannel: profile?.preferredChannel || "whatsapp",
    collectionMonthStart: profile?.collectionMonthStart || 1,
  });

  const [walletBalance, setWalletBalance] = useState(profile?.billing?.walletBalance ?? 0);
  const [whatsappBalance, setWhatsappBalance] = useState(profile?.billing?.whatsappBalance ?? 0);
  const [smsBalance, setSmsBalance] = useState(profile?.billing?.smsBalance ?? 0);
  const [selectedPlanName, setSelectedPlanName] = useState(currentSubscription);
  const [topUpAmount, setTopUpAmount] = useState("1000");

  useEffect(() => {
    setForm({
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      company: profile?.company || "",
      city: profile?.city || "",
      preferredChannel: profile?.preferredChannel || "whatsapp",
      collectionMonthStart: profile?.collectionMonthStart || 1,
    });

    setWalletBalance(profile?.billing?.walletBalance ?? 0);
    setWhatsappBalance(profile?.billing?.whatsappBalance ?? 0);
    setSmsBalance(profile?.billing?.smsBalance ?? 0);
    setSelectedPlanName(profile?.billing?.currentPlan || recommendedPlan);
  }, [profile, recommendedPlan]);

  const handleSave = () => {
    if (!form.name || !form.email) {
      toast({ title: "Required fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }

    if (!profile) {
      toast({ title: "Profile missing", description: "Please sign in again to save settings.", variant: "destructive" });
      return;
    }

    saveProfile({
      ...profile,
      ...form,
      billing: {
        ...(profile.billing ?? {}),
        walletBalance,
        whatsappBalance,
        smsBalance,
        currentPlan: selectedPlanName,
      },
    });

    toast({ title: "Profile updated", description: "Your settings have been saved." });
  };

  const handleChoosePlan = (planName: string) => {
    setSelectedPlanName(planName);
    setTopUpAmount(planName === "Growth" ? "250" : planName === "Starter" ? "0" : "1000");

    toast({
      title: `Selected ${planName} plan`,
      description: planName === "Custom"
        ? "A custom plan will be handled by our sales team."
        : `Ready to request an STK push for the ${planName} plan.`,
    });
  };

  const handleRequestStkPush = () => {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Choose a valid top-up amount.", variant: "destructive" });
      return;
    }

    if (!profile) {
      toast({ title: "Profile missing", description: "Please sign in again to request payment.", variant: "destructive" });
      return;
    }

    const updatedBilling = {
      ...(profile.billing ?? {}),
      walletBalance: walletBalance + amount,
      currentPlan: selectedPlanName,
      lastTopUp: new Date().toISOString(),
    };

    saveProfile({
      ...profile,
      billing: updatedBilling,
    });
    setWalletBalance(walletBalance + amount);

    toast({
      title: "STK push requested",
      description: `A KSh ${amount.toLocaleString()} STK push has been requested. Check your phone for confirmation.`,
    });
  };

  return (
    <AppShell title="Settings" subtitle="Manage your profile, billing, and notification preferences">
      <div className="max-w-5xl space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Profile Information</h2>
              <p className="text-sm text-muted-foreground">Update your company details and notification preferences.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="size-4" /> Full Name *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="size-4" /> Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="size-4" /> Phone ✓ Verified
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+254 712 345 678"
                disabled={true}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="size-4" /> Company
              </Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="size-4" /> City
              </Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Nairobi"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="size-4" /> Preferred Communication Channel
              </Label>
              <Select value={form.preferredChannel} onValueChange={(v) => setForm({ ...form, preferredChannel: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp (Recommended)</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collectionMonthStart">Collection Month Start Day</Label>
              <Select value={form.collectionMonthStart.toString()} onValueChange={(v) => setForm({ ...form, collectionMonthStart: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                      {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of each month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When does your collection period start? Revenue charts will group payments by your selected month boundary.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
              Save Changes
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl gradient-secondary text-secondary-foreground flex items-center justify-center">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Billing & plan</h2>
              <p className="text-sm text-muted-foreground">View your current plan, choose an upgrade, and top up your wallet with STK.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current subscription</div>
              <div className="mt-3 text-2xl font-bold">{currentSubscription}</div>
              <div className="mt-2 text-sm text-muted-foreground">Based on your active portfolio and plan settings.</div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recommended plan</div>
              <div className="mt-3 text-2xl font-bold">{recommendedPlan}</div>
              <div className="mt-2 text-sm text-muted-foreground">This is the best fit for your current property count and unit sizes.</div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Property mix</div>
              <div className="mt-3 text-2xl font-bold">{properties.length} {properties.length === 1 ? "property" : "properties"}</div>
              <div className="mt-2 text-sm text-muted-foreground">Max units per property: {properties.length > 0 ? Math.max(...properties.map((p) => p.units)) : 0}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {tiers.map((tier) => (
              <div key={tier.name} className="rounded-3xl border border-border bg-card p-5 flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{tier.name}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{tier.tagline}</p>
                  </div>
                  {tier.name === currentSubscription && (
                    <div className="rounded-full bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">Active</div>
                  )}
                </div>
                <div className="mt-5 text-3xl font-extrabold">
                  {tier.price} {tier.suffix ?? ""}
                </div>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <div className="mt-5">
                  <Button
                    size="sm"
                    variant={tier.name === currentSubscription ? "outline" : "secondary"}
                    onClick={() => handleChoosePlan(tier.name)}
                  >
                    {tier.name === currentSubscription ? "Current plan" : tier.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <ShieldCheck className="size-5 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">STK push & top-up</h3>
                  <p className="text-sm text-muted-foreground">Keep your wallet topped up and pay for plan upgrades or message credits.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="topUpAmount">Top-up amount</Label>
                  <Select value={topUpAmount} onValueChange={(value) => setTopUpAmount(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOP_UP_OPTIONS.map((amount) => (
                        <SelectItem key={amount} value={amount.toString()}>
                          {formatKsh(amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Selected plan</Label>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium">{selectedPlanName}</div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wallet balance</div>
                  <div className="mt-1 text-2xl font-bold">{formatKsh(walletBalance)}</div>
                </div>
                <Button onClick={handleRequestStkPush} className="bg-primary text-primary-foreground">
                  Request STK push
                </Button>
              </div>

              <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                When you top up, the selected plan is retained and your message billing can be covered from the wallet instead of paying per transaction.
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="size-5 text-amber-600" />
                  <h3 className="text-lg font-semibold">WhatsApp billing</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  WhatsApp messages are charged at KSh 1.50 per landlord-triggered message when the conversation is in the yellow window or after 23 hours.
                </p>
                <div className="mt-4 text-sm">
                  <div className="flex items-center justify-between py-2 border-t border-border text-muted-foreground">
                    <span>Status window</span>
                    <span className="font-medium">Yellow / Green</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-border text-muted-foreground">
                    <span>Rate</span>
                    <span className="font-medium">KSh 1.50 / triggered message</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Bell className="size-5 text-sky-600" />
                  <h3 className="text-lg font-semibold">SMS billing</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  SMS notifications are billed per outbound message. Keep enough balance to deliver payment alerts on SMS when WhatsApp is unavailable.
                </p>
                <div className="mt-4 text-sm">
                  <div className="flex items-center justify-between py-2 border-t border-border text-muted-foreground">
                    <span>Current SMS wallet</span>
                    <span className="font-medium">{formatKsh(smsBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-border text-muted-foreground">
                    <span>Preferred channel</span>
                    <span className="font-medium">{form.preferredChannel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Demo Mode</h2>
              <p className="text-sm text-muted-foreground">Switch between sample data and your own live portfolio.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={startDemo}>Load Demo Data</Button>
              <Button variant="outline" onClick={resetToOwnData}>Use My Data</Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default Settings;
