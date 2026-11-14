#!/usr/bin/env bash
# Decrypt research/research.tar.gz.enc into private/ (ignored by git, so the plaintext is never committed).
# The key is read from the RESEARCH_KEY environment variable.
# Usage:  RESEARCH_KEY='...' scripts/decrypt-research.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${RESEARCH_KEY:?Set RESEARCH_KEY to the research key first}"
mkdir -p private
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -pass env:RESEARCH_KEY \
    -in research/research.tar.gz.enc \
  | tar -xzf - -C private
echo "Decrypted into private/."
