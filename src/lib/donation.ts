export type DonationCard = {
  label: string;
  number: string;
  holder: string;
};

export type DonationLink = {
  label: string;
  url: string;
};

export type DonationConfig = {
  enabled: boolean;
  title: string;
  message: string;
  owner_name: string;
  cards: DonationCard[];
  links: DonationLink[];
};

export const EMPTY_DONATION: DonationConfig = {
  enabled: true,
  title: "Loyihani qo'llab-quvvatlash",
  message:
    "Akhmad Academy tizimini rivojlantirishga hissa qo'shishingiz mumkin. Har qanday yordam biz uchun qadrli.",
  owner_name: "",
  cards: [],
  links: [],
};

export function normalizeDonation(raw: unknown): DonationConfig {
  const v = (raw ?? {}) as Partial<DonationConfig>;
  return {
    enabled: v.enabled !== false,
    title: v.title?.trim() ? v.title : EMPTY_DONATION.title,
    message: v.message?.trim() ? v.message : EMPTY_DONATION.message,
    owner_name: v.owner_name ?? "",
    cards: Array.isArray(v.cards)
      ? v.cards
          .filter((c) => c && (c.number?.trim() || c.label?.trim()))
          .map((c) => ({ label: c.label ?? "", number: c.number ?? "", holder: c.holder ?? "" }))
      : [],
    links: Array.isArray(v.links)
      ? v.links
          .filter((l) => l && l.url?.trim())
          .map((l) => ({ label: l.label ?? "Havola", url: l.url ?? "" }))
      : [],
  };
}

export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
