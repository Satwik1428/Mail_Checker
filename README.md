# MailSure — The Night Post Office

MailSure checks email syntax and a domain's published mail-routing records before you send a list. It does not send email or probe SMTP servers. A DNS route is only a signal about the domain; it cannot confirm that a specific mailbox exists or that a message will reach the inbox.

## Live project

- **Website:** https://mailchecker-pi.vercel.app/
- **API health:** https://mailsure-api.onrender.com/api/health
- **Source repository:** https://github.com/Satwik1428/Mail_Checker

## Product artwork

![MailSure envelope artwork](client/public/images/mailsure-envelope-ensemble.png)

The live interface uses three stamp artworks in its results ledger. The envelope image above is product artwork, not a screenshot of the application.

## What it does

- Accepts up to 50 unique addresses per check. Lines, commas, semicolons, and whitespace separate entries; duplicates are removed without regard to letter case.
- Checks common email syntax and queries DNS for MX records.
- Applies the implicit-MX A/AAAA fallback when the MX record set is absent.
- Reports three honest classifications:
  - **Likely Deliverable** — syntax is valid and MX or fallback address records indicate a route.
  - **Likely to Bounce** — syntax is invalid or DNS confirms there is no MX or fallback route.
  - **Unknown** — DNS could not provide a reliable answer, including resolver failures and timeouts.
- Explains each result and shows mailbox status as not checked.
- Shows summary stamps, searchable/filterable results, and CSV export.
- Restores the last input and results from browser local storage after reload. This is browser-local persistence, not a server account or cloud backup.

**Important:** MailSure does not establish that an address is active. It does not send test messages, connect to mail servers, or guarantee delivery.

## Architecture

- **client/** — React 19 and Vite single-page application. Axios sends checks to the API. The UI helpers parse/deduplicate input, summarize results, escape CSV cells, and restore the last check from local storage.
- **server/** — Express API. The check route validates request data, limits batch size and concurrency, and checks syntax and DNS/MX routing. Helmet, CORS, JSON-size limits, and rate limits protect the API.

### API contract

Health check:

    GET /api/health

Email check:

    POST /api/check
    Content-Type: application/json
    { "emails": ["person@example.com", "not-an-email"] }

The response has a count and one result per unique input. Each result includes email, classification, explanation, and checks for syntax, MX, address fallback, and mailbox status. Mailbox status remains not_checked.

## Run locally

Use Node.js and npm. Install and start each app in a separate terminal from the repository root.

API terminal:

    cd server
    npm install
    npm run dev

Frontend terminal:

    cd client
    npm install
    npm run dev

The frontend runs at http://localhost:5173 and the API defaults to http://localhost:5000.

### Environment settings

The defaults work for local development. For a non-default deployment, configure:

| Variable | Used by | Purpose | Default |
| --- | --- | --- | --- |
| PORT | server | HTTP port | 5000 |
| CLIENT_URL | server | Allowed browser origin for CORS | http://localhost:5173 |
| MAX_EMAILS | server | Maximum unique addresses per request | 50 |
| DNS_TIMEOUT_MS | server | DNS resolver timeout | 4000 ms |
| CHECK_CONCURRENCY | server | Parallel DNS checks | 5 |
| VITE_API_URL | client build | API base URL | http://localhost:5000 |
| VITE_MAX_EMAILS | client build | UI batch limit; keep aligned with MAX_EMAILS | 50 |

Put local-only values in server/.env or client/.env. Those files are ignored by Git. VITE_ values are compiled into the public frontend bundle and must never contain secrets.

## Test and build

Frontend:

    cd client
    npm test
    npm run lint
    npm run build

Backend:

    cd server
    npm test

The frontend tests cover address parsing/deduplication, summaries, safe CSV generation, and saved state. Backend tests cover syntax, MX and A/AAAA fallback, resolver errors/timeouts, batch handling, and malformed requests.

## Deployment configuration and limits

- Frontend is served by Vercel from client/ with the Vite production build.
- Backend is served by Render from server/.
- Configure Vercel's production VITE_API_URL as https://mailsure-api.onrender.com and rebuild after changing it.
- Configure Render's CLIENT_URL as https://mailchecker-pi.vercel.app so browser requests from the production site pass CORS.
- The API host needs outbound DNS access for MX and A/AAAA lookups. If DNS is blocked or inconclusive, valid addresses are reported as Unknown. Render free services may sleep while idle and have a cold-start delay.
- Browser local storage may contain the last pasted list and results on that device. Clear the app's saved data or browser site data when appropriate; do not use this demo as a mailbox-verification service.

## Security and privacy notes

The API accepts only JSON and limits body size, request rates, batch size, and lookup concurrency. No email messages are sent. Address lists submitted to the live checker are sent to the MailSure API for DNS checks; the last input and result set are also stored in the browser's local storage for reload recovery. Do not paste a list unless you are permitted to process it.
