import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure a row exists in public.users for this auth user
      const service = createServiceClient();
      await service.from("users").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? null,
          name: data.user.user_metadata?.name ?? null,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
