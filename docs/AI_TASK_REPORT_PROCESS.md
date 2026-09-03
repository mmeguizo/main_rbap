# AI Task Reporting — Process

Purpose

- Ensure every task (TODO → In Progress → Done) has a small, searchable report file that documents what was done, who did it, and when it finished.
- Make it easy to produce monthly/quarterly client-facing rollups by collecting per-task summaries.

Location & naming

- Store per-task reports in `reports/tasks/` in the repository.
- Recommended filename pattern: `YYYY-MM-DD-<TASKID>-<short-slug>.md` or `<TASKID>-<short-slug>.md` if a date prefix is not desired.
  - Example: `reports/tasks/2026-07-07-OTV-1-add-office-tree.md`

When to update

- Create the per-task file when work starts, or create it as a draft when the task is assigned.
- Update the file on each meaningful milestone (started, major progress, blocked, done).
- At minimum: update when the task is marked `Done` — include completed date, PR/commit links, and a client-facing one-line summary.

Ownership & process

- The agent or developer who performs the work is responsible for updating the report file before opening the final PR or immediately after merging (preferred: include report updates in the same PR that implements the change).
- If multiple agents collaborate, each agent append entries to the `Work log` section with ISO dates and short notes.

Required fields (in every per-task report)

- Task ID: unique identifier (issue number, OTV-1, POL-2, etc.)
- Title: short descriptive title
- Owner: `@github-user` or agent name
- Status: `todo | in-progress | blocked | done`
- Start Date: ISO date
- Completed Date: ISO date (set when status=done)
- Client-facing summary: 1–2 sentence plain-language description for stakeholders
- Work log: chronological bullets (date — short note)
- PR / Commit links: list of PRs or commits implementing the work
- Files changed: short list of primary files touched
- Time spent (optional): hours
- Tags / milestone: e.g., `OTV-1`, `REP-2`, `P1`

Optional fields

- QA notes, manual test steps, follow-ups, blockers, references to design docs or tickets.

Template usage

- Copy `docs/AI_TASK_REPORT_TEMPLATE.md` into `reports/tasks/` and fill the fields as the work progresses.
- Always include a `Client-facing summary` (this is the text used in monthly rollups).

Monthly / quarterly rollups (manual)

1. Create `reports/monthly/YYYY-MM.md` for the month.
2. For each per-task report whose `Completed Date` falls within the month, copy the `Client-facing summary` and the `Completed Date`, plus the `Task ID` and `Owner`.
3. Add a short aggregate section with totals (tasks completed, story points/hours, notable achievements).

Automation suggestions (optional)

- Add a small Node script that reads markdown frontmatter / top metadata (or parses the `Completed Date:` line) and generates a monthly rollup automatically under `reports/monthly/`.
- Add a GitHub Action to run on the 1st of each month to create a draft monthly report.

Examples & conventions

- Keep the client-facing summary brief and non-technical.
- Link PRs and commits so reviewers can navigate to implementation evidence.
- Prefer ISO dates (`YYYY-MM-DD`) for easy sorting and filtering.

Questions to answer now

- Do you want me to scaffold the `reports/tasks/` directory and create an example report for one existing task?
- Do you want a small automation script to generate monthly rollups (Node + `gray-matter`) next?

---

(See `docs/AI_TASK_REPORT_TEMPLATE.md` for the file template to copy into `reports/tasks/`.)
