import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

const READABLE_FIELDS = [
  "id", "name", "email", "home_address",
  "tsa_precheck", "global_entry",
  "has_real_id", "has_clear", "known_traveler_number",
  "lounge_memberships",
] as const;

const WRITABLE_FIELDS = new Set([
  "name",
  "tsa_precheck", "global_entry",
  "has_real_id", "has_clear", "known_traveler_number",
  "lounge_memberships",
]);

export async function GET() {
  const supabase = await createSessionClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select(READABLE_FIELDS.join(", "))
    .eq("id", user.id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (WRITABLE_FIELDS.has(key)) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select(READABLE_FIELDS.join(", "))
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}
