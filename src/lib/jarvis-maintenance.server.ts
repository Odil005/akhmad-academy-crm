import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type JarvisMaintenanceResult = {
  staleNotificationsRecovered: number;
  failedNotificationsRequeued: number;
  receiptNotificationsReady: number;
};

/**
 * Only performs reversible queue repairs. It never deletes business data,
 * changes payments, changes roles, or edits attendance records.
 */
export async function runSafeJarvisMaintenance(): Promise<JarvisMaintenanceResult> {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [staleResult, failedResult, receiptResult] = await Promise.all([
    supabaseAdmin
      .from("parent_notifications")
      .update({
        status: "pending",
        processing_started_at: null,
        error: "Jarvis: stale queue recovered",
      })
      .eq("status", "processing")
      .lt("processing_started_at", staleBefore)
      .select("id"),
    supabaseAdmin
      .from("parent_notifications")
      .update({ status: "pending", processing_started_at: null })
      .in("status", ["failed", "error"])
      .lt("attempts", 5)
      .gte("created_at", recentSince)
      .select("id"),
    supabaseAdmin
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("attempts", 8)
      .not("telegram_chat_id", "is", null),
  ]);

  const firstError = staleResult.error ?? failedResult.error ?? receiptResult.error;
  if (firstError) throw new Error(firstError.message);

  return {
    staleNotificationsRecovered: staleResult.data?.length ?? 0,
    failedNotificationsRequeued: failedResult.data?.length ?? 0,
    receiptNotificationsReady: receiptResult.count ?? 0,
  };
}
