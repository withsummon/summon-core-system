# One-shot Convex deployment runner

Candidate only: no repository push, Dokploy runner creation or remote execution has been authorized or performed.

The existing original Dokploy service uses GitHub connection `withsummon-org`, repository `withsummon/summon-core-system`, branch `main`, and has autodeploy disabled. The Convex runtime service instead uses Raw compose with pinned backend/dashboard images. A new isolated runner can reuse the existing GitHub connection without a browser Terminal or another credential-discovery path.

## Build and runtime

The Dockerfile installs the committed lockfile using the repository's Corepack/pnpm pin. It first builds the existing workspace dependencies selected by `@plane/propel...`, which supply exports imported by the editor server bundle. It then builds the existing `@plane/editor` server entrypoint `src/lib.ts` and its declarations, then runs the backend's native TypeScript check. It does not build the web application or add dependencies. `exports:false` prevents the narrow build from rewriting the editor manifest. `.js` output matches the committed `@plane/editor/lib` export.

At runtime the image runs as `node`, with no exposed ports, no persistent volumes, read-only root filesystem, no added Linux capabilities and no restart loop. Only temporary/cache directories are writable. The normal Convex CLI retains schema/index checks; code generation is disabled because the immutable image already contains reviewed generated contracts. No source-map removal, compression override, skipped preflight or timeout alteration is included.

Required runtime variables are `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`; keep the key in private Dokploy runtime configuration, never in Git, image build arguments, logs or chat. `SOURCE_REVISION` is the reviewed immutable source identifier supplied at image build. The build rejects anything other than a full lowercase40-character commit SHA. This validates syntax, not provenance: the image label is caller supplied. Before building, resolve the approved ref with `git rev-parse --verify <ref>^{commit}`, export that exact SHA with `git archive`, and pass the identical SHA as the build argument. For a Dokploy Git checkout, independently match its recorded checkout SHA to the approved SHA before execution; a branch name or image label alone is insufficient. It is recorded in the image label and deployment message. Build only from the approved clean Git artifact, not a developer worktree containing private files.

The initial target can remain `https://convex-core.withsummon.com`: the upload then originates from the server, avoiding this Mac's failing long-upload path. An internal Docker address must not be invented; using one requires separately verifying and approving the actual existing network and alias. This runner opens no public backend port.

## Approval and acceptance

Before external changes, choose a coherent gated commit containing these files, validate a clean frozen-lock build, and obtain exact approval to push its chosen ref and create/run the isolated Dokploy service using compose path `./deployments/convex/runner/compose.yml`. Do not repurpose the existing product service or change its source settings.

Success requires the CLI's completed deployment, exact source identity, and current authenticated browser/data acceptance. An exited runner alone is not proof of successful deployment. On failure, retain sanitized logs and inspect the cause before rerunning. Disable automatic deploy triggers on the one-shot runner.

## Local candidate evidence

The source baseline `2a624b562c` was exported with `git archive` into a build artifact. Its frozen-lock installation, server editor build and backend TypeScript check pass with pinned pnpm11.3.0, without the unrelated dirty editor/UI manifests or lockfile overlay. The new runner files are the only added candidate source. The Linux arm64 container build passed with Node22.18.0 and pnpm11.3.0. The actual CLI generated its full push request with networking disabled, a read-only filesystem, the non-root `node` user and dropped capabilities. This was an offline bundle check only: the CLI prints a success message for its `--write-push-request` mode, but no backend was contacted or activated. A missing-runtime-environment check exited2 before invoking the CLI. Compose validation and shell syntax checks passed. The remote host architecture and remote build remain unverified; this baseline is not a final runner commit identity.

## Build context protection

`Dockerfile.dockerignore` overrides the repository-wide ignore file for this Dockerfile. It admits workspace manifests, backend/package source, committed patches and runner files; unrelated applications, Git metadata, installed dependencies, build outputs and local state are excluded. Final deny rules remove nested environment files, private-key formats, package-auth configuration and credential directories even under allowed source paths. Runtime credentials are never build arguments. These filename rules cannot detect a secret embedded in ordinary source code: the reviewed clean Git artifact remains the source trust boundary. Never build from a working directory containing unreviewed source or secret overlays.
