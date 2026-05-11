export type PricingTier = {
  name: string;
  price: string;
  suffix?: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  maxProperties: number;
  maxUnitsPerProperty: number;
};

export const tiers: PricingTier[] = [
  {
    name: "Starter",
    price: "Free",
    tagline: "One property with up to 12 units",
    features: [
      "1 property",
      "Up to 12 units",
      "Shared WhatsApp bot",
      "M-Pesa payment tracking",
      "Tenant CRM & lease timeline",
      "Email support",
    ],
    cta: "Start free",
    highlight: false,
    maxProperties: 1,
    maxUnitsPerProperty: 12,
  },
  {
    name: "Growth",
    price: "KSh 250",
    suffix: "/month",
    tagline: "Up to 2 properties with 12–20 units each",
    features: [
      "Up to 2 properties",
      "12–20 units per property",
      "Dedicated WhatsApp number",
      "Auto reminders & receipts",
      "Owner P&L reports",
      "Priority WhatsApp support",
    ],
    cta: "Choose Growth",
    highlight: true,
    maxProperties: 2,
    maxUnitsPerProperty: 20,
  },
  {
    name: "Custom",
    price: "Custom",
    tagline: "More than 2 properties or 50+ units per property",
    features: [
      "Large portfolios",
      "Flexible property counts",
      "High-capacity buildings",
      "Custom WhatsApp templates",
      "API & webhook access",
      "Dedicated onboarding support",
    ],
    cta: "Contact sales",
    highlight: false,
    maxProperties: Infinity,
    maxUnitsPerProperty: Infinity,
  },
];

export const getTierForProperties = (properties: { units: number }[]) => {
  if (properties.length === 0) return tiers[0];
  const propertyCount = properties.length;
  const maxUnitsPerProperty = Math.max(...properties.map((property) => property.units || 0));

  if (propertyCount <= 1 && maxUnitsPerProperty <= 12) {
    return tiers[0];
  }

  if (propertyCount <= 2 && maxUnitsPerProperty <= 20) {
    return tiers[1];
  }

  return tiers[2];
};

export const getTierByName = (name: string) => {
  return tiers.find((tier) => tier.name.toLowerCase() === name.toLowerCase()) ?? null;
};