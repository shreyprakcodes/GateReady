import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;

  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership via RLS (trips scoped to user_id) then fetch milestones
  const { data: trip } = await client
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!trip) return Response.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await client
    .from("trip_milestones")
    .select("*")
    .eq("trip_id", tripId)
    .order("reached_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ milestones: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;

  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: trip } = await client
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!trip) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { type?: string };
  try {
    body = await request.json() as { type?: string };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const VALID_TYPES = ["left_home", "cleared_security", "at_gate", "boarded"];
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return Response.json({ error: "Invalid milestone type" }, { status: 400 });
  }

  // Upsert: reaching a milestone again updates the timestamp (allows correction)
  const { data, error } = await client
    .from("trip_milestones")
    .upsert(
      { trip_id: tripId, type: body.type, reached_at: new Date().toISOString() },
      { onConflict: "trip_id,type" },
    )
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ milestone: data }, { status: 201 });
}
