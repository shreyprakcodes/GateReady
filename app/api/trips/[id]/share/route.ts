import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;

  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: trip, error: tripErr } = await client
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (tripErr || !trip) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { share_enabled?: boolean; regenerate?: boolean };
  try {
    body = await request.json() as { share_enabled?: boolean; regenerate?: boolean };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.share_enabled === "boolean") {
    updates.share_enabled = body.share_enabled;
  }

  if (body.regenerate) {
    // Generate a new random token — invalidates any existing shared links
    updates.share_token = crypto.randomUUID();
  }

  if (!Object.keys(updates).length) {
    return Response.json({ error: "No update specified" }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await client
    .from("trips")
    .update(updates)
    .eq("id", tripId)
    .select("id, share_enabled, share_token")
    .single();

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ trip: updated });
}
