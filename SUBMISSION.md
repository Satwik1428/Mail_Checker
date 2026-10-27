# MailSure — Project Submission

## Live demo

- Website: https://mailchecker-pi.vercel.app/
- API health: https://mailsure-api.onrender.com/api/health
- GitHub: https://github.com/Satwik1428/Mail_Checker

## Summary

MailSure is a small web application for checking email syntax and domain mail-routing records for a pasted list. It helps identify invalid syntax and domains with no published mail route, while clearly marking inconclusive DNS results as Unknown.

## Features

- Batch input with duplicate removal and a 50-address limit.
- Syntax checks and DNS MX lookups, with A/AAAA fallback when the MX record set is absent.
- Three result categories: Likely Deliverable, Likely to Bounce, and Unknown.
- Result explanations, summary stamps, search and filters, and CSV export.
- Last input and results restored after reload using browser local storage.
- Responsive React/Vite frontend and Express API.
- No email sending or SMTP mailbox probing.

## Verification performed

- Live frontend opened successfully at the production Vercel domain (HTTP 200).
- Live API health endpoint returned status ok.
- Submitted the requested three-address list through the production UI; the check completed without a frontend error and returned one result in each category:
  - alice@gmail.com — Likely Deliverable; five MX records found.
  - not-an-email — Likely to Bounce; invalid syntax.
  - test@nonexistent-domain-987654321.example — Unknown; DNS returned ENOTFOUND.
- The live ledger showed 3 total results and the expected per-category counts. This confirms the Vercel frontend can call the Render API and the production CORS setting permits the request.
- Clicking Export CSV opened the browser's Save dialog with a CSV filename. A saved file was not inspected because the Save dialog did not accept automation input.
- Frontend automated tests: 9 passed, 0 failed.
- Backend automated tests: 5 passed, 0 failed.
- Frontend lint: passed.
- Frontend production build: passed.
- Secret-hygiene check: no tracked .env or credential-named files found. A pattern scan of the available Git history found no common API-key or private-key signatures; this is a best-effort scan, not a guarantee that every possible secret format is absent.

## Honest limitations

Likely Deliverable means only that valid-looking syntax has a domain-level DNS mail route. It does not establish that an individual mailbox exists, accepts mail, or receives a message in its inbox. Resolver timeouts/failures are Unknown. Results can differ as DNS changes. The service never sends messages or probes SMTP.

The API host must permit outbound DNS lookups. If deployment networking blocks them, MailSure cannot determine mail routing and reports an inconclusive result as Unknown. The Render free service can also have a cold start after inactivity.

## Production configuration

- Vercel project: mail_checker_, connected to the copied GitHub repository Satwik1428/mail_checker_. Production domain: mailchecker-pi.vercel.app.
- Render API service: mailsure-api.onrender.com.
- The Vercel build must use VITE_API_URL=https://mailsure-api.onrender.com.
- Render must allow CLIENT_URL=https://mailchecker-pi.vercel.app.
- Keep the original source repository and Vercel's copied repository in sync if continuing development; the production project currently deploys from the copied mail_checker_ repository.
