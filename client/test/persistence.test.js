import test from 'node:test'
import assert from 'node:assert/strict'
import { readSavedCheck, writeSavedCheck } from '../src/lib/persistence.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('saved input and completed results restore after reload', () => {
  const storage = memoryStorage()
  const results = [{ email: 'one@example.com', classification: 'Unknown', checks: {} }]
  assert.equal(writeSavedCheck('one@example.com', results, storage), true)
  assert.deepEqual(readSavedCheck(storage), { addressText: 'one@example.com', results })
})

test('missing or malformed storage returns a clean state', () => {
  const storage = memoryStorage({ 'mailsure.saved-check.v1': '{bad json' })
  assert.deepEqual(readSavedCheck(storage), { addressText: '', results: null })
})

test('storage failures do not crash checking or app startup', () => {
  const brokenStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }
  assert.deepEqual(readSavedCheck(brokenStorage), { addressText: '', results: null })
  assert.equal(writeSavedCheck('test@example.com', null, brokenStorage), false)
})

test('unsupported saved result shapes are ignored while retaining the input', () => {
  const storage = memoryStorage({
    'mailsure.saved-check.v1': JSON.stringify({ version: 1, addressText: 'broken entry', results: [{ classification: 'Unknown' }] }),
  })
  assert.deepEqual(readSavedCheck(storage), { addressText: 'broken entry', results: null })
})
