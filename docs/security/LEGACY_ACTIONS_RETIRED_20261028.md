# Security cleanup: archived one-off Actions (28 October 2026)

These five inherited, one-off workflows are removed from the active `.github/workflows/` directory:

- `import-motion-comic-page2-title.yml` — one-time external ZIP import with repository write access
- `finalise-motion-comic-page2-title.yml` — one-time code/asset modification and push
- `finalise-motion-comic-v3-assets.yml` — one-time code/asset modification and push
- `wp3-publish-recovery.yml` — one-time embedded patch recovery and push
- `r3-wp2b-copernicus-terrain.yml` — historical terrain-generation commit task

The workflows remain recoverable from Git history. Removing them does not delete any generated art, game code, test files, or the site's current deployment pipeline. They must not be re-enabled without explicit review of what their `contents: write` permission can modify and how external download content is verified.

## Regression gate

1. Check that all five filenames are absent from `.github/workflows/`.
2. Check that `.github/workflows/deploy-pages.yml` still exists.
3. The existing `r3-wp9-integrated-validation.yml` workflow runs on PRs targeting `main`; require its applicable tests/build checks to pass.
4. Treat this as removal of unused execution capabilities; no game feature has been changed.
5. Any future asset import should use a reviewable, branch-scoped pipeline with least-privilege permissions and integrity validation, not a revived old one-off job.

## Rollback

Revert this security PR, after review of the specific workflow, to restore only the needed entry. Do not blindly restore all five privileged jobs.
