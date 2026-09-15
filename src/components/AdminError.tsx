/** Renders the ?error= message an admin action redirected back with. */
export function AdminError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="form-error">{error}</p>;
}
