import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  ArrowDownToLine,
  CircleCheck,
  CircleX,
  Clock3,
  CircleHelp,
  FileText,
  Mail,
  ShieldCheck,
  Search,
  X,
} from 'lucide-react'
import Loader from './components/kokonutui/loader.jsx'
import ParticleButton from './components/kokonutui/particle-button.jsx'
import { buildCsvContent, displayCheck, mailboxLabel, parseAddresses, routeLabel, summarizeResults } from './lib/check-utils.js'
import { readSavedCheck, writeSavedCheck } from './lib/persistence.js'
import './App.css'

const configuredLimit = Number(import.meta.env.VITE_MAX_EMAILS)
const MAX_EMAILS = Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 50
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')
const SAMPLE_LIST = 'mailsure-demo@gmail.com\nnot-an-email\nno-route@example.test'

function exportResults(rows) {
  const blob = new Blob(['\uFEFF' + buildCsvContent(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'mailsure-results-' + new Date().toISOString().slice(0, 10) + '.csv'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function StatusStamp({ classification, count }) {
  const isDeliverable = classification === 'Likely Deliverable'
  const isBounce = classification === 'Likely to Bounce'
  const stampClass = isDeliverable ? 'success' : isBounce ? 'bounce' : 'unknown'
  const image = isDeliverable ? 'deliverable' : isBounce ? 'bounce' : 'unknown'
  const caption = isDeliverable ? 'LIKELY · DNS ROUTE' : isBounce ? 'SYNTAX / NO ROUTE' : 'CHECK INCOMPLETE'
  return (
    <div className={"summary-stamp summary-stamp--" + stampClass} role="img" aria-label={count + " " + classification}>
      <img className="summary-stamp-art" src={"/images/stamps/" + image + ".png"} alt="" aria-hidden="true" />
      <span className="summary-stamp-count" aria-hidden="true">{count.toString().padStart(2, '0')}</span>
      <span className="summary-stamp-caption" aria-hidden="true">{caption}</span>
    </div>
  )
}
function ClassificationBadge({ classification }) {
  const kind = classification === 'Likely Deliverable'
    ? 'success'
    : classification === 'Likely to Bounce'
      ? 'bounce'
      : 'unknown'
  const Icon = kind === 'success' ? CircleCheck : kind === 'bounce' ? CircleX : Clock3
  return (
    <span className={`classification-badge classification-badge--${kind}`}>
      <Icon aria-hidden="true" size={13} strokeWidth={2.2} />
      {classification}
    </span>
  )
}

function CheckValue({ value, labels }) {
  const text = displayCheck(value, labels)
  const state = value === true ? 'yes' : value === false ? 'no' : value === 'not_checked' ? 'pending' : 'unavailable'
  const Icon = state === 'yes' ? CircleCheck : state === 'no' ? CircleX : state === 'pending' ? Clock3 : CircleHelp
  return <span className={"check-value check-value--" + state}><Icon aria-hidden="true" size={13} strokeWidth={2.3} />{text}</span>
}
function EmptyLedger() {
  return (
    <div className="ledger-empty">
      <div className="empty-envelope" aria-hidden="true"><Mail size={23} strokeWidth={1.25} /></div>
      <p className="empty-overline">THE LEDGER IS OPEN</p>
      <h3>No addresses yet.</h3>
      <p>Add a list to see syntax and mail-routing findings here.</p>
    </div>
  )
}

function App() {
  const formRef = useRef(null)
  const [savedCheck] = useState(readSavedCheck)
  const [addressText, setAddressText] = useState(savedCheck.addressText)
  const [results, setResults] = useState(savedCheck.results)
  const [isLoading, setIsLoading] = useState(false)
  const [requestStatus, setRequestStatus] = useState('idle')
  const [error, setError] = useState('')
  const [sampleLoaded, setSampleLoaded] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    writeSavedCheck(addressText, results)
  }, [addressText, results])

  const { addresses, duplicatesRemoved } = useMemo(() => parseAddresses(addressText), [addressText])
  const canSubmit = addresses.length > 0 && addresses.length <= MAX_EMAILS && !isLoading
  const summary = useMemo(() => summarizeResults(results || []), [results])

  async function handleCheck(event) {
    event.preventDefault()
    if (!addresses.length || addresses.length > MAX_EMAILS || isLoading) return

    setError('')
    setIsLoading(true)
    setRequestStatus('pending')
    setResults(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/check`, { emails: addresses })
      if (!Array.isArray(response.data?.results)) {
        throw new Error('The API response did not include a results list.')
      }
      setResults(response.data.results)
      setRequestStatus('success')
    } catch (requestError) {
      const isNetworkFailure = requestError.isAxiosError && !requestError.response
      const message = requestError.response?.data?.error
        || (isNetworkFailure
          ? 'Could not reach the MailSure API. Check that the backend is running and its CORS origin matches this page.'
          : requestError.message)
        || 'The check could not be completed. Please try again.'
      setError(message)
      setRequestStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  function updateInput(value, fromSample = false) {
    setAddressText(value)
    setResults(null)
    setError('')
    setRequestStatus('idle')
    setSampleLoaded(fromSample)
  }

  function handleInputChange(event) {
    updateInput(event.target.value)
  }

  function handleInputKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canSubmit) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const filteredResults = useMemo(() => (results || []).filter((row) => {
    const matchesFilter = activeFilter === 'All'
      || (activeFilter === 'Deliverable' && row.classification === 'Likely Deliverable')
      || (activeFilter === 'Bounce' && row.classification === 'Likely to Bounce')
      || (activeFilter === 'Unknown' && row.classification === 'Unknown')
    return matchesFilter && row.email.toLowerCase().includes(searchQuery.trim().toLowerCase())
  }), [results, activeFilter, searchQuery])

  const hasResults = Array.isArray(results)
  const ledgerMode = isLoading ? 'loading' : error ? 'error' : hasResults ? 'results' : 'empty'

  return (
    <div className="post-office" id="top">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="MailSure home">
          <span className="wordmark-mark"><ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <span>MailSure<span className="wordmark-period">.</span></span>
          <span className="wordmark-caption">THE NIGHT POST OFFICE</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#checker">Email checker</a>
          <a href="#method">How It Works</a>
          <a href="#faq">FAQ</a>
        </nav>
        <span className="header-status"><span aria-hidden="true" /> DNS / MX LOOKUPS</span>
      </header>

      <main className="page-wrap">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-rule" /> MAILSURE FIELD NOTE <span className="eyebrow-number">NO. 01</span></p>
            <h1 id="hero-title">Know your list.<br /><em>Before you send.</em></h1>
            <p className="hero-deck">Validate email syntax. Check domain mail routing. Understand what your results can—and cannot—tell you.</p>
            <ul className="feature-list" aria-label="What MailSure checks">
              <li><span>01</span><strong>Fast &amp; simple</strong><small>Paste a list, get a clear read.</small></li>
              <li><span>02</span><strong>Reliable checks</strong><small>Syntax and DNS / MX records.</small></li>
              <li><span>03</span><strong>Transparent results</strong><small>No claims beyond the evidence.</small></li>
            </ul>
          </div>
          <figure className="hero-seal">
            <img
              className="hero-artwork"
              src="/images/mailsure-envelope-ensemble.png"
              alt="MailSure envelope with an antique brass verification stamp on a deep green postal desk"
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <figcaption>THE NIGHT POST OFFICE · MAIL ROUTING INSPECTION</figcaption>
          </figure>
        </section>

        <section className="desk-layout" id="checker" aria-label="Email list checker">
          <section className="letter-tray" aria-labelledby="tray-title">
            <div className="tray-heading">
              <div>
                <p className="section-index section-index--paper">01 <span>—</span> ADD YOUR EMAIL LIST</p>
                <h2 id="tray-title">The letter tray</h2>
              </div>
              <span className="tray-limit">MAX {MAX_EMAILS}</span>
            </div>
            <p className="tray-intro">One address per line, or separate with commas, semicolons, or spaces.</p>

            <form ref={formRef} onSubmit={handleCheck} noValidate>
              <label className="input-label" htmlFor="email-list">Email addresses <span>PASTE OR TYPE</span></label>
              <div className="address-window">
                <textarea
                  id="email-list"
                  name="emails"
                  rows={8}
                  spellCheck="false"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder={'name@company.com\nhello@example.org\n\nSeparate each address with a line, comma, or space.'}
                  value={addressText}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  aria-describedby="input-hint address-count duplicate-count sample-note"
                  aria-invalid={addresses.length > MAX_EMAILS}
                />
                {addressText && (
                  <button className="clear-input" type="button" onClick={() => updateInput('')} aria-label="Clear email addresses">
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
                <span className="window-corner window-corner--tl" aria-hidden="true" />
                <span className="window-corner window-corner--br" aria-hidden="true" />
              </div>
              <div className="input-readout">
                <span id="input-hint">Syntax is checked per address; duplicates are checked once.</span>
                <span id="address-count" className={addresses.length > MAX_EMAILS ? 'count-over' : ''}>
                  <strong>{addresses.length}</strong> / {MAX_EMAILS} unique
                </span>
              </div>
              <p className="duplicate-readout" id="duplicate-count" aria-live="polite">
                {duplicatesRemoved > 0 ? `${duplicatesRemoved} duplicate${duplicatesRemoved === 1 ? '' : 's'} removed` : 'Duplicates are ignored automatically'}
              </p>
              {addresses.length > MAX_EMAILS && (
                <p className="limit-message" role="status">This list is over the {MAX_EMAILS}-address limit. Remove {addresses.length - MAX_EMAILS} address{addresses.length - MAX_EMAILS === 1 ? '' : 'es'} to continue.</p>
              )}
              <p className="sample-note" id="sample-note" aria-live="polite">
                {sampleLoaded && hasResults
                  ? 'Sample addresses checked against current DNS. No mailbox probe was performed.'
                  : sampleLoaded
                    ? 'Sample input loaded. Results appear only after the live check.'
                    : '\u00a0'}
              </p>

              <div className="tray-actions">
                <div className="secondary-actions">
                  <button className="sample-action" type="button" onClick={() => updateInput(SAMPLE_LIST, true)}>
                    <FileText size={15} aria-hidden="true" /> Try sample list
                  </button>
                  <button className="clear-action" type="button" onClick={() => updateInput('')} disabled={!addressText}>
                    Clear
                  </button>
                </div>
                <ParticleButton
                  type="button"
                  status={requestStatus}
                  pendingLabel="Inspecting routes"
                  successLabel="Analysis complete"
                  errorLabel="Retry analysis"
                  particles={false}
                  disabled={!canSubmit}
                  onClick={() => formRef.current?.requestSubmit()}
                  className="primary-action"
                >
                  Analyze email list
                </ParticleButton>
              </div>
              <p className="tray-footnote"><ShieldCheck size={14} aria-hidden="true" /> DNS checks only. No messages are sent.</p>
            </form>
          </section>

        <section className="method-section" id="method" aria-labelledby="method-title">
          <div className="method-heading">
            <p className="section-index"><span className="eyebrow-rule" /> THE INSPECTION METHOD</p>
            <h2 id="method-title">Three checks. No guesswork.</h2>
          </div>
          <div className="method-steps">
            <article><span>01</span><h3>Syntax</h3><p>We check whether each address follows a common email format.</p></article>
            <article><span>02</span><h3>Mail routing</h3><p>We look for MX records, with an A / AAAA fallback when MX is absent.</p></article>
            <article><span>03</span><h3>Honest result</h3><p>A route suggests the domain can receive mail. It does not prove that a mailbox exists.</p></article>
          </div>
        </section>



          <section className="verification-ledger" aria-labelledby="ledger-title">
            <div className="ledger-heading">
              <div>
                <p className="section-index">02 <span>—</span> VERIFICATION LEDGER</p>
                <h2 id="ledger-title">Results</h2>
              </div>
              {hasResults && results.length > 0 && (
                <button className="export-action" type="button" onClick={() => exportResults(results)}>
                  <ArrowDownToLine size={15} aria-hidden="true" /> <span>Export CSV</span>
                </button>
              )}
            </div>

            {ledgerMode === 'empty' && <EmptyLedger />}

            {ledgerMode === 'loading' && (
              <div className="ledger-loading" aria-label="Checking email routes">
                <Loader
                  size="sm"
                  title="Reading the mail route"
                  subtitle="Checking syntax and domain records. This may take a few seconds."
                  className="post-loader"
                />
                <div className="skeleton-ledger" aria-hidden="true">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {ledgerMode === 'error' && (
              <div className="ledger-error" role="alert">
                <span className="error-mark" aria-hidden="true"><X size={17} /></span>
                <p className="ledger-overline">DELIVERY TO THE DESK FAILED</p>
                <h3>We couldn’t complete this check.</h3>
                <p>{error}</p>
                <button className="retry-action" type="button" onClick={() => formRef.current?.requestSubmit()} disabled={!canSubmit}>Retry with this list</button>
                <span className="preserved-note">Your input is still here.</span>
              </div>
            )}

            {ledgerMode === 'results' && results.length === 0 && (
              <div className="ledger-empty"><h3>No results were returned.</h3><p>Try the list again in a moment.</p></div>
            )}

            {ledgerMode === 'results' && results.length > 0 && (
              <div className="ledger-results">
                <div className="ledger-summary-heading" role="status" aria-live="polite">
                  <span>{results.length} address{results.length === 1 ? '' : 'es'} checked</span>
                  <span className="ledger-updated">LIVE DNS RESULT</span>
                </div>
                <div className="stamp-grid" role="group" aria-label="Classification summary">
                  <StatusStamp classification="Likely Deliverable" count={summary.deliverable} />
                  <StatusStamp classification="Likely to Bounce" count={summary.bounce} />
                  <StatusStamp classification="Unknown" count={summary.unknown} />
                </div>
                <div className="ledger-tools">
                  <div className="ledger-filters" role="group" aria-label="Filter results">
                    {['All', 'Deliverable', 'Bounce', 'Unknown'].map((filter) => (
                      <button key={filter} type="button" className={activeFilter === filter ? 'ledger-filter is-active' : 'ledger-filter'} aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)}>
                        {filter} <span>{filter === 'All' ? results.length : filter === 'Deliverable' ? summary.deliverable : filter === 'Bounce' ? summary.bounce : summary.unknown}</span>
                      </button>
                    ))}
                  </div>
                  <label className="ledger-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Search email addresses</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search email…" /></label>
                </div>
                {filteredResults.length === 0 && <p className="ledger-no-match" role="status">No addresses match this filter.</p>}
                <div className="results-ledger-table-wrap">
                  <table className="results-ledger-table">
                    <thead>
                      <tr>
                        <th scope="col" className="row-number-heading">#</th>
                        <th scope="col">ADDRESS / FINDING</th>
                        <th scope="col">SYNTAX</th>
                        <th scope="col">MX</th>
                        <th scope="col">MAILBOX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((row, index) => {
                        const checks = row.checks || {}
                        return (
                          <tr key={`${row.email}-${index}`}>
                            <td className="row-number" data-label="#">{String(index + 1).padStart(2, '0')}</td>
                            <td className="address-finding" data-label="Address / finding">
                              <code className="result-address">{row.email}</code>
                              <ClassificationBadge classification={row.classification} />
                              <p>{row.explanation || 'No explanation was returned by the API.'}</p>
                            </td>
                            <td data-label="Syntax"><CheckValue value={checks.syntax} labels={{ yes: 'Valid', no: 'Invalid' }} /></td>
                            <td data-label="MX"><CheckValue value={checks.mx} labels={{ yes: 'Found', no: 'Not found' }} /><small className="route-detail">{routeLabel(checks)}</small></td>
                            <td data-label="Mailbox"><span className="check-value check-value--pending"><Clock3 aria-hidden="true" size={13} strokeWidth={2.3} />{mailboxLabel(checks.mailbox)}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </section>

      </main>

      <footer className="post-footer" id="faq">
        <a className="footer-wordmark" href="#top"><ShieldCheck size={16} aria-hidden="true" /> MailSure<span>.</span></a>
        <p>DNS / MX checks indicate that a domain has mail-routing records. They do not confirm that an individual mailbox exists or guarantee inbox delivery.</p>
        <span className="footer-edition">THE NIGHT POST OFFICE <span>·</span> 01</span>
      </footer>
    </div>
  )
}

export default App
