#!/usr/bin/env bash
# Check that RESEARCH_KEY opens the archive and that it has not been changed, without writing any plaintext.
# Prints only a file count: workflow logs in a public repository are public.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/research-lib.sh
verify_mac
n=$(decrypt_to_stdout | tar -tzf - | grep -vc '/$') || { echo "The archive passed its HMAC check but could not be read." >&2; exit 1; }
echo "The research archive is unchanged, opens with RESEARCH_KEY, and holds $n files."
