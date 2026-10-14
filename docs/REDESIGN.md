# Redesign — brief, diagnosis and checklist

Owner's direction, 2026-10-14. Nothing here is built yet; this is the plan to
agree before any code moves.

## Who opens this, and what they are doing

Three readers, one job between them:

- **Project Director, Sub-Region 1**
- **Project Director, Sub-Region 2**
- **The H&S team**

They open the page to **compare contractors against each other**, and they
care about **the most recent quarter** first. Everything else is secondary.

That sentence should decide the layout, and today it does not.

## What is wrong now — diagnosis, not excuses

1. **The board is one chart locked to the viewport.** `CLAUDE.md` says "the
   dashboard is ONE chart" and `.shell:has(.board)` pins it to `100dvh`. With
   13 contractors the bars become enormous and everything else is squeezed
   into a floating panel. The owner's words: "a bar chart that is so huge,
   and the rest is a little bit unproportioned." **That rule is the cause and
   it goes.**

2. **Sub-regions are a dropdown, not structure.** The organisation is two
   sub-regions with a director each. They are currently a filter, so neither
   director sees their own patch without touching a control first.

3. **The drill-down reuses one cramped floating box for three different
   jobs.** Level 1 ranks problems, level 2 explains one, level 3 shows
   evidence — and all three share a panel sized for the smallest of them.

4. **Prose everywhere.** Notes, hints, explanatory sentences. The owner has
   said twice that directors do not read; the second time about a paragraph
   that was my doing.

5. **Twelve issue categories is past the readable ceiling.** The
   visualization reference puts it plainly: beyond about seven classes
   carrying meaning, adjacent ones blur and a table beats a chart.

6. **A future quarter is offered when creating a review.**
   `quarterOptions()` seeds `nextQuarter(current)`, so an audit can be opened
   for a quarter that has not happened.

## The new structure

Three levels, as now — the owner confirmed three is right — but each gets a
shape that suits its job instead of one shared panel.

### Level 0 · The board (what opens)

Latest quarter by default. Two things stacked:

- **A KPI row** — four stat tiles, no chart: programme average, contractors
  below target, the weakest checklist area, movement since last quarter. A
  single number is a stat tile, never a one-bar chart.
- **Two panels side by side: Sub-Region 1 and Sub-Region 2.** Each is a
  horizontal bar list of its own contractors against the 90% target, worst
  first. Horizontal because the labels are names; faceted by sub-region
  because that is the org chart, and it gives each director their own column
  without touching a filter.

This fixes the proportion complaint structurally: the chart no longer owns
the whole viewport, it owns its panel.

### Level 1 · One contractor — why are they behind

Opens when a bar is clicked. Four pieces, no more:

1. **The headline** — score, band, change since last quarter, a small
   sparkline. Hero figure, not a chart.
2. **Where** — Section A / B / C, three bars. Office systems, site
   execution, or leadership and planning. *(See open question 1.)*
3. **Why** — the issue categories, biggest first. Seven classes maximum.
4. **Is it sticking** — recurring versus new, one simple split.

Then a short ranked list of the weakest areas, each one a way into level 2.

### Level 2 · One problem — the detail

Words are allowed here and only here. What is missing, what the auditor
found, which questions, which quarters.

### Inputs

- **The auditor creates a new audit.** No pre-created and no future
  quarters; `nextQuarter` comes out of the options.
- The 81-question form gets simplified in the same pass.

## The issue categories — seven

Reduced from twelve. The rule that held the old list together still holds:
**every category implies a different fix and a different owner**, and none is
specific to one discipline, so the same seven serve all five audits.

| # | Category | What it means | Who fixes it |
|---|---|---|---|
| 1 | **Documentation** | The plan, permit, certificate or record does not exist, is not approved, or has expired | Contractor EHSS management |
| 2 | **Planning** | Work began without being planned, risk-assessed or sequenced | Planning and engineering |
| 3 | **Implementation** | It exists on paper and is not happening on site | Site management |
| 4 | **Competence** | People are not trained, qualified or appointed for the task | Training and HR |
| 5 | **Supervision** | Nobody is checking — no supervisor at the work, or the inspection regime is not running | Site supervision |
| 6 | **Resources** | Not enough people or equipment, or the equipment is unfit | Contractor commercial |
| 7 | **Leadership** | Management is not visibly engaged, and nothing follows a finding | Contractor senior management |

How the old twelve fold in:

- `REC` Records & reporting → **Documentation**. Both are "it is not written
  down properly"; same fix, same owner.
- `INS` Inspection & checks → **Supervision**. Both are "nobody was
  checking". A scheduled inspection and a present supervisor differ in
  form, not in what has to change.
- `EQP` Equipment & facilities → **Resources**. "We do not have it" and "what
  we have is not fit" are the same purchase order.
- `COM` Communication → **Leadership**. A communication failure in an audit
  is almost always management not telling people something; it is not its own
  fix.
- `SUB` Subcontractor control → **dropped as a cause.** This is the one
  judgement call worth arguing about, so it is flagged below. The reasoning:
  subcontractor management is *where* a finding sits (checklist area B6), not
  *why* it happened. A missing subcontractor assessment is a Documentation
  failure in area B6. Keeping it as a cause mixes the two axes and would
  double-count the programme's single worst area.

`GOOD` stays, outside the seven, for a positive observation.

## How the charts must look

From the visualization reference, and these are checks rather than taste:

- **Rounded, thin, quiet.** 4px rounded data-ends anchored to the baseline,
  2px lines, hairline grid, generous padding. No thick saturated blocks.
- **No dual axes, ever.** Two measures of different scale become two charts.
- **Seven classes maximum** carrying meaning. Past that it is a table.
- **Colour follows the entity, never its rank** — a filter that changes the
  list must not repaint the survivors.
- **Status colour only where the colour means good or bad**, always with a
  label beside it, never colour alone.
- **One series needs no legend**; two or more always have one.
- **Hover on every mark.** A chart in a browser is interactive by default.
- **Dark mode is chosen, not flipped** — its own steps, validated against the
  dark surface.
- **Run `scripts/validate_palette.js`** before shipping any palette. Do not
  eyeball colourblind safety.

## The checklist

Each item is a separate piece of work with its own verification.

**Structure**

- [x] 1. Remove the "dashboard is ONE chart" rule and the `100dvh` lock; the
      board becomes a KPI row plus two sub-region panels.
- [x] 2. Facet the board by sub-region, so each director sees their own
      contractors without using a filter.
- [x] 3. Default every view to the latest quarter.
- [x] 4. Give each drill-down level its own layout instead of one shared
      floating panel.

**Level 0 — the board**

- [x] 5. KPI row: four stat tiles, numbers not charts.
- [x] 6. Horizontal bar list per sub-region, worst first, 90% target marked
      once per panel rather than on every row.
- [x] 7. Verify no sideways scroll 320–1440px and that the board no longer
      forces the viewport height.

**Level 1 — one contractor**

- [x] 8. Hero: score, band, change, sparkline.
- [x] 9. "Where": A / B / C.
- [x] 10. "Why": the seven categories.
- [x] 11. "Is it sticking": recurring versus new.
- [x] 12. Weakest-areas list as the way into level 2.

**Level 2 — the detail**

- [x] 13. The written detail: what is missing, which questions, which
      quarters.

**Categories**

- [x] 14. Reduce `issues.ts` to the seven, keeping `readIssues()` so records
      written against the old twelve still load and map to their nearest
      survivor.
- [x] 15. Update the entry form's picker and every count derived from
      categories.

**Inputs**

- [x] 16. Drop the future quarter from `quarterOptions()`.
- [x] 17. Simplify the 81-question entry form.

**Craft**

- [x] 18. Remove the remaining explanatory prose from levels 0 and 1.
- [x] 19. Validate the palette with the script, light and dark.
- [x] 20. Screenshot every screen and check it against the anti-pattern list
      before calling it done.

## Status

Built 2026-10-14. Every item above is done; items 14 and 16 landed in the
previous commit. Verified: 161 tests, typecheck and build clean, no sideways
scroll from 320px to 1440px across eight pages and both drill-downs, both
themes render, and the bar fills measure 4.41:1 to 13.9:1 against their track
(the 3:1 floor for a UI mark) with the score printed on every row so colour
is never the only channel.

Two of the four questions below were answered: recurrence is two consecutive
audits, and the Excel data is the demo data. The remaining two were taken on
my recommendation and can still be reversed — "where" is sections A/B/C, and
subcontractor control stays an area rather than becoming an eighth category.

## Open questions

1. **"Where" — which three?** The source workbooks use PART 1 (the 81-question
   checklist), PART 2 (the scoring summary) and PART 3 (the observations), so
   "which part" cannot separate observations: they are all PART 3. I believe
   the useful three are the checklist's own sections — **A Management**
   (office and systems), **B Process & Procedures** (site execution),
   **C Planning & Commitment** (leadership and planning). Confirm, or tell me
   the three you meant.

2. **Subcontractor control** — dropped as a cause and kept as an area, for
   the reason above. It is the programme's worst area at 25%, so it stays
   highly visible either way. Say if you want it back as an eighth category.

3. **"Recurring" — at what grain?** Recurrence is tracked question by
   question, and the imported quarters have no per-question answers, so today
   it can only be computed per **area** (did B6 stay weak from Q4 into Q1).
   Area-level is honest and available now. Question-level needs the 1,255
   PART 3 comments classified first. Which do you want for this redesign?

4. **Demo data.** "Put all of the demo until everything is aligned" — I read
   that as: fill every screen with realistic sample data so the design can be
   finished against full data, including the views that are empty today, and
   connect Supabase afterwards. If so, the sample data must be unmistakable
   on screen so nobody mistakes it for a real audit, and it must come out
   before anyone is shown the system. Confirm that reading, and whether the
   19 real audits stay alongside it or are set aside during the design.
