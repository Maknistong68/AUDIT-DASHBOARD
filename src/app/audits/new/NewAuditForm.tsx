"use client";

import { useActionState } from "react";
import { createAudit, type ActionState } from "../actions";
import type { AuditTypeRow, ContractorRow } from "@/lib/db";

const initialState: ActionState = { error: null };

export function NewAuditForm({
  contractors,
  auditTypes,
}: {
  contractors: ContractorRow[];
  auditTypes: AuditTypeRow[];
}) {
  const [state, formAction, pending] = useActionState(
    createAudit,
    initialState,
  );

  return (
    <form action={formAction}>
      <label className="field">
        <span>Contractor</span>
        <select name="contractor_id" required defaultValue="">
          <option value="" disabled>
            Select a contractor…
          </option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Audit type</span>
        <select name="audit_type_id" required defaultValue="">
          <option value="" disabled>
            Select an audit type…
          </option>
          {auditTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Audit date</span>
        <input name="audit_date" type="date" required />
      </label>
      {state.error && <p className="form-error">{state.error}</p>}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}
