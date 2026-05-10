export type PricingTier = {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  suffix?: string;
};

export const tiers: PricingTier[] = [
  {
    name: "Starter",
    price: "Free",
    tagline: "For landlords with up to 10 units",
    features: [
      "Up to 10 units",
      "WhatsApp bot (shared number)",
      "M-Pesa payment tracking",
      "Tenant CRM & lease timeline",
      "CSV bulk import",
      "Email support",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "KSh 2,500",
    suffix: "/month",
    tagline: "For growing portfolios 11–100 units",
    features: [
      "Up to 100 units",
      "Dedicated WhatsApp number",
      "Auto reminders & receipts",
      "Maintenance Kanban + vendors",
      "Owner P&L reports",
      "Priority WhatsApp support",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Scale",
    price: "Custom",
    tagline: "For agencies & 100+ units",
    features: [
      "Unlimited units & properties",
      "Multi-landlord workspaces",
      "API & webhook access",
      "Custom WhatsApp templates",
      "Investor portal",
      "Dedicated account manager",
    ],
    cta: "Talk to sales",
    highlight: false,
  },
];

export const getTierByUnitCount = (units: number) => {
  if (units <= 10) return tiers[0];
  if (units <= 100) return tiers[1];
  return tiers[2];
};

export const getTierByName = (name: string) => {
  return tiers.find((tier) => tier.name.toLowerCase() === name.toLowerCase()) ?? null;
};