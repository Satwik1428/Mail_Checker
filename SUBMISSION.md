# MailSure — Project Submission

## Live demo

- Website: https://mailchecker-pi.vercel.app/
- API health: https://mailsure-api.onrender.com/api/health
- GitHub source: https://github.com/Satwik1428/Mail_Checker

## Summary

MailSure checks email syntax and domain-level DNS mail routing for a pasted list. It identifies malformed addresses and domains without a mail route, while marking a found route as Unknown until the individual mailbox can be verified. The application does not send email or probe SMTP mailboxes.

## Features

- Batch input with case-insensitive duplicate removal and a 50-address limit.
- Syntax checks, DNS MX checks, and implicit A/AAAA fallback when no MX record set exists.
- Three result categories: Likely Deliverable, Likely to Bounce, and Unknown. DNS evidence alone does not produce Likely Deliverable.
- Per-address explanations, summary stamps, search, filters, and CSV export.
- Last input and results restored after reload using browser local storage.
- React/Vite frontend and Express API.

## Final verification

- Live Vercel page returned HTTP 200 with the MailSure page title.
- Live Render health endpoint returned status ok.
- Live CORS preflight returned HTTP 204 and allowed https://mailchecker-pi.vercel.app.
- After deploying backend commit 5f68380, I reran the three-address list through the live UI. Analysis completed with 3 results: 0 Likely Deliverable, 1 Likely to Bounce, and 2 Unknown.
  - alice@gmail.com — Unknown; five MX records found, but the individual mailbox was not verified.
  - not-an-email — Likely to Bounce; invalid syntax.
  - test@nonexistent-domain-987654321.example — Unknown; DNS returned ENOTFOUND.
- A direct DNS-only API check of asdkjh38492@gmail.com also returned Unknown because DNS cannot verify an individual mailbox. No SMTP connections or emails were sent.
- Export CSV opened the browser's Save dialog. The CSV was not saved or inspected as a file.
- Frontend automated tests: 9 passed, 0 failed. Backend automated tests: 5 passed, 0 failed. Frontend lint and production build passed.
- A best-effort scan found no tracked .env/credential-named files and no common API-key or private-key signatures in the available Git history.
- The front-end source files compared match between the Vercel-connected copy and the submitted source. Render deploys the backend from the submitted Mail_Checker repository at commit 5f68380. Vercel's repository copy has a separate commit history.

## Honest limitations

A valid address with an MX or fallback route is Unknown because MailSure does not verify the individual mailbox. Invalid syntax or a confirmed absence of DNS mail-routing records is Likely to Bounce. Resolver failures and timeouts are Unknown. DNS data can change. No result guarantees inbox delivery.

MailSure does not implement SMTP checks. Render's current Free service policy blocks outbound SMTP ports 25, 465, and 587, and port 25 is blocked on all Render services. See [Render Free instance limitations](https://render.com/docs/free). The API also needs outbound DNS access. The Render Free service may sleep while idle and have a cold-start delay.

The browser stores the last input and results in local storage on that device. The README includes the actual product artwork; I did not include the older reference image as an application screenshot because its fixed example counts could be mistaken for real results.

## Production configuration

- Vercel project: mail_checker_, production domain mailchecker-pi.vercel.app.
- Render API: mailsure-api.onrender.com, deployed from the original Mail_Checker repository.
- Vercel production VITE_API_URL: https://mailsure-api.onrender.com.
- Render CLIENT_URL: https://mailchecker-pi.vercel.app.
- The Vercel-connected repository is a copy. The frontend source files match the submitted repo; future frontend changes must be synchronized or Vercel must be reconnected to the original repository.
