export const STATUS_META = {
  trial:    { label: "Sinov",    bg: "bg-red-500",    text: "text-red-500",    tint: "bg-red-500/15 text-red-500" },
  active:   { label: "Faol",     bg: "bg-green-500",  text: "text-green-500",  tint: "bg-green-500/15 text-green-500" },
  frozen:   { label: "Muzlagan", bg: "bg-blue-500",   text: "text-blue-500",   tint: "bg-blue-500/15 text-blue-500" },
  archived: { label: "Arxiv",    bg: "bg-yellow-500", text: "text-yellow-600", tint: "bg-yellow-500/15 text-yellow-600" },
  left:     { label: "Ketgan",   bg: "bg-gray-500",   text: "text-gray-500",   tint: "bg-gray-500/15 text-gray-500" },
} as const;

export type StudentStatus = keyof typeof STATUS_META;
export const STATUS_ORDER: StudentStatus[] = ["trial", "active", "frozen", "archived", "left"];
