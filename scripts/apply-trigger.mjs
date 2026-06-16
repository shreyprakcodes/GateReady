/**
 * Run: node scripts/apply-trigger.mjs <DB_PASSWORD>
 *
 * DB_PASSWORD is your Supabase project database password
 * (Settings → Database → Connection string → Transaction pooler password)
 */
import pg from "pg";
const { Client } = pg;

const DB_PASSWORD = process.argv[2];
if (!DB_PASSWORD) {
  console.error("Usage: node scripts/apply-trigger.mjs <DB_PASSWORD>");
  process.exit(1);
}

const client = new Client({
  connectionString: `postgresql://postgres.ovxxzefhtkrusdnvneks:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
});

const SQL = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

try {
  await client.connect();
  await client.query(SQL);
  console.log("✓ Trigger created successfully.");
  await client.end();
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exit(1);
}
