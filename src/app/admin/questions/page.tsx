import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminError } from "@/components/AdminError";
import { addQuestion, updateQuestion } from "../actions";
import type { AuditQuestionRow, AuditTypeRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string }>;
}) {
  const { error, type } = await searchParams;
  const supabase = await createClient();

  const { data: typesData } = await supabase
    .from("audit_types")
    .select("*")
    .order("name");
  const auditTypes = (typesData ?? []) as AuditTypeRow[];
  const selected =
    auditTypes.find((t) => t.id === type) ?? auditTypes[0] ?? null;

  const { data: questionsData } = selected
    ? await supabase
        .from("audit_questions")
        .select("*")
        .eq("audit_type_id", selected.id)
        .order("sort_order")
    : { data: [] };
  const questions = (questionsData ?? []) as AuditQuestionRow[];

  return (
    <div className="stack">
      <section className="card">
        <h2>Audit questions</h2>
        <p className="sub">
          Weights only affect audits scored after the change. Deactivating
          removes a control from new audits; existing responses are kept.
        </p>
        {auditTypes.length > 1 && (
          <p>
            {auditTypes.map((t) => (
              <Link
                key={t.id}
                href={`/admin/questions?type=${t.id}`}
                style={{
                  marginRight: 12,
                  fontWeight: t.id === selected?.id ? 650 : 400,
                }}
              >
                {t.name}
              </Link>
            ))}
          </p>
        )}
        <AdminError error={error} />
        {!selected ? (
          <div className="chart-empty">No audit types yet.</div>
        ) : questions.length === 0 ? (
          <div className="chart-empty">No questions for {selected.name}.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Category</th>
                <th>Control</th>
                <th className="num">Weight</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.code}</strong>
                  </td>
                  <td>{q.category}</td>
                  <td style={{ color: "var(--ink-2)", maxWidth: 420 }}>
                    {q.question}
                  </td>
                  <td className="num" colSpan={3}>
                    <form
                      action={updateQuestion}
                      style={{
                        display: "inline-flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input type="hidden" name="id" value={q.id} />
                      <input
                        type="hidden"
                        name="audit_type_id"
                        value={q.audit_type_id}
                      />
                      <input
                        name="weight"
                        type="number"
                        step="0.25"
                        min="0.25"
                        defaultValue={Number(q.weight)}
                        style={{ width: 72 }}
                        aria-label={`Weight for ${q.code}`}
                      />
                      <label
                        style={{
                          display: "inline-flex",
                          gap: 4,
                          alignItems: "center",
                          fontSize: 12.5,
                          color: "var(--ink-2)",
                        }}
                      >
                        <input
                          name="active"
                          type="checkbox"
                          defaultChecked={q.active}
                        />
                        active
                      </label>
                      <button className="ghost" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <section className="card" style={{ maxWidth: 560 }}>
          <h2>Add question to {selected.name}</h2>
          <form action={addQuestion}>
            <input type="hidden" name="audit_type_id" value={selected.id} />
            <label className="field">
              <span>Code</span>
              <input name="code" type="text" required placeholder="WMP-04" />
            </label>
            <label className="field">
              <span>Category</span>
              <input
                name="category"
                type="text"
                required
                placeholder="Worker Management Plan"
              />
            </label>
            <label className="field">
              <span>Control</span>
              <input
                name="question"
                type="text"
                required
                placeholder="… is established and implemented in accordance with applicable requirements."
              />
            </label>
            <label className="field">
              <span>Weight</span>
              <input
                name="weight"
                type="number"
                step="0.25"
                min="0.25"
                defaultValue={1}
              />
            </label>
            <label className="field">
              <span>Sort order</span>
              <input name="sort_order" type="number" defaultValue={1000} />
            </label>
            <button className="primary" type="submit">
              Add question
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
