import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("read", { ascending: true })        // unread first
    .order("created_at", { ascending: false }) // newest first within each group
    .limit(limit);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ notifications: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { ids?: string[]; all?: boolean };
  try {
    body = await request.json() as { ids?: string[]; all?: boolean };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.all) {
    await client
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    return Response.json({ ok: true });
  }

  if (!body.ids?.length) return Response.json({ error: "No ids provided" }, { status: 400 });

  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .in("id", body.ids);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
