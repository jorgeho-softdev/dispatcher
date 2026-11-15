---
name: changelog-entry
description: Add or update an entry in CHANGELOG.md. Use proactively after ANY user-visible code change in this repo, not just when asked.
---

# CHANGELOG.md entries

`CHANGELOG.md` exists so store "What's New" text is written from something
concrete. New entries always go at the bottom of **Unreleased**.

## Entry format

One bullet per logical change, starting with `Added:`, `Changed:`,
`Fixed:` or `Removed:`. Write for a future reader who wasn't in this
conversation: the user-visible symptom AND the reason/root cause when
non-obvious. Multi-line bullets are fine.

> - Fixed: logging a weight in lbs could drift by a pound (50 → 51) —
>   it was rounded when converting to kg for storage and again when
>   converting back. Now it only rounds once, at display time.

Not "Fixed rounding bug."

## Releasing

Only when the user confirms a build was submitted: retitle the Unreleased
contents into `## X.Y.Z (build N) — submitted YYYY-MM-DD` below a `---`
separator, and start a fresh empty Unreleased section above it. Never edit
released sections except to correct a factual error.
