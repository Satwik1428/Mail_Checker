# MailSure

MailSure checks email address syntax and the domain's mail-routing DNS records. It does not send email, probe SMTP mailboxes, confirm that a recipient mailbox exists, or guarantee inbox delivery.

## Project structure

- client/ — React, Vite, and Tailwind CSS frontend.
- server/ — Express API with DNS/MX checking.
- client/public/images/stamps/ — the three summary-stamp artworks used by the results ledger.

## Local development

Use two terminals from the repository root.

Terminal 1 — API:

    cd server
    npm install
    npm run dev

Terminal 2 — frontend:

    cd client
    npm install
    npm run dev

By default, Vite serves the frontend at http://localhost:5173 and the API at http://localhost:5000.

### Optional environment settings

Create server/.env when you need to override:

    PORT=5000
    CLIENT_URL=http://localhost:5173
    MAX_EMAILS=50
    DNS_TIMEOUT_MS=4000
    CHECK_CONCURRENCY=5

Create client/.env when the API runs elsewhere:

    VITE_API_URL=http://localhost:5000
    VITE_MAX_EMAILS=50

Keep VITE_MAX_EMAILS aligned with the server's MAX_EMAILS.

## API

- GET /api/health — reports whether the API is running.
- POST /api/check — accepts a JSON object with an emails array and returns count and results.

Each result includes a classification, explanation, and checks for syntax, MX, address-record fallback, and mailbox status. Mailbox status is not checked.

Classifications:

- **Likely Deliverable** — the address syntax is valid and its domain has MX or implicit A/AAAA mail routing.
- **Likely to Bounce** — syntax is invalid or the domain has no mail-routing records.
- **Unknown** — DNS did not provide a reliable answer.

These are domain-routing indicators, not mailbox verification.

## Checks

Run frontend unit tests, lint, and a production build:

    cd client
    npm test
    npm run lint
    npm run build

Run backend tests:

    cd server
    npm test

Frontend tests cover address parsing and deduplication, result summaries, and CSV output escaping. Backend tests cover syntax, MX/fallback behavior, DNS errors/timeouts, and API request validation.

## Deployment notes

- Set CLIENT_URL on the API to the deployed frontend origin.
- Set VITE_API_URL at frontend build time to the deployed API URL.
- Configure frontend and backend batch limits consistently.
- Deploy client/ as a static Vite site and server/ as a Node.js service.
- The deployed API host must allow outbound DNS lookups for MX and A/AAAA records. If its network policy blocks DNS, MailSure cannot determine domain mail routing and reports the affected valid addresses as **Unknown** when the lookup times out or returns an inconclusive resolver error. It does not work around that restriction by connecting to mail servers, probing mailboxes, or sending messages.
- When DNS is available, results still describe only the domain's published mail-routing records. **Likely Deliverable** does not mean a specific mailbox exists or that a message will reach the inbox; MailSure cannot verify either fact.
