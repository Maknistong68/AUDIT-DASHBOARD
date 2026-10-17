"use client";

import { useState } from "react";
import { useEhss } from "@/lib/ehss/store";
import { contractorFieldProblem, type EhssContractor } from "@/lib/ehss/model";

/**
 * The contractor register, editable.
 *
 * It was read-only, so adding a contractor meant a code change and a
 * deploy — not a thing an admin should have to ask for when a project
 * starts mid-quarter.
 *
 * The naming rule is ENFORCED here rather than trusted. Contractors are
 * initials plus the last three digits of the work order and nothing else,
 * and that is what lets this data be hosted where it is (COMPLIANCE-KSA
 * §4). An open text box would quietly void that, so the fields refuse a
 * full company name or a whole work order and say which rule they are
 * applying — a validation message that only says "invalid" teaches nobody
 * why the rule exists.
 */
export function ContractorRegister() {
  const { contractors, subRegions, saveContractor, canWrite, storage } =
    useEhss();
  const [draft, setDraft] = useState<EhssContractor | null>(null);

  const start = (contractor: EhssContractor | null) =>
    setDraft(
      contractor ?? {
        id: `c-${Date.now().toString(36)}`,
        name: "",
        code: "",
        subRegionId: subRegions[0]?.id ?? "",
        active: true,
      },
    );

  const nameProblem = draft ? contractorFieldProblem("name", draft.name) : null;
  const codeProblem = draft ? contractorFieldProblem("code", draft.code) : null;
  const valid = draft !== null && !nameProblem && !codeProblem;

  return (
    <section className="card">
      <div className="drilldown-head">
        <div>
          <h2 style={{ margin: 0 }}>Contractor register</h2>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            Initials and the last three digits of the work order — nothing
            wider. {contractors.length} on record.
            {!storage.shared && " Changes are held in this browser."}
          </p>
        </div>
        {canWrite && draft === null && (
          <button className="ghost" type="button" onClick={() => start(null)}>
            Add contractor
          </button>
        )}
      </div>

      {draft && (
        <div className="reg-edit">
          <label className="field">
            <span>Initials</span>
            <input
              type="text"
              value={draft.name}
              placeholder="SIBS"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {nameProblem && <em className="reg-problem">{nameProblem}</em>}
          </label>
          <label className="field">
            <span>Work order (last 3)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={draft.code}
              placeholder="838"
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            {codeProblem && <em className="reg-problem">{codeProblem}</em>}
          </label>
          <label className="field">
            <span>Sub-region</span>
            <select
              value={draft.subRegionId}
              onChange={(e) =>
                setDraft({ ...draft, subRegionId: e.target.value })
              }
            >
              {subRegions.map((sr) => (
                <option key={sr.id} value={sr.id}>
                  {sr.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Active
          </label>
          <span className="spacer" />
          <button className="ghost" type="button" onClick={() => setDraft(null)}>
            Cancel
          </button>
          <button
            className="primary"
            type="button"
            disabled={!valid}
            onClick={() => {
              saveContractor({
                ...draft,
                name: draft.name.trim(),
                code: draft.code.trim(),
              });
              setDraft(null);
            }}
          >
            Save
          </button>
        </div>
      )}

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Contractor</th>
              <th>Sub-region</th>
              <th>Status</th>
              {canWrite && <th />}
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id} className={c.active ? undefined : "is-out"}>
                <td>
                  <strong>{c.code}</strong>
                </td>
                <td>{c.name}</td>
                <td>{subRegions.find((s) => s.id === c.subRegionId)?.name}</td>
                <td style={{ color: c.active ? undefined : "var(--muted)" }}>
                  {c.active ? "Active" : "Inactive"}
                </td>
                {canWrite && (
                  <td className="num">
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => start(c)}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
