#!/usr/bin/env bash
# Downloads and verifies a reference database, per PLAN.md §2.3.
# Usage: ./bin/download-dbs.sh <variant> [target_dir]
#   variant: viral, standard_08_GB (Kraken2), checkv (CheckV), genomad (geNomad),
#            mash_refseq (Mash RefSeq sketch DB, WGS pipeline pre-flight screening)
#            - others land here as later milestones need them, see
#            docs/planning/PLAN.md §2.3 for the full variant table and URLs.
#   target_dir: defaults per-family (~/microbox-dbs/<kraken2|checkv|genomad|mash>,
#               deliberately outside the repo - DBs are never committed,
#               PLAN.md §6.3 Git hygiene - and outside /mnt/c, same
#               ext4-not-Windows-mount reasoning as workDir,
#               docs/KNOWN_ISSUES.md #9)
set -euo pipefail

VARIANT="${1:?Usage: download-dbs.sh <variant> [target_dir]  (variants: viral, standard_08_GB, checkv, genomad, mash_refseq)}"

case "$VARIANT" in
  viral|standard_08_GB) DEFAULT_TARGET_DIR="$HOME/microbox-dbs/kraken2" ;;
  checkv)                DEFAULT_TARGET_DIR="$HOME/microbox-dbs/checkv" ;;
  genomad)               DEFAULT_TARGET_DIR="$HOME/microbox-dbs/genomad" ;;
  mash_refseq)           DEFAULT_TARGET_DIR="$HOME/microbox-dbs/mash" ;;
  *)                     DEFAULT_TARGET_DIR="$HOME/microbox-dbs/$VARIANT" ;;
esac
TARGET_DIR="${2:-$DEFAULT_TARGET_DIR}"

# Mash's RefSeq sketch DB (PLAN.md §6.9, WGS pipeline pre-flight species/
# contamination screening) - a single static .msh file, not a .tar.gz
# archive, so it gets its own early branch rather than forcing it through
# the generic curl+sha256+tar-extract shape below (that shape assumes an
# archive to extract; this file is used as-is). Real, official, verified
# reachable 2026-09-14 (HTTP 200, Content-Length 754,115,096 bytes) -
# checksum pinned from this project's own first download, same "no vendor-
# published plain sha256 exists" reasoning as the Kraken2 variants below
# (Mash's own site publishes no checksum for this file either).
if [[ "$VARIANT" == "mash_refseq" ]]; then
  mkdir -p "$TARGET_DIR"
  URL="https://gembox.cbcb.umd.edu/mash/refseq.genomes.k21s1000.msh"
  SHA256="7a0279d8846050d0514f79883a4c82b0d1d29e41329b734edb65098dbf672be4"
  DEST="$TARGET_DIR/refseq.genomes.k21s1000.msh"

  if [[ -f "$DEST" ]]; then
    echo "Already downloaded: $DEST"
  else
    echo "Downloading $URL (~754MB) ..."
    curl -L -C - -o "$DEST" "$URL"
  fi

  echo "Verifying checksum..."
  ACTUAL_SHA256=$(sha256sum "$DEST" | cut -d' ' -f1)
  if [[ "$ACTUAL_SHA256" != "$SHA256" ]]; then
    echo "CHECKSUM MISMATCH for $DEST" >&2
    echo "  expected: $SHA256" >&2
    echo "  actual:   $ACTUAL_SHA256" >&2
    exit 1
  fi
  echo "Checksum OK."

  echo ""
  echo "Set params.mash_refseq_db to: $DEST"
  exit 0
fi

# geNomad and CheckV both use their own tool's official downloader rather
# than a direct curl against a static URL:
#   - geNomad has no stable static URL/checksum to pin at all - officially,
#     the only documented way to get its database is the tool's own
#     downloader (https://portal.nersc.gov/genomad/installation.html:
#     "genomad download-database ."), which needs the container itself and
#     does its own fetch/integrity handling internally.
#   - CheckV DOES have a stable URL (portal.nersc.gov/CheckV/checkv-db-v1.5.
#     tar.gz), but a direct curl against it measured ~20KB/s on 2026-09-12
#     (20+ hours for 1.57GB) and dropped the connection outright under
#     HTTP/2 (curl exit 92) before finishing anyway. CheckV's own `checkv
#     download_database <dir>` command hit >2MB/s instead - same content,
#     same URL host in the tool's own source, evidently just not subject to
#     whatever throttled the direct URL from this network.
# Both version-locked via their pinned container tags (genomad 1.12.0,
# checkv 1.0.3 - confirmed DB-compatible per PLAN.md §6.8 item 11 and this
# script's own case entry below) rather than a hand-verified archive
# checksum - a genuinely different acquisition shape from the curl+sha256
# pattern below for Kraken2, not a shortcut around it. Handled as an early,
# separate branch instead of forcing either into a case shape it doesn't fit.
if [[ "$VARIANT" == "genomad" || "$VARIANT" == "checkv" ]]; then
  mkdir -p "$TARGET_DIR"
  case "$VARIANT" in
    genomad)
      MARKER_DIR="$TARGET_DIR/genomad_db"
      IMAGE="community.wave.seqera.io/library/genomad:1.12.0--27836e6e665e84b5"
      DL_CMD=(genomad download-database .)
      PARAM_NAME="genomad_db"
      ;;
    checkv)
      MARKER_DIR="$TARGET_DIR/checkv-db-v1.5"
      IMAGE="quay.io/biocontainers/checkv:1.0.3--pyhdfd78af_0"
      DL_CMD=(checkv download_database .)
      PARAM_NAME="checkv_db"
      ;;
  esac

  if [[ -d "$MARKER_DIR" && -n "$(ls -A "$MARKER_DIR" 2>/dev/null)" ]]; then
    echo "Already downloaded: $MARKER_DIR"
  else
    echo "Downloading via ${VARIANT}'s own database downloader ($IMAGE)..."
    # -u $(id -u):$(id -g): without this, checkv's container (unlike
    # genomad's) wrote its output owned by an internal container uid with
    # no group/other read access at all - found 2026-09-12, the download
    # completed but the result was completely unreadable outside the
    # container afterward. Same user-mapping this project's own
    # `docker.runOptions` already applies to every pipeline task
    # (nextflow.config's `docker` profile) - applying it here too keeps
    # the downloaded DB owned by whoever ran this script, not root/some
    # internal container id.
    docker run --rm -u "$(id -u):$(id -g)" -v "$TARGET_DIR:/db" -w /db "$IMAGE" "${DL_CMD[@]}"
    echo "Downloaded to $MARKER_DIR"
  fi
  echo ""
  echo "Set params.$PARAM_NAME to: $MARKER_DIR"
  exit 0
fi

case "$VARIANT" in
  viral)
    URL="https://genome-idx.s3.amazonaws.com/kraken/k2_viral_20260626.tar.gz"
    # No vendor-published checksum exists for this file (S3 only exposes a
    # multipart ETag, not comparable to a plain sha256sum) - pinned from our
    # own first download instead, verified 2026-09-11.
    SHA256="202ec0ee8e7ea9d83edf02e77d400ec1ddc70157e0fad45988ed442a2af1c3f7"
    ;;
  standard_08_GB)
    URL="https://genome-idx.s3.amazonaws.com/kraken/k2_standard_08_GB_20260626.tar.gz"
    # Same reasoning as the viral variant: no vendor-published plain sha256
    # exists for this file, only an S3 multipart ETag - pinned from our own
    # download instead, verified 2026-09-11 during real-data (ZymoBIOMICS
    # Mock Community) truth-validation testing, docs/KNOWN_ISSUES.md
    # "Real-data validation" entry. Capacity/RAM (~8GB DB, needs a machine
    # with enough free RAM to load it - dev-tier truth validation was
    # otherwise dropped per PLAN.md §1.1) is why this is the smallest
    # standard-taxonomy tier, not the default `standard` (~50GB+) variant.
    SHA256="b17d05ca1459564b49b63d014c4b2ee6ebe1ca0143e6c184e0dfd6d940a55981"
    ;;
  standard_16_GB|pluspf_16_GB|standard)
    echo "Variant '$VARIANT' isn't wired up yet - not needed until a later milestone (full-DB testing happens on AWS, PLAN.md §2.3/§6.3). Add its URL + pinned checksum here when that milestone starts." >&2
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
  # --http1.1: defensive - a direct curl against a different NERSC-hosted
  # URL (CheckV's, now fetched via its own downloader above instead) hit a
  # mid-transfer HTTP/2 reset (curl exit 92) on 2026-09-12; forcing HTTP/1.1
  # is the standard workaround for that class of HTTP/2-incompatible
  # server, kept here too in case genome-idx.s3.amazonaws.com ever behaves
  # the same way. -C -: resume a partial download rather than restarting
  # from zero if this is a second attempt after an interruption.
  curl -L --http1.1 -C - -o "$ARCHIVE" "$URL"
fi

if [[ "$SHA256" == "__PENDING_FIRST_DOWNLOAD__" ]]; then
  echo "No checksum pinned yet for this variant - printing the actual sha256 so it can be pinned in this script:" >&2
  sha256sum "$ARCHIVE" >&2
  exit 1
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
case "$VARIANT" in
  viral|standard_08_GB) echo "Set params.kraken2_db to: $EXTRACT_DIR" ;;
  *)                    echo "Extracted to: $EXTRACT_DIR" ;;
esac
