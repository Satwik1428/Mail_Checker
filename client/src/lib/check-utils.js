export function parseAddresses(value) {
  const entered = (typeof value === 'string' ? value : '')
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean)
  const seen = new Set()
  const addresses = entered.filter((email) => {
    const key = email.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { addresses, duplicatesRemoved: entered.length - addresses.length }
}

export function summarizeResults(results = []) {
  return results.reduce((counts, row) => {
    if (row.classification === 'Likely Deliverable') counts.deliverable += 1
    else if (row.classification === 'Likely to Bounce') counts.bounce += 1
    else counts.unknown += 1
    return counts
  }, { deliverable: 0, bounce: 0, unknown: 0 })
}

export function displayCheck(value, labels = { yes: 'Yes', no: 'No' }) {
  if (value === true) return labels.yes
  if (value === false) return labels.no
  if (value === 'not_checked') return 'Not checked'
  if (value === null || value === undefined) return 'Unavailable'
  return String(value)
}

export function routeLabel(checks = {}) {
  if (checks.mx === true) return 'MX records'
  if (checks.addressFallback === true) return 'A / AAAA fallback'
  if (checks.mx === false) return 'No mail route'
  return 'Unavailable'
}

export function mailboxLabel(value) {
  if (value === null || value === undefined) return 'Unavailable'
  return 'Not checked'
}

export function csvCell(value) {
  let text = String(value ?? '')
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

export function buildCsvContent(rows = []) {
  const columns = ['Row', 'Email', 'Classification', 'Explanation', 'Syntax', 'MX', 'Route', 'Mailbox']
  const lines = [columns, ...rows.map((row, index) => {
    const checks = row.checks || {}
    return [
      index + 1,
      row.email,
      row.classification,
      row.explanation,
      displayCheck(checks.syntax, { yes: 'Valid', no: 'Invalid' }),
      displayCheck(checks.mx, { yes: 'Found', no: 'Not found' }),
      routeLabel(checks),
      mailboxLabel(checks.mailbox),
    ]
  })]
  return lines.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
