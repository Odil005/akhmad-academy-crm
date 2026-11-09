import { supabase } from "@/integrations/supabase/client";

/** Shared by the layout and the dashboard greeting through one query key, so the name is read once. */
export async function readProfileName(userId: string) {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return { full_name: data?.full_name ?? null };
}

/** Greeting by Tashkent time of day. */
export function tashkentGreeting(now = new Date()) {
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tashkent" })) % 24;
  if (hour < 5) return "Xayrli tun";
  if (hour < 12) return "Xayrli tong";
  if (hour < 18) return "Xayrli kun";
  return "Xayrli kech";
}
