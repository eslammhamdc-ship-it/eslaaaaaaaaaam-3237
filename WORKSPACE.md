# Midway branch workspace

**Current target: Cloudflare Workers + D1.** Read [cloudflare/README.md](cloudflare/README.md) for the tested Worker architecture and deployment steps. The Render instructions below are retained for the earlier native Bun variant; they are not the current hosting target.


This implementation joins the flight operations UI from this repository with the customer/visit/planning UI from `eslammhamdc-ship-it/eslam-8266` (reviewed commit `a3357bb`). The original repository was inspected, not changed. Customer records and flight company records now share IDs and a single server database.

## Run

Use Bun 1.3.14, as pinned in package.json. In the cloud environment:

```sh
export PATH="/workspace/.onboarding-tools/node_modules/.bin:$PATH"
cd /workspace/eslaaaaaaaaaam-3237
ELECTRON_SKIP_BINARY_DOWNLOAD=1 bun install --frozen-lockfile
MIDWAY_ALLOW_SETUP=true bun run dev
```

Open the app through your hosting environment's supported application access. On a normal local workstation the web port is 4200. The first screen creates the initial branch manager; provide your own name, email and a password of at least 12 characters. No default accounts or passwords are shipped. Setup must be deliberately enabled with `MIDWAY_ALLOW_SETUP=true` and automatically refuses further setup after the first account exists. Remove that flag after initialization.

From **إدارة الفريق**, the branch manager creates accounts for flight manager, sales manager and flight employees. Users can change their own password from the account-name link. A manager can reset another account's password, suspend it, or change its role. Suspension, password resets and role changes revoke that account's existing sessions. Account creation is an internal workflow; it does not send email invitations.

For production build and startup:

```sh
cd packages/web
bun run build
cd ../..
PORT=4200 bun packages/web/src/__server.ts
```

Use one persistent server instance behind HTTPS, persistent disk for the database and uploads, and `MIDWAY_SECURE_COOKIES=true` when HTTPS terminates at a reverse proxy. Do not enable secure cookies for plain HTTP development. Processes do not survive environment snapshots; restart the server for a new task. Do not create a Git worktree unless the user requests one.

## Permissions

| Role | Flight operations | Customer workspace | Administration |
| --- | --- | --- | --- |
| Branch manager | Read/update all requests | All records | Accounts, roles, suspensions, audit log |
| Flight manager | Read/update all requests and companies | Read branch records; create/update own customer activity | No account administration |
| Sales manager | Read branch operations and financial reports | Read/update branch customer records and activity | No account administration |
| Flight employee | Read/update own requests only | Shared company directory and own visits/followups/opportunities/plans | Own password only |

Company deletion is restricted to the branch manager. Companies with flight requests cannot be deleted; mark them inactive instead. Staff may create customer companies, but can only edit their own customer records. Operations may only be assigned to active flight employees. All roles describe a **single branch**, not a multi-tenant or multi-branch system.

The backend enforces these rules independently of the interface. Native passwords use scrypt (with legacy Bun Argon2 verification); the Worker uses the browser PBKDF2 verifier protocol described in cloudflare/README.md; opaque session tokens are stored as SHA-256 hashes, with eight-hour HttpOnly/SameSite cookies. Writes check request origin. Flight history uses the authenticated user's name, and revision checks reject stale operation saves. Refresh after a conflict before retrying. Login attempts are rate-limited per email in the running process.

## Data and backup

By default the database is `.midway/workspace.db` inside the repository. It contains users, sessions, CRM data, requests, audit events and private attachment bytes; `.midway/` is ignored by Git. `MIDWAY_DATABASE_URL=file:/absolute/path/workspace.db` can select another persistent **local SQLite** file. Remote database deployment has not been validated. Do not commit, publicly serve or send this database to GitHub.

Before backing up, stop the application process you started and copy the private `.midway` directory to protected storage; restore it while the server is stopped. The CRM's existing JSON/CSV exports cover customer records, not user accounts, flight requests or attachments. Environment snapshots are not a substitute for an operational backup policy.

Existing browser-local demo records are not automatically imported into the shared database. The old browser storage is left intact. Fresh server databases have no fabricated companies, employees or requests. Browser smoke tests use separate temporary databases and fictional accounts and remove them afterward.

## Validate

```sh
bun run typecheck
bun run lint
bun test packages/web/src/api/workspace.test.ts
cd packages/web && bun run build
```

Unlike the former empty-reference `tsc --noEmit` invocation, the web typecheck explicitly checks both application and server projects.

The integration suite verifies bootstrap closure, access control, shared companies, private employee requests, attachments, status history, stale-save rejection, linked followups, deletion protection, password changes and session revocation. It uses a temporary database, not production data.

With Python Playwright and Chromium installed, run `python tests/browser_smoke.py` from the repository root **after building**. It launches its own server on port 4204 with a temporary database, creates test accounts and verifies the actual desktop/mobile workflow. `MIDWAY_CHROMIUM` and `MIDWAY_ARTIFACTS` override the browser executable and screenshot output directory. It exercises initial setup, team creation, a CRM company visible in flight operations, a request with attachment, status updates, separate employee login, persistence and mobile navigation, and asserts no JavaScript page errors.

Health: `GET /api/health` returns `{"status":"ok"}`. Authenticated operations: `GET /api/workspace/operations`. Anonymous access to operations must return 401.

## Scope

This is an internal branch operations and customer management application. Marking a request completed records an internal state; it does not issue a real airline ticket or collect money. GDS/airline APIs, WhatsApp, payment processing, password-recovery emails and native Electron/mobile application execution are not connected. Existing map tiles are optional and require their own network access. Recorded amounts and estimated opportunities do not prove collections, profit or attributable sales.

Deployment/public access and initialization with the real branch manager's credentials remain operator steps. Cloud draft saving does not publish the application or push source changes to GitHub; remote branch availability must be checked separately.

## Internet hosting

The current deployment target is **Cloudflare Workers with static assets and D1**, not Render or Vercel. See [cloudflare/README.md](cloudflare/README.md). Build with `bash deploy/build-cloudflare.sh`; after supplying a real D1 ID and authenticating the target Cloudflare account, deploy with `bash deploy/deploy-cloudflare.sh`.

The user created the Cloudflare D1 database midway-workspace and its dashboard ID is configured in wrangler.jsonc. No Worker has been deployed and the remote schema has not been initialized or verified. The user must connect the deployment to their Cloudflare account. Never request secret values in chat; put MIDWAY_SETUP_TOKEN in Worker Secrets. Free-tier storage, reads/writes, CPU and request limits apply; local tests do not establish a free production SLA or actual remote CPU performance.

Worker data persists in D1 independently of Worker restarts. Native local data remains in `.midway`, with automatic normalization of old operation snapshots. No automatic account/data upload or cross-runtime password migration is performed. Worker attachments are limited to 1 MiB each and 4 MiB per save. Native Bun limits remain 5/20 MiB. Distinct client companies need isolated deployments and databases.

Render free/paid files remain available as earlier alternatives, documented separately in deploy/README.md and deploy/PAID.md. Do not create a paid hosting service for this task.
