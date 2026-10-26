import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCsvContent,
  csvCell,
  displayCheck,
  mailboxLabel,
  parseAddresses,
  routeLabel,
  summarizeResults,
} from '../src/lib/check-utils.js'

test('parses separators, removes case-insensitive duplicates, and preserves first spelling', () => {
  const parsed = parseAddresses('Alice@example.com, bob@example.com; ALICE@example.com\nthird@example.net')
  assert.deepEqual(parsed.addresses, ['Alice@example.com', 'bob@example.com', 'third@example.net'])
  assert.equal(parsed.duplicatesRemoved, 1)
})

test('empty or non-string input produces no addresses', () => {
  assert.deepEqual(parseAddresses(' \n,;  '), { addresses: [], duplicatesRemoved: 0 })
  assert.deepEqual(parseAddresses(null), { addresses: [], duplicatesRemoved: 0 })
})

test('summarizes all supported classifications and treats unrecognized values as unknown', () => {
  const results = [
    { classification: 'Likely Deliverable' },
    { classification: 'Likely to Bounce' },
    { classification: 'Unknown' },
    { classification: 'Future status' },
  ]
  assert.deepEqual(summarizeResults(results), { deliverable: 1, bounce: 1, unknown: 2 })
  assert.deepEqual(summarizeResults(), { deliverable: 0, bounce: 0, unknown: 0 })
})

test('CSV cells quote delimiters and neutralize spreadsheet formulas', () => {
  assert.equal(csvCell('a,"b"\nnext'), '"a,""b""\nnext"')
  assert.equal(csvCell('  =1+1'), '"\'  =1+1"')
  assert.equal(csvCell('@SUM(A1:A2)'), '"\'@SUM(A1:A2)"')
})

test('CSV export keeps route and mailbox findings truthful', () => {
  const csv = buildCsvContent([{
    email: 'person@example.com',
    classification: 'Likely Deliverable',
    explanation: 'Domain route found',
    checks: { syntax: true, mx: true, addressFallback: false, mailbox: 'not_checked' },
  }])
  assert.match(csv, /^"Row","Email","Classification"/)
  assert.match(csv, /"Valid","Found","MX records","Not checked"/)
  assert.equal(routeLabel({ addressFallback: true }), 'A / AAAA fallback')
  assert.equal(displayCheck(null, { yes: 'Valid', no: 'Invalid' }), 'Unavailable')
  assert.equal(mailboxLabel('not_checked'), 'Not checked')
})
