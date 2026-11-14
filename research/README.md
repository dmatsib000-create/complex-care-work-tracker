# Research archive (encrypted)

`research.tar.gz.enc` holds the cited research reports and notes behind the tracker's default task buttons and roles. It is encrypted with AES-256 (OpenSSL, PBKDF2 with 600,000 iterations), so its contents are not readable in this public repository.

The key is stored as the repository secret `RESEARCH_KEY`. GitHub never shows a secret again after it is saved, so keep a copy of the key in a password manager as well: without it the archive cannot be opened.

## Read the research

On a Mac or Linux computer with a copy of this repository:

```bash
RESEARCH_KEY='paste the key here' scripts/decrypt-research.sh
```

The files appear in `private/`, which git ignores, so they are never committed by accident.

## Change the research

Edit the files in `private/`, then:

```bash
RESEARCH_KEY='paste the key here' scripts/encrypt-research.sh
```

Commit only `research/research.tar.gz.enc`.

## Check that the secret matches

The "Check research archive" workflow (Actions tab) decrypts the archive with the `RESEARCH_KEY` secret and reports only whether it worked and how many files it holds. It never prints file names or contents, because workflow logs in a public repository are public.
