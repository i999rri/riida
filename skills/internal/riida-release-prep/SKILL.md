---
name: riida-release-prep
description: Cut a riida release on a `release/x.y.z` branch — bump the app version, update the changelog, regenerate bundled third-party license notices, verify, then merge the pull request once every CI check is green and tag the merge commit. Use when the user asks to prepare the next version, cut or tag a release, refresh release metadata, or make sure versioned files are consistent.
metadata:
  internal: true
---

# Riida Release Prep

Release work happens on a `release/x.y.z` branch and reaches `master` only
through a pull request whose checks are all green. `master` takes no direct
push during a release — the PR gate is what proves the release builds
somewhere other than one developer's machine.

Work through the steps in order.

## 1. Start the Release Branch

Decide the next semantic version first, then branch from an up-to-date
`master`:

```bash
git switch master && git pull && git switch -c release/x.y.z
```

Everything below happens on that branch.

## 2. Update Release Metadata

Update these files together:

- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `src/main.ts`

`src-tauri/Cargo.lock` follows `src-tauri/Cargo.toml` via
`cargo update -p riida --manifest-path src-tauri/Cargo.toml`, never by hand.

Changelog rules:

- Write the changelog for humans, not machines.
- Add an entry for every released version.
- Keep the newest released version directly below `Unreleased`.
- Add a new `## [x.y.z] - YYYY-MM-DD` section.
- Use Keep a Changelog section headings as needed: `Added`, `Changed`,
  `Deprecated`, `Removed`, `Fixed`, and `Security`.
- Group the same kinds of changes under the same section heading.
- Keep entries user-facing. Internal refactors belong in the changelog only
  when a user can notice them.
- Keep version headings and bottom-of-file links consistent so releases and
  compare ranges stay linkable.
- Preserve the release date in every version heading.
- Preserve the existing Semantic Versioning note at the top.
- Update the `[Unreleased]` compare link and add the new release link at the
  bottom.

## 3. Regenerate Bundled License Notices

Always regenerate, even when no dependency looks like it moved:

```bash
nix --extra-experimental-features 'nix-command flakes' develop --command npm run generate:third-party-licenses
```

`THIRD-PARTY-LICENSES-rust.md` and `THIRD-PARTY-LICENSES-js.md` join the
release-prep commit when they change.

## 4. Verify Locally

```bash
nix --extra-experimental-features 'nix-command flakes' develop --command npm run check:release
```

A green local run predicts CI without guaranteeing it, and the gap is the
reason the PR gate exists:

- `check:release` runs under the dev shell's pinned rustc, while CI resolves
  `dtolnay/rust-toolchain@stable`. Clippy gains lints between releases, so a
  new one fails the PR while the dev shell stays quiet.
- CI installs the newest `cargo-deny`, whose CLI has moved flags between
  major versions.
- The `cargo deny` license check runs only in CI; `check:release` omits it.

Treat a local failure as work to finish before committing, not as a reason to
wait for CI.

## 5. Commit

Prefer a single release-prep commit carrying the version bumps, the changelog
entry, and the regenerated notices:

```text
Bump up version to x.y.z
```

Verification cleanup — formatting, a lint fix, an unrelated repair the checks
surfaced — goes in its own commit, ordered before the bump. `Bump up version
to x.y.z` is the branch's final commit.

## 6. Open the PR and Take It Green

```bash
git push -u origin release/x.y.z
gh pr create --base master --title "Bump up version to x.y.z" --body "<summary>"
gh pr checks --watch
```

Write the PR body in Japanese, as the previous release PRs do: what the
version bump touched, the changelog entries in brief, and how the release was
verified. Commit messages stay English.

This step is done when `gh pr checks` reports every check as a pass, with none
pending. A failure is release work like any other: fix it on the release
branch, then rebase so `Bump up version to x.y.z` remains the final commit.
Force-pushing the release branch is expected — that freedom is exactly what
keeps this work off `master`.

## 7. Merge and Tag

Merge with a merge commit, matching the existing
`Merge pull request #N from zonuexe/release/x.y.z` history:

```bash
gh pr merge <number> --merge
git switch master && git pull
git tag -a vx.y.z -m "riida x.y.z"
git push origin vx.y.z
```

The tag belongs on the merge commit. Pushing a `v*` tag starts the Linux,
macOS, and Windows release workflows, which build the app and publish a
GitHub Release — confirm with the user before that final push.

## Quick Checklist

- Work happened on `release/x.y.z`, and `master` received no direct push.
- Version numbers agree across Rust, npm, Tauri, and the About dialog
  fallback.
- `CHANGELOG.md` describes only user-visible changes.
- Third-party notice files were regenerated.
- `npm run check:release` passed.
- `Bump up version to x.y.z` is the branch's final commit.
- Every check on the PR passed before the merge.
- The annotated tag `vx.y.z` sits on the merge commit.
