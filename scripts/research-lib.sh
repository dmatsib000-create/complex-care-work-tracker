# Shared by the research scripts. Not run on its own.
# The archive is encrypted with AES-256-CBC (OpenSSL, PBKDF2) and then authenticated with HMAC-SHA256
# (encrypt-then-MAC), so a changed or damaged archive is refused before anything is decrypted.
# The HMAC key is derived from RESEARCH_KEY by hashing; the key itself is never put on a command line.
ARCHIVE=research/research.tar.gz.enc
MACFILE=research/research.tar.gz.enc.hmac
: "${RESEARCH_KEY:?Set RESEARCH_KEY to the research key first (see research/README.md)}"

mac_of(){ # mac_of FILE -> hex HMAC-SHA256 of FILE
  local mackey
  mackey=$(printf 'research-archive-mac:%s' "$RESEARCH_KEY" | openssl dgst -sha256 | awk '{print $NF}')
  openssl dgst -sha256 -hmac "$mackey" "$1" | awk '{print $NF}'
}
verify_mac(){ # exits non-zero unless the archive matches its HMAC
  [ -f "$ARCHIVE" ] && [ -f "$MACFILE" ] || { echo "The archive or its .hmac file is missing." >&2; return 1; }
  [ "$(mac_of "$ARCHIVE")" = "$(tr -d '[:space:]' < "$MACFILE")" ] \
    || { echo "The archive does not match its HMAC: wrong key, or the file was changed. Nothing was decrypted." >&2; return 1; }
}
decrypt_to_stdout(){ openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -pass env:RESEARCH_KEY -in "$ARCHIVE"; }
