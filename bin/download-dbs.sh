#!/usr/bin/env bash
# Downloads and verifies a reference database, per PLAN.md §2.3.
# Usage: ./bin/download-dbs.sh <variant> [target_dir]
#   variant: viral (others land here as later milestones need them - see
#            docs/planning/PLAN.md §2.3 for the full variant table and URLs)
#   target_dir: defaults to ~/microbox-dbs/kraken2 (deliberately outside the
#               repo - DBs are never committed, PLAN.md §6.3 Git hygiene -
#               and outside /mnt/c, same ext4-not-Windows-mount reasoning as
#               workDir, docs/KNOWN_ISSUES.md #9)
set -euo pipefail

VARIANT="${1:?Usage: download-dbs.sh <variant> [target_dir]  (variants: viral)}"
TARGET_DIR="${2:-$HOME/microbox-dbs/kraken2}"

case "$VARIANT" in
  viral)
    URL="https://genome-idx.s3.amazonaws.com/kraken/k2_viral_20260626.tar.gz"
    # No vendor-published checksum exists for this file (S3 only exposes a
    # multipart ETag, not comparable to a plain sha256sum) - pinned from our
    # own first download instead, verified 2026-09-11.
    SHA256="202ec0ee8e7ea9d83edf02e77d400ec1ddc70157e0fad45988ed442a2af1c3f7"
    ;;
  standard_08_GB|standard_16_GB|pluspf_16_GB|standard)
    echo "Variant '$VARIANT' isn't wired up yet - not needed until a later milestone (dev truth-validation was dropped, PLAN.md §1.1; full-DB testing happens on AWS, §2.3/§6.3). Add its URL + pinned checksum here when that milestone starts." >&2
    exit 1
    ;;
  *)
    echo "Unknown variant: $VARIANT" >&2
    exit 1
    ;;
esac

mkdir -p "$TARGET_DIR"
ARCHIVE="$TARGET_DIR/$(basename "$URL")"

if [[ -f "$ARCHIVE" ]]; then
  echo "Already downloaded: $ARCHIVE"
else
  echo "Downloading $URL ..."
  curl -L -o "$ARCHIVE" "$URL"
fi

echo "Verifying checksum..."
ACTUAL_SHA256=$(sha256sum "$ARCHIVE" | cut -d' ' -f1)
if [[ "$ACTUAL_SHA256" != "$SHA256" ]]; then
  echo "CHECKSUM MISMATCH for $ARCHIVE" >&2
  echo "  expected: $SHA256" >&2
  echo "  actual:   $ACTUAL_SHA256" >&2
  exit 1
fi
echo "Checksum OK."

EXTRACT_DIR="$TARGET_DIR/$VARIANT"
if [[ -d "$EXTRACT_DIR" && -n "$(ls -A "$EXTRACT_DIR" 2>/dev/null)" ]]; then
  echo "Already extracted: $EXTRACT_DIR"
else
  mkdir -p "$EXTRACT_DIR"
  tar -xzf "$ARCHIVE" -C "$EXTRACT_DIR"
  echo "Extracted to $EXTRACT_DIR"
fi

echo ""
echo "Set params.kraken2_db to: $EXTRACT_DIR"
