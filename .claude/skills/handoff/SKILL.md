---
name: handoff
description: End a work session cleanly — record what was done, what remains, and what to pick up next in docs/PROGRESS.md, commit, and confirm it is safe to /clear. Use when the user says they are done, wants to hand off, wants to clear the session, or has finished a task.
---

# Handoff

Close out the session so the next one starts cold with zero loss. The next session
will read **only** `CLAUDE.md` and `docs/PROGRESS.md` — if a fact is not written into
one of those, it is gone.

## Guiding rule

Write for a competent stranger with no memory of this conversation. Not for yourself.
Anything you would have to re-derive by reading code or git log belongs in the file.

## Steps

### 1. Establish what actually happened

Do not trust recollection alone. Check:

```bash
git status --short
git log --oneline -5
git diff --stat HEAD
```

Identify: which task ID was worked on, what is genuinely finished, what is
half-finished, and what was discovered along the way.

### 2. Finish or fence the work

- If the task is complete: run its tests/checks, then commit.
- If it is **not** complete: do not fake completion. Either commit the partial work
  with a clear message, or leave it uncommitted — but record the exact state in
  PROGRESS.md so the next session can resume without re-reading everything.
- Never leave a broken conformance suite or failing test unrecorded. If it is red,
  say so in PROGRESS.md under **Now → Blocked on**.

### 3. Update `docs/PROGRESS.md`

This is the substance of the handoff. Update every part that changed:

- **Header** — bump `Last updated` and `Sessions completed`; update `Current sprint`.
- **Now** — set the next task ID, its status, and anything blocking it. If the last
  task is partially done, `Next task` is that same task, and the status line must say
  precisely what remains (file paths, function names, the specific failing case).
- **Task board** — flip markers: `[ ]` → `[>]` → `[x]`. Use `[!]` for blocked with a
  one-line reason inline, `[~]` for cut/deferred.
- **Decisions log** — append one line per decision made this session that a future
  session must not re-litigate. Date it. Keep it to one line.
- **Open questions** — add anything discovered that needs an answer; tick off
  anything resolved (and move the resolution into Decisions).
- **Parked** — anything noticed but deliberately not done. Include enough detail to
  action it later without rediscovery.
- **Needed from user** — pending questions, so the next session can ask them early.

Keep the file terse. It is read in full every session. Prune stale lines rather than
letting it accumulate.

### 4. Update persistent memory — only for durable facts

Write to memory **only** if something emerged that is true beyond this project's task
board: a user preference, a workflow correction, a hard environment constraint.
Routine task progress goes in PROGRESS.md, never in memory.

### 5. Commit

```bash
git add -A
git commit -F - <<'EOF'
<subject: what changed, imperative>

<body: why, and anything a reviewer needs>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

Commit directly to `main` — solo repo, single branch, no remote.

### 6. Report and hand off

Give the user, in this order and nothing else:

1. **Done this session** — 2–4 bullets, concrete.
2. **Not done / left open** — be explicit. If something is red, lead with it.
3. **Next task** — the ID and one line on what it involves.
4. **Anything you need from them** before the next session.
5. The literal line: `Safe to /clear. Next session: run /pickup.`

Do not summarise the whole project. Do not restate the plan. The next session reads
the files.

## Do not

- Do not mark a task `[x]` you did not verify. A task whose tests were not run is
  `[>]`, not done.
- Do not write the plan's content into PROGRESS.md. Reference the section (`plan §7.2`).
- Do not let PROGRESS.md grow unboundedly — prune resolved questions and stale parked
  items as you go.
