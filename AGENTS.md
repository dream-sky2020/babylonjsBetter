# Repository guidance

Before broad repository exploration or architecture changes, read `PROJECT_MAP.md` at the repository root.

Keep `PROJECT_MAP.md` current when changing any of the following:

- application or lab entry points;
- ownership between `core/`, `labs/`, `tools/`, `apps/`, and `config/`;
- shared rendering managers or configuration data flows;
- development API routes or persistence behavior.

The actual Git repository root is this directory. The surrounding workspace may contain another directory with the same name.

The user manages the entire `public/` directory through Drive, separately from Git.
Keep public assets locally for development and builds, but do not force-add them or
re-enable Git LFS. Code, presets and resource manifests under `codex-tools/` stay in Git.
New checkouts require restoring the matching public directory through Drive.

Model asset imports follow the user's 2026-10-08 preference documented in
`codex-tools/model-assets/README.md`: include assets with unclear or missing license
information, grouped by author, and label them as unverified imports authorized
by the user. Retain source and attribution evidence per pack/model; user approval
to import is not evidence of an author license. Do not relabel unknown licenses as
CC0 or verified commercial permission. This change does not undo earlier explicit
exclusions of assets with known noncommercial restrictions.

For automated Electron verification, use `codex-tools/spawnElectron.mjs` to launch
processes in disposable temporary working directories. Each Electron verification
entry must load `codex-tools/electronWorkspace.cjs` before Electron and resolve asset
and report paths with `resolveRepoPath`. Do not launch verification processes with
the repository root as their working directory: Windows native spelling under
the Codex sandbox can create empty garbled `Microsoft/Spelling/neutral` trees.

Codex helper tools and asset-processing records belong in `codex-tools/`. Read its README and reuse existing tools before creating new ones. Put disposable tools in ignored `.asset-migration/` and clean them up when finished. Do not recreate `scripts/` or scatter helper tools in the repository root.
