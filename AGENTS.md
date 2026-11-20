# SAS_SUBCON Agent Guidelines

- This is a CommonJS Express 5 + Mongoose + EJS application; use existing callback/router/controller patterns rather than introducing another framework.
- Keep HTTP boundaries in `routes/`, data operations in `controllers/`, schemas in `models/`, and shared authorization/configuration in `middleware/` and `config/`.
- Mount routes in `index.js`; API prefixes are `/user`, `/site`, `/supplier`, `/designation`, `/mobilization`, and `/admin-review`.
- Protect API routes with `authMiddleware` and `authorizeRoles(...)` in `middleware/role_access.js`; preserve role-specific site and supplier context in `req.user`.
- Load configuration through `process.env` and `.env`; never hardcode JWT secrets or provider credentials. The environment template is `.env.example`.
- MongoDB is the database provider. Use `MONGO_URL` (with the existing `Mongo_url` compatibility fallback only if required) and GridFS through `config/db.js` rather than opening independent connections.
- Return JSON for REST endpoints and render EJS for browser pages. Preserve existing status-code and `{ message, ... }` response conventions.
- Wrap async operations and input validation explicitly, convert invalid IDs and duplicate records into clear 400/404 responses, and avoid exposing stack traces or secrets.
- Run `npm install`, `npm start`, or `npm run dev`; use `node --check <file>` for syntax validation. There is no real test script yet (`npm test` is intentionally a placeholder).
- For verification, start MongoDB and the app on port 9002, then use `node verify_role_flow.js` for the existing role-flow smoke check.

For API/provider implementation details, follow `.github/instructions/api-provider.instructions.md`.

Detailed route, role, deployment, and operations information: [SAS_SUBCON_OPERATIONS_AND_HOSTING_GUIDE.md](SAS_SUBCON_OPERATIONS_AND_HOSTING_GUIDE.md).
