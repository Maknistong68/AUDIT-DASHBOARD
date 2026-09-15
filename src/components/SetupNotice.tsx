export function SetupNotice() {
  return (
    <div className="card">
      <h2>Supabase is not configured</h2>
      <p className="sub">
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in
        your project&apos;s URL and anon key, then apply the migrations in{" "}
        <code>supabase/migrations/</code> and the seed in{" "}
        <code>supabase/seed.sql</code>.
      </p>
    </div>
  );
}
