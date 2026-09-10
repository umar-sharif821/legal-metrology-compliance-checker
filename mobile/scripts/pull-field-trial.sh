#!/usr/bin/env bash
#
# Pull the D-3 field-trial corpus off the phone.
#
# The records live in the app's private storage, so `adb pull` cannot reach them. On a
# debug build the app is debuggable, which is exactly what `run-as` requires, and
# `exec-out` (unlike `shell`) does not mangle binary data — so the JPEGs survive.
#
# Run from `mobile/`:  ./scripts/pull-field-trial.sh
#
# Existing files are overwritten. Re-pulling is the normal way to refresh after another
# packet, and a record already reviewed on the host would be clobbered by the device's
# unreviewed copy — so the script refuses to overwrite a JSON that has grown an `expect`
# block, and says which.

set -euo pipefail

# Git Bash rewrites anything that looks like a Unix path into a Windows one before it
# reaches adb. The remote paths below are relative, which is safe, but the guard costs
# nothing and this project is developed on Windows.
export MSYS_NO_PATHCONV=1

PKG=com.sih26034.lmscan
REMOTE=files/field-trial
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/field-trial"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not on PATH." >&2
  exit 1
fi

state="$(adb get-state 2>&1 || true)"
if [ "$state" != "device" ]; then
  # Naming the state matters: `unauthorized` means accept the prompt on the phone, and
  # `no devices` means plug it in. Reported as one word they get diagnosed as one problem.
  echo "adb reports state '$state' — expected 'device'." >&2
  echo "  unauthorized : unlock the phone and accept 'Allow USB debugging?'" >&2
  echo "  not found    : check the cable, or 'adb connect' over Wi-Fi" >&2
  exit 1
fi

if ! adb exec-out run-as "$PKG" ls -1 "$REMOTE" >/dev/null 2>&1; then
  echo "No $REMOTE on the device for $PKG." >&2
  echo "Record at least one packet first: Freeze, name the packet, Record." >&2
  exit 1
fi

mkdir -p "$DEST"
pulled=0
skipped=0

# `tr -d '\r'` because adb's output arrives with CRLF line endings.
while IFS= read -r name; do
  [ -n "$name" ] || continue
  local_path="$DEST/$name"

  if [ "${name##*.}" = "json" ] && [ -f "$local_path" ] && grep -q '"expect"' "$local_path"; then
    echo "  keep    $name (reviewed here — delete it locally to re-pull)"
    skipped=$((skipped + 1))
    continue
  fi

  adb exec-out run-as "$PKG" cat "$REMOTE/$name" > "$local_path"
  echo "  pulled  $name ($(wc -c < "$local_path" | tr -d ' ') bytes)"
  pulled=$((pulled + 1))
done < <(adb exec-out run-as "$PKG" ls -1 "$REMOTE" | tr -d '\r')

echo
echo "$pulled pulled, $skipped kept, into field-trial/"
echo "Now run 'npm test' from the repo root — every record without an 'expect' block fails,"
echo "by design. Read field-trial/README.md for what to write."
