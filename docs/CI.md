# CI (GitHub Actions)

## What this is

Every time code is pushed to `main` (or a pull request is opened against it), GitHub automatically runs `.github/workflows/ci.yml` — a small robot that:

1. Checks out the code
2. Installs dependencies (`npm install`)
3. Builds the frontend (`npm run build -w frontend`) — catches broken React/JS before it ever reaches `main`
4. Syntax-checks every backend service and the shared package

No servers to manage — GitHub runs it for you, for free.

## Why this exists (for the RCA project)

This isn't about making the app "live" on the internet — see `docs/RUNNING.md` for that distinction. This exists purely to create a **real build history**: every push produces a timestamped run, tied to a specific commit, with pass/fail status and logs. That's the same shape of evidence your RCA architecture doc's worked example depends on — *"build #4821 deployed at T-31min, built from commit cf8a2d1"* — except here it's GitHub Actions' history instead of Jenkins's.

## Where to look at it

- **On GitHub:** repo → **Actions** tab — every run, its commit, timestamp, and pass/fail.
- **Via the `gh` CLI:** `gh run list` (recent runs), `gh run view <run-id>` (details/logs for one run).

## What this is *not* (yet)

There's no deploy step — nothing actually ships anywhere at the end of this workflow, because the app doesn't have a live hosting target yet (it only runs locally). If/when we decide to put the app somewhere real (Vercel, Render, etc.), a deploy step gets added to the end of this same workflow.
