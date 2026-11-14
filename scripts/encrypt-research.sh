#!/usr/bin/env bash
# Pack the plaintext research in private/ into one encrypted file, research/research.tar.gz.enc.
# The key is read from the RESEARCH_KEY environment variable (the same value as the repository secret).
# Usage:  RESEARCH_KEY='...' scripts/encrypt-research.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${RESEARCH_KEY:?Set RESEARCH_KEY to the research key first}"
[ -d private ] || { echo "Nothing to encrypt: private/ does not exist." >&2; exit 1; }
mkdir -p research
tar -czf - -C private . \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt -pass env:RESEARCH_KEY \
      -out research/research.tar.gz.enc
echo "Wrote research/research.tar.gz.enc. Commit that file only; private/ is ignored by git."
