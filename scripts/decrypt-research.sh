#!/usr/bin/env bash
# Check the archive's HMAC, then decrypt it into private/ (ignored by git, so the plaintext is never committed).
# Usage (the key is typed without being shown or saved in shell history):
#   read -rs RESEARCH_KEY && export RESEARCH_KEY && scripts/decrypt-research.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/research-lib.sh
verify_mac
mkdir -p private
decrypt_to_stdout | tar -xzf - -C private
echo "Decrypted into private/."
