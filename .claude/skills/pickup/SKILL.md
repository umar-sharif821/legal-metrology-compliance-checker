---
name: pickup
description: Start a work session — read project state, verify the repo is where PROGRESS.md says it is, and begin the next task. Use at the start of a fresh session, or when the user asks what is next, where things stand, or says to continue.
---

# Pickup

Get oriented in as few tokens as possible, then start work. The goal is to be writing
code within a couple of tool calls — not to produce a status report.

## Steps

### 1. Read state

Read `docs/PROGRESS.md` in full. `CLAUDE.md` is already in context.

Do **not** read `docs/IMPLEMENTATION_PLAN_v2.md` wholesale — it is 45 pages. Read only
the sections the current task cites, and only the part you need. Use `grep` to find a
section boundary rather than reading from the top:

```bash
grep -n "^# \[SECTION" docs/IMPLEMENTATION_PLAN_v2.md
```

Then read that line range with `sed -n 'START,ENDp'`.

### 2. Verify reality matches the record

```bash
git status --short
git log --oneline -3
```

If the working tree disagrees with what PROGRESS.md claims — uncommitted changes it
does not mention, or a task marked done whose files do not exist — **say so and stop.**
Reconcile with the user before building on a wrong assumption. This is the one thing
that must not be papered over.

If the last session left something red (failing test, broken conformance suite),
PROGRESS.md will say so under **Now → Blocked on**. Fix that first, before the next
task.

### 3. Confirm the task

State, in three lines maximum:

- The task ID and what it is.
- What it depends on that is already done.
- Anything in **Needed from user** that this task actually requires.

Then start. Do not ask "shall I proceed?" for a task already sequenced on the board —
it is already decided. Ask only if the task genuinely cannot start without an answer,
or if you think the board's next task is the wrong choice and can say why.

### 4. Work the task

- One task per session. If you finish early and the next task is small and clearly
  related, continue — but say so.
- If you notice adjacent problems, do not fix them. Add them to **Parked** in
  PROGRESS.md and keep going.
- Respect the working agreements in `CLAUDE.md` — especially: no statutory value
  hard-coded outside `rulepack/`, both evaluators change together, unreviewed
  thresholds may only emit advisories.
- Consider delegating bounded, well-specified chunks to a subagent (`implementer`,
  `rulepack-author`) to keep this session's context small. Verify what comes back;
  do not accept a subagent's report at face value.

### 5. End with `/handoff`

When the task is done or the session is ending, run the `handoff` skill. Do not
hand-roll the wrap-up.

## Environment reminders

- **Android, physical device, never an emulator.** `npx expo run:android --device`,
  `adb devices`, ADB over Wi-Fi.
- Solo repo, single `main` branch, no remote. Commit directly to `main`.
- Windows host — the Bash tool is Git Bash (POSIX), PowerShell is separate. Use
  forward slashes and `$VAR`.
