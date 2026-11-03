# Midway branch workspace

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

The backend enforces these rules independently of the interface. Passwords use Bun's password hashing; opaque session tokens are stored as SHA-256 hashes, with eight-hour HttpOnly/SameSite cookies. Writes check request origin. Flight history uses the authenticated user's name, and revision checks reject stale operation saves. Refresh after a conflict before retrying. Login attempts are rate-limited per email in the running process.

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

The default `render.yaml` selects a **free temporary demonstration** without a paid disk, using `deploy/start-demo.sh`. Accounts, requests and attachments may be lost on shutdown, restart or redeploy. `MIDWAY_DEMO_MODE=true` exposes this limitation in the interface. Use fictional data and prepare it shortly before the presentation. Setup remains token-protected.

Read [deploy/README.md](deploy/README.md) for manual **Web Service → Free** deployment. Provider eligibility and card verification cannot be guaranteed. Do not add a paid disk or subscription for the demo.

The paid configuration is retained in `deploy/render-paid.yaml`, with instructions in [deploy/PAID.md](deploy/PAID.md). Moving to persistent storage requires explicit data migration; upgrading the plan alone does not migrate the database. Separate client companies require isolated service/database instances; this app is single-branch, not multi-tenant.

No actual Render deployment or paid service has been created. The user has a Render account. Source is on the dedicated GitHub branch; verify its remote tip before deploying.
