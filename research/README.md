# Research archive (encrypted)

`research.tar.gz.enc` holds the cited research reports and notes behind the tracker's default task buttons and roles. It is encrypted with AES-256 (OpenSSL, PBKDF2 with 600,000 iterations), so its contents are not readable in this public repository. `research.tar.gz.enc.hmac` is an HMAC-SHA256 of the encrypted file, keyed from the same secret: if the archive is changed or damaged, the scripts refuse it before decrypting anything.

The key is stored as the repository secret `RESEARCH_KEY`. GitHub never shows a secret again after it is saved, so keep a copy of the key in a password manager as well: without it the archive cannot be opened.

The scripts need only `bash` and `openssl`, which come with macOS and Linux.

## Read the research

In a copy of this repository, type the first line, paste the key when the cursor waits (nothing is shown, and the key is not saved in your shell history), and press Enter:

```bash
read -rs RESEARCH_KEY && export RESEARCH_KEY
```

```bash
scripts/decrypt-research.sh
```

The files appear in `private/`, which git ignores, so they are never committed by accident.

## Change the research

Edit the files in `private/`, set the key as above, then:

```bash
scripts/encrypt-research.sh
```

Commit both `research/research.tar.gz.enc` and `research/research.tar.gz.enc.hmac`.

## Check that the secret matches

The "Check research archive" workflow (Actions tab) runs `scripts/check-research.sh` with the `RESEARCH_KEY` secret. It checks the HMAC, decrypts in memory, and reports only whether that worked and how many files the archive holds. It never prints file names or contents, because workflow logs in a public repository are public.
