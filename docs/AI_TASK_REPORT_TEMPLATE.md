---
# Use this template for every task report (copy into `reports/tasks/`)
# Keep the YAML-like header short and human-friendly
---

# Task: <TASK ID> — <Short Title>

- Task ID: <TASK-ID or issue#>
- Title: <Short descriptive title>
- Owner: <@github-user or agent name>
- Status: <todo | in-progress | blocked | done>
- Start Date: <YYYY-MM-DD>
- Completed Date: <YYYY-MM-DD or empty if not completed>
- Tags: [e.g., OTV-1, backend]
- Time Spent (hours): <optional>
- PR(s):
  - <https://github.com/.../pull/123>
- Commit(s):
  - <abcdef123456>

## Client-facing summary

A 1–2 sentence summary suitable for the client describing what changed and why.

## Description

A short technical description of the change and the task's acceptance criteria.

## Work log

- YYYY-MM-DD — Started work (short note)
- YYYY-MM-DD — Implemented X, added Y (short note)
- YYYY-MM-DD — Completed and QA passed

## Files changed (primary)

- `backend/src/...` — what was changed
- `shadcn/...` — frontend change

## PRs & Commits

- PR: <URL>
- Commits:
  - <sha> — short commit message

## QA / Testing notes

- Manual steps performed
- Automated tests added/updated

## Follow-ups / Next steps

- Any follow-up tasks or cleanup items

## Approval

- Approved by: <@reviewer>
- Approved date: <YYYY-MM-DD>
