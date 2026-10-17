"use client";

import { describeEvent, eventsFor, type TrailEntity } from "@/lib/ehss/trail";
import { useEhss } from "@/lib/ehss/store";

/**
 * What was changed on this record, and by which role.
 *
 * Absent when nothing has been changed — an empty "change history" under a
 * heading reads as an unfinished product, and this screen is shown to
 * directors.
 *
 * It says a ROLE and not a name, and the line at the bottom says so rather
 * than leaving a reader to assume the name is missing by accident. That is
 * the compliance position (COMPLIANCE-KSA §4), not an oversight, and a
 * reader deciding whether to trust the figure is entitled to know which.
 */
export function TrailPanel({
  entity,
  entityId,
}: {
  entity: TrailEntity;
  entityId: string;
}) {
  const { events } = useEhss();
  const mine = eventsFor(events, entity, entityId);
  if (mine.length === 0) return null;

  return (
    <div className="discipline-panel">
      <h3 className="panel-title" style={{ margin: 0 }}>
        Changes to this review
      </h3>
      <ul className="trail">
        {mine.map((event) => (
          <li key={event.id}>
            <span className="trail-what">{describeEvent(event)}</span>
            <span className="trail-who">
              {event.actorRole} ·{" "}
              {new Date(event.at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
      </ul>
      <p className="sub" style={{ margin: "10px 0 0" }}>
        Changes are attributed to a role, not a person. This system records
        contractor results and names nobody, which is what lets it run where
        it runs.
      </p>
    </div>
  );
}
