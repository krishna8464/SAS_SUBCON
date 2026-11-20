---
description: "Use when implementing, reviewing, testing, or debugging Express API routes, external providers, HTTP clients, webhooks, authentication, authorization, MongoDB providers, or environment configuration."
applyTo:
  - "routes/**"
  - "controllers/**"
  - "middleware/**"
  - "config/**"
  - "index.js"
  - "verify_role_flow.js"
---

# API Provider Integration Guidelines

- Treat Express routes as thin gateways: authenticate/authorize in `routes/`, validate and execute provider/database operations in `controllers/`.
- Add a route with `express.Router`, mount it in `index.js`, and keep frontend browser pages separate from JSON REST endpoints.
- Do not create an external HTTP client abstraction unless multiple providers need one; use Node's built-in `fetch` or an explicitly installed client consistently, with timeout and size limits.
- Put provider credentials, URLs, ports, database URIs, and webhook secrets in environment variables. Load defaults only for non-secret local development and document new variables in `.env.example`.
- Validate and normalize all provider payloads before database writes. Reject missing required fields with `400`, missing resources with `404`, and provider/auth failures with an appropriate `401/403/502` response.
- Never return provider secrets, raw authorization headers, JWTs outside the documented login response, passwords, or internal stack traces.
- Preserve bearer-header, HTTP-only cookie, and query-token compatibility through `middleware/auth.js`; any authentication change must keep active `Token` documents enforced.
- Apply `authorizeRoles(...)` before mutating or reading privileged resources. Verify ownership/context such as supplier or site IDs in controllers when role checks alone are insufficient.
- Keep provider calls side-effect-safe: do not retry writes without an idempotency key, avoid logging unredacted bodies, and handle timeouts/rejections with a controlled JSON error response.
- For MongoDB/provider failures, wait for or catch `config/db.js` connection errors, use existing Mongoose models, and reuse the shared GridFS bucket from `getGfsBucket()` for documents.
- Upload routes remain PDF-only with a 5 MB limit through `middleware/upload.js`; preserve temporary-file cleanup and GridFS storage behavior.
- Verify API changes by running `node --check` on edited JavaScript, starting `npm start`, and using the existing role-flow or route smoke scripts. There is currently no automated `npm test` suite.
