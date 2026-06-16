import { redirect } from "next/navigation";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { FoodClient } from "./FoodClient";
import type { ParentalSettings } from "@/lib/supabase/types";

export default async function FoodPage() {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("parental_mode, parental_settings")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const settings = (trip?.parental_settings ?? {}) as Partial<ParentalSettings>;
  const locked = Boolean(trip?.parental_mode && settings.dnd_vendors);

  return <FoodClient locked={locked} />;
}
