# SAS_SUBCON Operations and Company Hosting Guide

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

## 12. Windows Production Setup Example

Example process:
1. Install Node.js LTS.
2. Create `C:\apps\sas-subcon`.
3. Copy or deploy the repository there.
4. Run `npm install --omit=dev`.
5. Create `.env`.
6. Install application service using NSSM or PM2-Windows-Service.
7. Set service to automatic and restart on failure.
8. Start service.
9. Verify `http://127.0.0.1:9002/user/login-page` locally.
10. Configure IIS reverse proxy with SSL.
11. Restrict IIS/Node folder permissions.

## 13. MongoDB Deployment Options

### Local MongoDB
Suitable for a first internal deployment.
- Daily backup.
- Automatic Windows service startup.
- Private bind address.
- Authentication enabled.
- TLS if required by company policy.

### Replica set
Recommended for high availability:
- Primary.
- Secondary.
- Arbiter or additional secondary.

### Managed MongoDB
Use a company-approved managed database only if internal policy permits external service data residency.

## 14. Backups and Retention

Back up:
- MongoDB databases/collections.
- GridFS files (`workforce_docs.files` and `workforce_docs.chunks`).
- Environment configuration separately and securely.
- Application release files.

Recommended schedule:
- Database/GridFS snapshot daily.
- Full backup before upgrades.
- Test restore monthly or at a change-management-defined interval.
- Retain temporary PDF files 10 days after HO approval.
- Retain audit/history records according to company policy; do not purge approval history merely because PDFs expire.

## 15. Monitoring and Operational Checks

Monitor:
- Node process availability.
- Port 9002 listener.
- MongoDB connection.
- HTTP error rates.
- Disk usage for MongoDB/GridFS.
- Failed login attempts.
- Active tokens.
- Last backup status.
- CPU/memory.
- Application logs.

Health checks:
- Login page returns HTTP 200.
- Unauthenticated dashboard returns login/access handling rather than application crash.
- HO queue loads.
- Supplier portal loads for authorized roles.
- PDF streaming works.
- MongoDB persists a test request in staging.
- Password reset deactivates old token.

## 16. Deployment Rollout Plan

1. Create UAT/staging environment.
2. Export an anonymized copy of staging data.
3. Test all roles and pages.
4. Test upload and GridFS streaming.
5. Test the complete approval lifecycle.
6. Test Subcon ID uniqueness.
7. Test password update and session invalidation.
8. Conduct management sign-off.
9. Schedule production change window.
10. Stop app or route traffic to maintenance mode.
11. Backup MongoDB/GridFS.
12. Deploy release package.
13. Install dependencies.
14. Start the service.
15. Run smoke tests.
16. Monitor for 24 hours.

## 17. Rollback Procedure

1. Stop new application traffic.
2. Restore the previous application directory/package.
3. Restart Node service.
4. Restore database backup only if schema migration requires it.
5. Recheck login and one complete review request.
6. Document the rollback reason and affected data.

Do not delete newly inserted approved records during rollback unless an approved rollback procedure explicitly requires data correction.

## 18. Troubleshooting

### Buttons do not respond
- Check browser console for JavaScript undefined references.
- Confirm a fresh page load.
- Verify `hoQueueData` contains records.
- Verify inline functions are loaded by `dashboard.ejs`.

### Page shows access unavailable
- Confirm user is logged in.
- Confirm browser token and role storage.
- Confirm active token exists in MongoDB.
- Confirm role middleware allows the route.

### Supplier page cannot open
- Confirm role is SUPPLIER, HO, ERP_TEAM, or DEVELOPER.
- Confirm authorization middleware sees the valid JWT.
- Confirm `/mobilization/portal` route is mounted.
- Confirm local storage role is synchronized during login.

### PDF does not open
- Confirm URL contains a valid GridFS ObjectId.
- Confirm GridFS bucket `workforce_docs` exists.
- Confirm file has not passed purge/withdrawal.

### User password does not update
- Confirm `password` is included and at least 6 characters.
- Confirm Mongoose `isModified('password')` fires in `save()`.
- Confirm old browser token is cleared/relogin.

### HO cannot approve
- Confirm Medical is approved.
- Confirm HSE is approved.
- Confirm WQT is approved or not required.
- Confirm status is exactly `Pending HO Approval`.
- Confirm Subcon ID is unique.

## 19. Maintenance Responsibilities

Recommended owner groups:
- ERP/IT: server, MongoDB, HTTPS, backups, account reset.
- HO Operations: final approvals and Subcon ID rules.
- HSE: HSE/WQT review process.
- Medical: fit-for-duty/medical verification.
- Supplier coordinators: accurate worker packets and resubmissions.
- Developer/ERP: system configuration and controlled enhancements.

## 20. Recommended Next Improvements

- Add server-side PDF malware and MIME validation.
- Move Tailwind CDN usage to compiled CSS for production.
- Add centralized application audit logs.
- Add corporate SMTP approval notification integration.
- Add automated GridFS 10-day purge job using MongoDB scheduled task or server scheduler.
- Add application health endpoint.
- Add structured backup verification reporting.
- Add IP/VPN restrictions.
- Add MFA/SSO for corporate accounts.
- Add database encryption at rest and HTTPS only.
- Add role/approval decision concurrency protections.
- Add Subcon ID format policy and automatic ID generation.
- Add release/version API endpoint.

## 21. Quick Deployment Reference

```text
Application server:    Windows Server or dedicated VM
Internal application:  http://127.0.0.1:9002
Public/internal URL:   https://subcon.company.local
Database:              Private MongoDB instance
Document storage:      MongoDB GridFS bucket workforce_docs
Process service:       node index.js under PM2/NSSM/Windows Service
Reverse proxy:         IIS ARR or Nginx/Caddy
Firewall:              HTTPS 443 public/internal; Node 9002 localhost/private only
Backups:               MongoDB plus GridFS plus .env release snapshot
```

This guide describes how the system should be operated as an internal company application and does not replace formal company IT change-management, security, and data-retention policies.
