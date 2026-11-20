# SAS_SUBCON Operations and Company Hosting Guide

## 1A. Authoritative Project Code Update (20 November 2026)

The following sections supersede older descriptions in this guide. The application is currently a CommonJS Node.js/Express 5 application, not a separate frontend or microservice deployment.

- Entry point: `index.js`; start command: `npm start`; development command: `npm run dev`.
- Default HTTP listener: `PORT` or `9002`.
- Runtime data provider: MongoDB/Mongoose using `MONGO_URL`, compatibility fallback `Mongo_url`, and finally local MongoDB `mongodb://127.0.0.1:27017/sas_subcon`.
- GridFS document bucket: `workforce_docs`, with collections `workforce_docs.files` and `workforce_docs.chunks`.
- Authentication: JWT in bearer header, `token` cookie, or `token` query parameter, plus an active row in the `Token` collection.
- Browser assets: EJS views, public CSS/JavaScript, local Tailwind configuration, and `/images/sas-subcon-logo.svg` branding.
- Upload policy: Multer accepts PDF only and limits each uploaded document to 5 MB. Files are first buffered to `public/uploads/tmp`, streamed to GridFS, and cleaned locally after success or failure.
- Database-backed persistent application state is separate from the in-process document purge timer.

### Route mounts in `index.js`

| Prefix | Module | Responsibility |
|---|---|---|
| `/` | `index.js` | Redirect to `/user/login-page` |
| `/user` | `routes/user_route.js` | Login, logout, dashboards, identity management |
| `/site` | `routes/sites_route.js` | Site master data |
| `/supplier` | `routes/suppliers_route.js` | Supplier master data |
| `/designation` | `routes/designation_route.js` | Trade/designation master data |
| `/mobilization` | `routes/mobilization_route.js` | Mobilization submission, resubmission, review context, documents |
| `/admin-review` | `routes/admin_review_route.js` | Medic/HSE reviews, HO clearance, allocation, blacklist |

### Environment variables

| Variable | Required | Current behavior |
|---|---|---|
| `PORT` | No | Defaults to `9002` |
| `MONGO_URL` | Yes in hosted environments | Primary MongoDB connection string |
| `Mongo_url` | No | Compatibility fallback only |
| `JWT_SECRET` | Yes in hosted environments | Used to sign and verify JWTs; production must override the code fallback |

The template is `.env.example`. Do not commit a real `.env`, JWT secret, or MongoDB credential.

## 1. Purpose

SAS_SUBCON replaces email-and-spreadsheet mobilization coordination with one controlled workflow for registering subcontractor workers, collecting required documents, conducting Medic/HSE/WQT reviews, obtaining Head Office approval, assigning Subcon IDs, and maintaining an auditable approval ledger.

The old process is typically slow and vulnerable to:
- Untracked email attachments and duplicate document copies.
- Missing approval evidence or unclear approver identity.
- Requests being sent to the wrong person or department.
- Different departments storing different versions of a worker file.
- No reliable global view of pending, completed, rejected, or cancelled applications.
- Difficult supplier, site, designation, worker, and approval reporting.
- Password, role, and account access being managed without a central authorization model.
- No clear terminal state after Subcon ID issuance.

SAS_SUBCON solves these problems through authentication, role-based access, structured records, independent review gates, a global HO queue, a transaction history, report exports, GridFS document storage, and an approval-led Subcon ID lifecycle.

## 1A. Current Release and Visual Identity Update

This guide reflects the application code currently in the project workspace.

- Application name: `SAS_SUBCON`.
- Public login favicon and visible branding asset: `/images/sas-subcon-logo.svg`.
- The login page displays one optimized circular SAS/SAS_SUBCON emblem inside the authentication card.
- Shared application pages may display the same emblem automatically in their header area.
- The shared branding script excludes `/` and `/user/login-page` so the login logo is not duplicated.
- Browser caches may retain an old logo. Perform a hard refresh or clear cached images after deployment.

### Logo deployment

Use the SVG asset for normal viewing and favicon use. It scales cleanly without resizing or pixelation. Keep `/images/sas-subcon-logo.svg` on the public static path and do not rename it without updating:
- `views/login.ejs`
- `public/js/company_brand.js`

## 2. System Architecture

### Runtime stack
- Node.js 18 or newer.
- Express 5 HTTP server.
- EJS server-rendered pages.
- MongoDB with Mongoose.
- MongoDB GridFS for PDF compliance documents.
- JWT session authentication with database-backed active token records.
- bcrypt password hashing.
- Multer file upload middleware.
- Tailwind CDN and local CSS/JavaScript assets.

### Application entry
The process starts through `node index.js` or `npm start`.

`index.js`:
1. Loads environment variables.
2. Creates the Express application.
3. Enables JSON and URL-encoded request parsing.
4. Enables cookies and CORS.
5. Configures EJS views.
6. Configures the public static directory.
7. Mounts all application route modules.
8. Mounts the logger and final error handler.
9. Starts HTTP port 9002 by default.
10. Waits for MongoDB connectivity.

### Main route mounts
| Path prefix | Module | Purpose |
|---|---|---|
| `/user` | User routes | Login, logout, dashboards, IAM |
| `/site` | Site routes | Site/company location master data |
| `/supplier` | Supplier routes | Supplier/master subcontractor data |
| `/designation` | Designation routes | Worker classifications/trades |
| `/mobilization` | Mobilization routes | Worker packet submission, review files, details |
| `/admin-review` | Review routes | Medic/HSE/WQT/HO review and reports |

## 2A. Current Implementation Details

- The server listens on `process.env.PORT` or port `9002`.
- MongoDB uses `MONGO_URL`, then `Mongo_url`, then `mongodb://127.0.0.1:27017/sas_subcon`.
- GridFS bucket name: `workforce_docs`.
- Document purge is implemented in `utils/document_purger.js`.
- After final approval, uploaded document URLs are scheduled for purge after 10 days using an application timer.
- The timer exists in the Node.js process. A restart may delay or reset in-process timers, so production should also use a database-backed scheduled purge or server scheduler for durable retention enforcement.
- PDF MIME/type and malware validation, health endpoints, release/version reporting, and MFA/SSO are recommended improvements and should not be assumed to be deployed.

## 3. Page and View Guide

### `/user/login-page`
The public login page. It validates email/password with the backend, stores the returned JWT and role in browser storage, and routes users to the appropriate role dashboard.

### `/user/dashboard-view`
The role entry dashboard.
- SUPPLIER -> supplier portal.
- SITE_MEDIC/SITE_HSE -> medic/HSE desk.
- SITE_MANAGER -> site management page.
- HO/ERP_TEAM/DEVELOPER -> operations dashboard.

### `/mobilization/portal`
Supplier mobilization portal.
- SUPPLIER: registers requests and tracks only its supplier records.
- DEVELOPER: full supplier portal capability.
- HO/ERP_TEAM: global read-only supplier request view.

The page collects worker identity, trade, site, accommodation, sponsor, urgency, remarks, and compliance PDFs. WQT is mandatory only for welder designations.

### `/mobilization/request-details/:id`
Shows the complete worker record, gate statuses/comments, uploaded documents, assigned Subcon ID, and chronological submission/approval history.

### `/user/medic-dashboard`
Used by Medical and HSE personnel. The page presents assigned site review queues and can approve or request resubmission.

### `/site/manage-sites`
Creates and maintains project or camp sites. Relevant roles can view this page: HO, ERP_TEAM, DEVELOPER, and SITE_MANAGER.

### `/supplier/manage-suppliers`
Maintains supplier companies and corporate details. Restricted to HO, ERP_TEAM, and DEVELOPER.

### `/designation/manage-designations`
Maintains worker classifications such as Welder, Scaffolder, or Pipefitter and risk levels.

### `/user/manage-users`
Identity and access management page.
- HO/ERP_TEAM/DEVELOPER can provision users.
- Developers may edit user passwords/profile fields.
- Password changes invalidate active sessions.
- Accounts can be activated/suspended.

### `/admin-review/report`
The administrative report and aggregate status overview.

### `/admin-review/medic-deck` and `/admin-review/hse-deck`
Role-specific compliance review desks.

### `/views/not_available.ejs`
Server error/authentication failure view. It contains a safe return/login path and is not used for normal portal navigation.

## 4. Role Matrix

| Role | Supplier Portal | Worker Submission | Medic/HSE/WQT Review | HO Queue | Subcon ID/HO Approval | Master Data | User Management |
|---|---|---|---|---|---|---|---|
| SUPPLIER | Own records | Yes | No | No | No | No | No |
| DEVELOPER | Global/full | Yes | Yes | Yes | Yes | Yes | Yes |
| HO | Global read-only/all requests | No | Yes where required | Yes | Yes | Yes | Yes |
| ERP_TEAM | Global read-only/all requests | No | Yes | Yes | Yes | Yes | Yes |
| SITE_MEDIC | Review desk | No | Medic | Limited | No | No | No |
| SITE_HSE | Review desk | No | HSE/WQT | Limited | No | Limited | No |
| SITE_MANAGER | Site pages | No | No | No | No | Site only | No |

## 5. Workforce Mobilization Workflow

### Stage 1: Supplier submits worker packet
A supplier creates a mobilization request containing:
- Civil ID.
- Employee name.
- Nationality and DOB.
- Mobile number.
- Civil expiry.
- Designation/trade.
- Target site.
- Accommodation type.
- Sponsor company.
- Urgency.
- Remarks.
- Medical PDF.
- HSE PDF.
- WQT PDF, only for Welder trades.

Initial status:
- Global request status: `Under Review`.
- Medical status: `Pending`.
- HSE status: `Pending`.
- WQT status: `Pending` for welder trades or `Not Required` otherwise.

### Stage 2: Medical review
Medical/HSE authorized users review the packet.
- Approved -> `medical_status = Approved`.
- Resubmit -> `medical_status = Resubmit`.
- Rejected -> global status becomes `Rejected`.

### Stage 3: HSE review
HSE personnel verify safety compliance.
- Approved -> `hse_status = Approved`.
- Resubmit -> `hse_status = Resubmit`.
- Rejected -> global status becomes `Rejected`.

### Stage 4: WQT review
WQT is considered only when the designation title contains `Welder`.
- Approved -> `wqt_status = Approved`.
- Resubmit -> `wqt_status = Resubmit`.
- Non-welder -> `wqt_status = Not Required` and no WQT PDF/action is needed.

### Stage 5: HO queue
When Medic, HSE, and applicable WQT gates are approved, the request advances to `Pending HO Approval`.
HO, ERP_TEAM, and DEVELOPER can see every global request, including pending/completed states.

### Stage 6: Subcon ID issuance
HO/ERP/DEVELOPER enters a unique Subcon ID and final approval reason.
The server:
1. Checks the request is `Pending HO Approval`.
2. Validates the Subcon ID is not already used.
3. Marks old employee deployments inactive for the Civil ID.
4. Sets request status to `Approved`.
5. Stores the Subcon ID on the request.
6. Creates/updates the active employee profile.
7. Writes the approval to submission history.
8. Generates an approval summary/email body.

Final approval is terminal. Post-approval actions do not create a second site-administration approval stage.

### Stage 7: 10-day document retention
After HO approval, uploaded Medical/HSE/WQT documents are retained for 10 days and then purged from GridFS by the document retention process.
This is not the same as deleting the mobilization record or employee profile. It removes only temporary binary document blobs.

## 6. Route Reference

### Authentication routes
| Method | Route | Authorization | Purpose |
|---|---|---|---|
| POST | `/user/login` | Public | Authenticate and create JWT/token record |
| POST | `/user/logout` | Authenticated | Deactivate current session |
| POST | `/user/register` | Public/internal route | Provision a new account |
| PUT | `/user/update-profile/:id` | HO/ERP/DEVELOPER | Edit user and password |
| PUT | `/user/toggle-status/:id` | Authenticated management | Suspend/activate user |
| GET | `/user/all` | Authenticated | Read user directory |

### Site routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/site/manage-sites` | Render site management page |
| POST | `/site/create` | Create site |
| GET | `/site/all` | List sites |
| GET | `/site/:id` | Read one site |
| PUT | `/site/update/:id` | Edit site |
| DELETE | `/site/delete/:id` | Change/mark site status |

### Supplier routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/supplier/manage-suppliers` | Render supplier page |
| POST | `/supplier/create` | Create supplier |
| GET | `/supplier/all` | List suppliers |
| GET | `/supplier/:id` | Read supplier |
| PUT | `/supplier/update/:id` | Edit supplier |
| DELETE | `/supplier/delete/:id` | Change supplier status |

### Designation routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/designation/manage-designations` | Render designation page |
| POST | `/designation/create` | Create designation |
| GET | `/designation/all` | List designations |
| GET | `/designation/:id` | Read designation |
| PUT | `/designation/update/:id` | Edit designation |
| DELETE | `/designation/delete/:id` | Change designation status |

### Mobilization routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/mobilization/portal` | Supplier/global mobilization page |
| GET | `/mobilization/request-details/:id` | Detailed request page |
| GET | `/mobilization/my-submissions` | Own supplier records or global records |
| PUT | `/mobilization/drop-request/:id` | Cancel eligible packet |
| PUT | `/mobilization/resubmit/:id` | Resubmit packet corrections |
| POST | `/mobilization/submit-worker` | Upload worker packet and PDFs |
| GET | `/mobilization/request-context/:id` | Expanded request JSON |
| POST | `/mobilization/resubmit-file/:id` | Replace a correction PDF |
| GET | `/mobilization/file/:id` | Stream a PDF from GridFS |

### Review routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/admin-review/medic-deck` | Medic dashboard |
| GET | `/admin-review/hse-deck` | HSE dashboard |
| GET | `/admin-review/report` | Administrative report |
| GET | `/admin-review/medic/pending` | Medic queue |
| GET | `/admin-review/hse/pending` | HSE queue |
| GET | `/admin-review/ho/queue` | Complete global HO queue |
| POST | `/admin-review/medic/evaluate` | Medic decision |
| POST | `/admin-review/hse/evaluate` | HSE decision |
| POST | `/admin-review/review-docs` | HSE/WQT decision endpoint |
| PUT | `/admin-review/ho-clearance` | Assign Subcon ID/final approve |

## 6A. Complete Current Route Inventory

### Authentication and identity
| Method | Route | Access |
|---|---|---|
| GET | `/user/login-page` | Public EJS login page |
| POST | `/user/login` | Public login; JWT and active Token record |
| POST | `/user/register` | Account creation endpoint |
| POST | `/user/logout` | Authenticated; deactivate current Token |
| GET | `/user/dashboard-view` | Authenticated role-based page routing |
| GET | `/user/manage-users` | HO, ERP_TEAM, DEVELOPER |
| GET | `/user/medic-dashboard` | Medic/HSE/management roles |
| GET | `/user/hse-dashboard` | HSE/management roles |
| GET | `/user/all` | Authenticated user directory |
| PUT | `/user/update` | Legacy supplier-ID update endpoint |
| PUT | `/user/toggle-status/:id` | Authenticated account activation/suspension |
| PUT | `/user/update-profile/:id` | HO, ERP_TEAM, DEVELOPER |

### Mobilization
| Method | Route | Access |
|---|---|---|
| GET | `/mobilization/portal` | SUPPLIER, DEVELOPER, HO, ERP_TEAM |
| GET | `/mobilization/request-details/:id` | Request detail view |
| GET | `/mobilization/my-submissions` | Supplier-owned scope or HO/ERP/DEVELOPER global scope |
| POST | `/mobilization/submit-worker` | Authenticated upload and packet creation |
| PUT | `/mobilization/drop-request/:id` | Eligible packet cancellation |
| PUT | `/mobilization/resubmit/:id` | Corrected packet resubmission |
| GET | `/mobilization/request-context/:id` | Authenticated expanded request JSON |
| POST | `/mobilization/resubmit-file/:id` | Replace a correction document |
| GET | `/mobilization/file/:id` | Authenticated GridFS PDF streaming |

### Review, allocation, and blacklist
| Method | Route | Access |
|---|---|---|
| GET | `/admin-review/medic-deck` | Clinical/HSE/management view |
| GET | `/admin-review/hse-deck` | HSE/management view |
| GET | `/admin-review/report` | HO, ERP_TEAM, DEVELOPER |
| GET | `/admin-review/medic/pending` | Medic and authorized review roles |
| GET | `/admin-review/hse/pending` | HSE and authorized review roles |
| GET | `/admin-review/ho/queue` | HO, ERP_TEAM, DEVELOPER |
| POST | `/admin-review/medic/evaluate` | Medic decision or authorized management |
| POST | `/admin-review/hse/evaluate` | HSE decision |
| POST | `/admin-review/review-docs` | HSE/WQT document decision |
| PUT | `/admin-review/ho-clearance` | HO, ERP_TEAM, DEVELOPER final approval/rejection |
| PUT | `/admin-review/site-allocation` | SITE_MANAGER, HO, ERP_TEAM, DEVELOPER |
| POST | `/admin-review/blacklist-worker` | HO, ERP_TEAM, DEVELOPER |

### Master-data API pattern
Site, supplier, and designation modules use the same REST shape:
- Browser management view: `GET /<module>/manage-<module>`.
- Create: `POST /<module>/create`.
- List: `GET /<module>/all`.
- Read: `GET /<module>/:id`.
- Update: `PUT /<module>/update/:id`.
- Delete/change status: `DELETE /<module>/delete/:id`.

`/mobilization/request-details/:id` and `/mobilization/file/:id` must be reviewed for consistent authentication because they handle worker and document information. Publicly accessible document IDs must not be treated as authorization tokens.

## 7. Data Collections

### Core models
- `User`: identity, role, password hash, status, site/supplier allocation.
- `Token`: active/inactive login JWT record.
- `Supplier`: supplier registry.
- `Site`: project/camp/site registry.
- `Designation`: trade/risk classifications.
- `MobilizationRequest`: complete worker packet and review lifecycle.
- `SubcontractorEmployee`: approved workforce employee/profile record.
- `Blacklist`: blocked worker entries.

### Mobilization fields
Important fields include:
- Employee identity and civil information.
- Supplier, designation, and target site relationships.
- Accommodation, sponsor, urgency, and remarks.
- Medical/HSE/WQT PDF URLs.
- Independent gate statuses/comments.
- Global status.
- Subcon ID.
- Submission history ledger.
- Approval/rejection timestamps.

### Request statuses
- `Under Review`
- `Pending HO Approval`
- `Pending Site Admin` (legacy compatibility)
- `Approved`
- `Rejected`
- `Cancelled`

The active final workflow does not require site-admin approval after HO approval.

## 8. Authentication and Security

- Passwords are hashed with bcrypt.
- JWT is signed using `JWT_SECRET`.
- JWT can be delivered through Authorization bearer header, cookie, or token query parameter.
- Active token rows are stored in MongoDB.
- Logout deactivates the token.
- Password changes deactivate active user sessions.
- Suspend status deactivates active sessions.
- Server-side role middleware checks every protected route.
- Supplier identity is isolated unless the role is HO/ERP/DEVELOPER.
- Subcon IDs are uniqueness checked before final approval.
- PDF URLs are streamed only by the protected application context.

## 9. Company Server Hosting Options

The safest recommendation is a dedicated application VM or dedicated application directory on the existing Windows server, not on an existing application process or shared IIS site.

### Option A: IIS reverse proxy to Node.js (recommended for Windows domain environment)

Best for:
- Existing Windows Server.
- Corporate DNS and HTTPS certificate.
- IIS familiarity.
- Internal network/VPN access.

Requirements:
- Node.js application service.
- IIS.
- IIS Application Request Routing (ARR).
- URL Rewrite module.
- Windows service manager or NSSM/PM2.
- MongoDB reachable locally or privately.

Architecture:
`HTTPS/DNS -> IIS -> localhost:9002 -> MongoDB`

Isolation precautions:
- Create dedicated Windows service account.
- Store application under `C:\apps\sas-subcon`.
- Keep uploads/logs outside company application directories.
- Do not run under IIS application pool identity for database secrets.
- Grant write permission only to the application folder/log folder.
- Reserve a separate IIS site and app pool.
- Use reverse proxy rather than hosting static Node files directly.
- Use an internal DNS name such as `sas-subcon.company.local`.
- Use HTTP only on localhost; expose HTTPS from IIS.

### Option B: Windows VM hosting

Best for:
- Strong isolation from production systems.
- Firewall rules and patch control.
- Local MongoDB or dedicated database VM.

Architecture:
`Internal DNS/Firewall -> VM/Reverse Proxy -> Node.js -> MongoDB`

Do not use the existing application server for MongoDB unless database capacity and backup requirements are confirmed.

### Option C: Linux VM/container hosting

Best for:
- Standardized deployment.
- Docker/Podman and automated restart.
- Easy staging/production separation.

Architecture:
`Nginx/Caddy -> Docker/Node -> MongoDB`

Recommended isolation:
- Dedicated Docker network.
- Resource limits.
- Non-root container user.
- Read-only application filesystem except logs/uploads.
- Internal network only.
- Separate MongoDB container or dedicated database service.

### Option D: Dedicated physical/server folder with PM2/Node service

Best for:
- A small company installation.
- Existing internal Windows Server.

Use NSSM or PM2-Windows-Service as the service wrapper.
Set:
- Node executable path.
- Working directory.
- Environment file.
- Log directory.
- Restart policy.
- Startup type automatic.

### Option E: Cloud or managed hosting

Use if the server must be reached externally.
Examples:
- Azure App Service or Container Apps.
- AWS ECS or Elastic Beanstalk.
- Render or equivalent.

Requirements:
- Private MongoDB/Atlas or internal DB.
- HTTPS/domain.
- Secret manager.
- Persistent GridFS storage backed by MongoDB.
- Central logging and backup.

Not recommended until company access, DNS, and data-residence policies are approved.

## 10. Safe Deployment Isolation

Before deployment:
1. Inventory server ports and processes.
2. Confirm port 9002 is unused.
3. Reserve a dedicated Node service name.
4. Create a dedicated Windows/Linux account.
5. Place app under `C:\apps\sas-subcon\current`.
6. Store `.env` outside public/static directories.
7. Do not expose MongoDB to the internet.
8. Restrict server firewall ports.
9. Configure HTTPS certificate at reverse proxy/IIS/Nginx.
10. Separate staging and production directories.
11. Test backup/restore before go-live.
12. Establish an account for application restart/log review.

Suggested ports:
- Node internal: 9002.
- IIS/Nginx reverse proxy public: 443 HTTPS.
- MongoDB: 27017, private network only.

Never expose Node 9002 directly to the public internet.

## 11. Environment Configuration

Required values:
- `PORT=9002`
- `MONGO_URL=mongodb://...` or private MongoDB connection string.
- `JWT_SECRET=<long-random-secret>`

Recommended production values:
- `NODE_ENV=production`
- Corporate SMTP values if email delivery is added later.
- DNS base URL.

Generate a secret with a cryptographically secure random generator. Never commit `.env` to Git.

## 11A. Current Production Configuration Checklist

Before starting the service:

1. Copy `.env.example` to a private `.env` on the host.
2. Set `PORT=9002` unless an approved reverse-proxy deployment uses another private port.
3. Set `MONGO_URL` to the production MongoDB URI with authentication and TLS if required.
4. Generate a unique, high-entropy `JWT_SECRET`; do not use the `SAS_SUBCON` fallback in production.
5. Confirm MongoDB creates and retains `workforce_docs.files` and `workforce_docs.chunks`.
6. Confirm the application service account can write to `public/uploads/tmp` and read the complete application directory.
7. Keep the temporary upload directory outside public/static exposure where practical and back up MongoDB/GridFS rather than temporary files.
8. Configure IIS/Nginx for HTTPS and proxy only HTTP traffic to `127.0.0.1:9002`.

## 12A. Verified Local and Staging Commands

Run from the repository root:

```powershell
npm install
node --check index.js
node --check routes/user_route.js
node --check routes/mobilization_route.js
node --check routes/admin_review_route.js
npm start
```

Open:

```text
http://127.0.0.1:9002/user/login-page
```

When MongoDB and the application are running, execute the repository smoke check:

```powershell
node verify_role_flow.js
```

The smoke check creates a temporary HO account, signs in, and verifies dashboard/site access. Remove or isolate test accounts and records in non-production environments.

### Pre-production verification

- Confirm `npm start` reaches MongoDB and logs successful GridFS bucket initialization.
- Confirm the login page, favicon/logo, and login redirect.
- Verify each role receives only authorized pages and APIs.
- Verify supplier submission isolation and global HO/ERP/DEVELOPER views.
- Upload each supported PDF field and confirm 5 MB/ PDF-only enforcement.
- Confirm WQT is mandatory for Welder trades and not required for other trades.
- Verify Medic, HSE/WQT, and HO gate state transitions.
- Verify Subcon ID uniqueness and employee deployment inactivation.
- Verify site allocation activates the employee record when used.
- Verify logout and password changes invalidate old sessions.
- Verify direct PDF IDs require a valid authenticated session and produce no secret or stack trace in browser responses.
- Confirm backup/restore includes GridFS collections.

### Known implementation caveats

- `/mobilization/request-details/:id` is currently a page route and requires a follow-up security review for worker-record ownership if stricter page protection is required.
- `/mobilization/file/:id` streams from GridFS. It should remain behind authenticated application access and any reverse proxy/routing rules.
- Document purge scheduled with `setTimeout` is process-local. A Node restart loses pending timers, so production requires a durable scheduled purge or database-backed retention job.
- `allocateSiteAccommodation` also immediately purges its supplied PDF blobs. This behavior may be earlier than or different from the standard 10-day approval-retention schedule and should be reflected in company data-retention policy.
- There is no real automated `npm test` suite; `npm test` is currently an intentional placeholder.
- No health endpoint, MFA/SSO, malware scanning, corporate SMTP provider, or durable scheduled job should be assumed to be deployed from the repository alone.
