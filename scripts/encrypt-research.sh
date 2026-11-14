#!/usr/bin/env bash
# Pack the plaintext research in private/ into research/research.tar.gz.enc and write its HMAC.
# Usage (the key is typed without being shown or saved in shell history):
#   read -rs RESEARCH_KEY && export RESEARCH_KEY && scripts/encrypt-research.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/research-lib.sh
[ -d private ] || { echo "Nothing to encrypt: private/ does not exist." >&2; exit 1; }
mkdir -p research
tar -czf - -C private . \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt -pass env:RESEARCH_KEY -out "$ARCHIVE"
mac_of "$ARCHIVE" > "$MACFILE"
echo "Wrote $ARCHIVE and $MACFILE. Commit both; private/ is ignored by git."
