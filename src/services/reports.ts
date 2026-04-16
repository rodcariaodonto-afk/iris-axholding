import { supabase } from "@/integrations/supabase/client";

export type DateRange = { start: Date; end: Date };

export const getDateRange = (period: string): DateRange => {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }
  return { start, end };
};

export interface ReportData {
  contacts: any[];
  conversations: any[];
  messages: any[];
  deals: any[];
  pipelineStages: any[];
  appointments: any[];
  teamMembers: any[];
}

export async function fetchReportData(range: DateRange): Promise<ReportData> {
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();

  const [contactsRes, conversationsRes, messagesRes, dealsRes, stagesRes, appointmentsRes, teamRes] =
    await Promise.all([
      supabase.from("contacts").select("*").gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("conversations").select("*").gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("messages").select("*").gte("created_at", startIso).lte("created_at", endIso).limit(5000),
      supabase.from("deals").select("*"),
      supabase.from("pipeline_stages").select("*").eq("is_active", true).order("position"),
      supabase.from("appointments").select("*").gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("team_members").select("*"),
    ]);

  return {
    contacts: contactsRes.data || [],
    conversations: conversationsRes.data || [],
    messages: messagesRes.data || [],
    deals: dealsRes.data || [],
    pipelineStages: stagesRes.data || [],
    appointments: appointmentsRes.data || [],
    teamMembers: teamRes.data || [],
  };
}

export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          if (v == null) return "";
          const s = typeof v === "object" ? JSON.stringify(v) : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
