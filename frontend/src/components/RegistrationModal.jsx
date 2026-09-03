import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiBase } from '../lib/api';
import { NotchedButton } from './ui/NotchedButton/NotchedButton';
import { HudCorners } from './ui/HudCorners/HudCorners';
import './RegistrationModal.css';

const emptyForm = { name: '', college: '', phone: '', email: '', foodPreference: '' };

const createPaymentReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NOC26-${timestamp}-${random}`.slice(0, 35);
};

const isCategoryTech = (cat) => {
  const c = String(cat || '').toLowerCase().trim();
  return c === 'technical' || c === 'tech';
};

const isCategoryNonTech = (cat) => {
  const c = String(cat || '').toLowerCase().trim();
  return c === 'non-technical' || c === 'non-tech' || c === 'non technical';
};

const isCategoryWorkshop = (cat) => {
  const c = String(cat || '').toLowerCase().trim();
  return c === 'workshop';
};

export default function RegistrationModal({ events, registrationOpen, initialEventId, onClose }) {
  const closeButtonRef = useRef(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const initialEvent = events.find((event) => event.id === initialEventId);
  const [workshopEventId, setWorkshopEventId] = useState(isCategoryWorkshop(initialEvent?.category) ? initialEventId : '');
  const [technicalEventId, setTechnicalEventId] = useState(!isCategoryWorkshop(initialEvent?.category) && isCategoryTech(initialEvent?.category) ? initialEventId : '');
  const [nonTechnicalEventId, setNonTechnicalEventId] = useState(!isCategoryWorkshop(initialEvent?.category) && isCategoryNonTech(initialEvent?.category) ? initialEventId : '');
  const [igniteAbstract, setIgniteAbstract] = useState('');
  const [paymentReference] = useState(createPaymentReference);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [utr, setUtr] = useState('');
  const [utrStatus, setUtrStatus] = useState({ state: 'idle', message: 'Enter all 12 digits to check this UTR.' });
  const [consent, setConsent] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState('');

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showUpiFallback, setShowUpiFallback] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUpiClick = () => {
    window.setTimeout(() => {
      if (document.hasFocus()) {
        setShowUpiFallback(true);
      }
    }, 2000);
  };

  const copyUpiId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const technicalEvents = useMemo(() => (events || []).filter((event) => isCategoryTech(event.category)), [events]);
  const nonTechnicalEvents = useMemo(() => (events || []).filter((event) => isCategoryNonTech(event.category)), [events]);
  const workshopEvents = useMemo(() => (events || []).filter((event) => isCategoryWorkshop(event.category)), [events]);

  const selectedTechnicalEvent = useMemo(() => (events || []).find((event) => event.id === technicalEventId), [technicalEventId, events]);
  const selectedNonTechnicalEvent = useMemo(() => (events || []).find((event) => event.id === nonTechnicalEventId), [nonTechnicalEventId, events]);
  const selectedWorkshopEvent = useMemo(() => (events || []).find((event) => event.id === workshopEventId), [workshopEventId, events]);

  const workshopSelected = Boolean(workshopEventId);
  const ctfSelected = !workshopSelected && (technicalEventId === 'ctf' || technicalEventId === 'cyber-heist-ctf');

  const selectedEvents = useMemo(() => {
    if (workshopSelected) {
      return [selectedWorkshopEvent].filter(Boolean);
    }
    return [selectedTechnicalEvent, ctfSelected ? null : selectedNonTechnicalEvent].filter(Boolean);
  }, [workshopSelected, selectedWorkshopEvent, selectedTechnicalEvent, ctfSelected, selectedNonTechnicalEvent]);

  const selectedEventNames = selectedEvents.map((event) => event.name).join(' + ');
  const hasWorkshop = workshopSelected || selectedEvents.some(
    (event) => (event.category || '').toLowerCase() === 'workshop' || event.id === 'playground-of-hackers' || event.id === 'art-of-hacking' || event.fee === 300
  );
  const amount = !selectedEvents.length ? 0 : hasWorkshop ? 300 : 150;
  const upiId = (import.meta.env.VITE_UPI_ID || '').trim() || '7695827158@okbizaxis';
  const payee = (import.meta.env.VITE_UPI_PAYEE || '').trim() || 'balakumaran';
  const paymentConfigured = Boolean(upiId) || import.meta.env.DEV;
  const upiLink = useMemo(() => {
    if (!selectedEvents.length || !amount || !upiId) return '';
    const parameters = new URLSearchParams({
      pa: upiId,
      pn: payee,
      am: amount.toFixed(2),
      tr: paymentReference,
      tn: `Noctivus 26 - ${selectedEventNames}`,
      cu: 'INR',
    });
    return `upi://pay?${parameters.toString()}`;
  }, [amount, payee, paymentReference, selectedEventNames, selectedEvents.length, upiId]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (step !== 4 || !upiLink) return undefined;
    let active = true;
    setQrDataUrl('');
    import('qrcode').then(({ toDataURL }) => toDataURL(upiLink, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0c0a09', light: '#ffffff' },
    })).then((url) => active && setQrDataUrl(url)).catch(() => active && setError('The payment QR could not be generated. Use the UPI app button instead.'));
    return () => { active = false; };
  }, [step, upiLink]);

  useEffect(() => {
    if (!receipt?.registrationId) return undefined;
    let active = true;
    const rootStyles = getComputedStyle(document.documentElement);
    import('qrcode').then(({ toDataURL }) => toDataURL(receipt.registrationId, {
      width: 180,
      margin: 1,
      color: { dark: '#0c0a09', light: '#e8ede8' },
    })).then((url) => active && setReceiptQrDataUrl(url)).catch(() => {});
    return () => { active = false; };
  }, [receipt]);

  useEffect(() => {
    if (utr.length !== 12) {
      setUtrStatus({ state: 'idle', message: `${utr.length}/12 digits entered.` });
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUtrStatus({ state: 'checking', message: 'Checking for a duplicate UTR…' });
      try {
        const apiBase = getApiBase();
        const response = await fetch(`${apiBase}/api/utr/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ utrNumber: utr }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Unable to check this UTR.');
        setUtrStatus(data.available
          ? { state: 'available', message: 'UTR is available and ready to submit.' }
          : { state: 'duplicate', message: data.message || 'This UTR has already been submitted.' });
      } catch (checkError) {
        if (checkError.name !== 'AbortError') setUtrStatus({ state: 'error', message: checkError.message || 'Unable to check this UTR right now.' });
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [utr]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const continueToEvents = () => {
    if (form.name.trim().length < 2) return setError('Enter your full name.');
    if (form.college.trim().length < 2) return setError('Enter your college name.');
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) return setError('Enter a valid 10-digit mobile number.');
    if (/[A-Z]/.test(form.email)) return setError('Please type your email ID in small letters (lowercase) only.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.');
    if (!['veg', 'non-veg'].includes(form.foodPreference)) return setError('Choose a food preference.');
    setError('');
    setStep(2);
  };

  const continueToReview = () => {
    if (!selectedEvents.length) return setError('Choose at least one event, or choose Nil only if you are not registering for events.');
    if (technicalEventId === 'ignite' && !igniteAbstract.trim()) {
      return setError('Please enter your project idea or abstract for IGNITE (up to 200 characters).');
    }
    if (technicalEventId === 'ignite' && igniteAbstract.length > 200) {
      return setError('IGNITE abstract must not exceed 200 characters.');
    }
    setError('');
    setStep(3);
  };

  const continueToPayment = () => {
    setError('');
    setStep(4);
  };

  const submitRegistration = async (event) => {
    event.preventDefault();
    if (!/^\d{12}$/.test(utr)) return setError('Enter the 12-digit UTR/reference number shown in your payment app.');
    if (utrStatus.state === 'duplicate') return setError('This UTR has already been submitted. Enter the UTR from your own payment.');
    if (utrStatus.state === 'checking') return setError('Wait a moment while we check this UTR.');
    if (!consent) return setError('Confirm the payment and privacy declaration to continue.');

    setSubmitting(true);
    setError('');
    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant: {
            ...form,
            name: form.name.trim().toUpperCase(),
            college: form.college.trim().toUpperCase(),
            phone: form.phone.replace(/\D/g, ''),
            email: form.email.trim().toLowerCase(),
            igniteTopic: technicalEventId === 'ignite' ? igniteAbstract.trim() : '',
          },
          events: selectedEvents.map((item) => ({
            eventId: item.id,
            teamSize: 1,
            teamMembers: [],
            abstract: item.id === 'ignite' ? igniteAbstract.trim() : undefined,
          })),
          paymentReference,
          utrNumber: utr,
          claimedAmount: amount,
          consent: { privacyAccepted: true, rulesAccepted: true },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Registration could not be submitted.');
      setReceipt(data);
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to reach the registration server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reg-modal-shell" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <HudCorners accent="cyan">
        <section className="reg-modal-panel panel" role="dialog" aria-modal="true" aria-labelledby="registration-title">
          
          {/* Header */}
          <header className="reg-header">
            <div className="reg-title-wrap">
              <span className="reg-kicker">EVENT REGISTRATION</span>
              <h2 className="reg-title" id="registration-title">
                {receipt ? 'CONFIRMED' : step === 1 ? 'DETAILS' : step === 2 ? 'EVENTS' : step === 3 ? 'VERIFY' : 'PAYMENT'}
              </h2>
            </div>
            <button ref={closeButtonRef} className="reg-close" onClick={onClose} aria-label="Close registration">
              <span>CLOSE</span> [X]
            </button>
          </header>

          {/* Progress node line */}
          {!receipt && (
            <div className="reg-progress" aria-label={`Registration step ${step} of 4`}>
              <span className={`reg-step-node ${step >= 1 ? 'active' : ''}`}>01 DETAILS</span>
              <span className="reg-step-line" />
              <span className={`reg-step-node ${step >= 2 ? 'active' : ''}`}>02 EVENTS</span>
              <span className="reg-step-line" />
              <span className={`reg-step-node ${step >= 3 ? 'active' : ''}`}>03 VERIFY</span>
              <span className="reg-step-line" />
              <span className={`reg-step-node ${step >= 4 ? 'active' : ''}`}>04 PAYMENT</span>
            </div>
          )}

          {!registrationOpen && (
            <div className="reg-body" style={{ textAlign: 'center', padding: '2rem 0' }}>
              <h3 className="reg-title" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>SUBMISSIONS TEMPORARILY LOCKED</h3>
              <p style={{ color: 'var(--muted)', fontFamily: 'IBM Plex Mono', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Registration is closed. Submissions have not been activated by college coordinators.
              </p>
              <NotchedButton variant="primary" onClick={onClose}>
                RETURN TO LOBBY
              </NotchedButton>
            </div>
          )}

          {/* Step 1: Details */}
          {registrationOpen && !receipt && step === 1 && (
            <div className="reg-body">
              <div className="reg-field-grid">
                <div className="reg-field">
                  <label className="reg-field-label">Full name</label>
                  <input className="reg-input" type="text" value={form.name} onChange={(e) => update('name', e.target.value.toUpperCase())} autoComplete="name" />
                </div>
                <div className="reg-field">
                  <label className="reg-field-label">College name</label>
                  <input className="reg-input" type="text" value={form.college} onChange={(e) => update('college', e.target.value.toUpperCase())} autoComplete="organization" />
                </div>
                <div className="reg-field">
                  <label className="reg-field-label">Phone number</label>
                  <input className="reg-input" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} autoComplete="tel" />
                </div>
                <div className="reg-field">
                  <label className="reg-field-label">Email ID</label>
                  <input className="reg-input" type="email" value={form.email} onChange={(e) => { setError(''); update('email', e.target.value); }} autoComplete="email" />
                  {/[A-Z]/.test(form.email) && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span className="reg-error">⚠️ Lowercase characters expected.</span>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', padding: 0, textDecoration: 'underline' }}
                        onClick={() => update('email', form.email.toLowerCase())}
                      >
                        Convert to lowercase
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <fieldset className="reg-food-fieldset">
                <legend className="reg-food-legend">Food Preference</legend>
                <div className="reg-food-options">
                  <label className="reg-food-label">
                    <input className="reg-food-input" type="radio" name="food-preference" value="veg" checked={form.foodPreference === 'veg'} onChange={() => update('foodPreference', 'veg')} />
                    <span>VEGETARIAN</span>
                  </label>
                  <label className="reg-food-label">
                    <input className="reg-food-input" type="radio" name="food-preference" value="non-veg" checked={form.foodPreference === 'non-veg'} onChange={() => update('foodPreference', 'non-veg')} />
                    <span>NON-VEGETARIAN</span>
                  </label>
                </div>
              </fieldset>

              {error && <p className="reg-error" role="alert">{error}</p>}

              <div className="reg-actions">
                <NotchedButton variant="primary" onClick={continueToEvents}>
                  CHOOSE EVENTS &gt;
                </NotchedButton>
              </div>
            </div>
          )}

          {/* Step 2: Choose Events */}
          {registrationOpen && !receipt && step === 2 && (
            <div className="reg-body">
              <div className="reg-review-event-card">
                <div>
                  <h4 className="reg-review-event-title" style={{ fontSize: '1rem' }}>TICKET DETAILS</h4>
                  <span className="reg-review-event-category">Admission for selected options</span>
                </div>
                <strong className="reg-review-amount">₹{amount}</strong>
              </div>

              <div className="reg-field-grid">
                {/* Workshop Dropdown */}
                <div className="reg-field reg-field--full">
                  <label className="reg-field-label">Workshop (Exclusive Entry — ₹300)</label>
                  <select
                    className="reg-input"
                    value={workshopEventId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWorkshopEventId(val);
                      if (val) {
                        setTechnicalEventId('');
                        setNonTechnicalEventId('');
                        setIgniteAbstract('');
                      }
                      setError('');
                    }}
                  >
                    <option value="">Nil (Choose Regular Technical &amp; Non-Technical Events)</option>
                    {workshopEvents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — ₹{item.fee || 300}
                      </option>
                    ))}
                  </select>
                  {workshopSelected && (
                    <small style={{ color: 'var(--cyan)', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block', fontFamily: 'IBM Plex Mono' }}>
                      ✦ Workshop selected (₹300): Technical &amp; Non-Technical events are disabled.
                    </small>
                  )}
                </div>

                {/* Technical Event Dropdown */}
                <div className="reg-field">
                  <label className="reg-field-label">Technical Event</label>
                  <select
                    className="reg-input"
                    value={workshopSelected ? '' : technicalEventId}
                    disabled={workshopSelected}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTechnicalEventId(val);
                      if (val) setWorkshopEventId('');
                      if (val === 'ctf' || val === 'cyber-heist-ctf') setNonTechnicalEventId('');
                      if (val !== 'ignite') setIgniteAbstract('');
                      setError('');
                    }}
                  >
                    <option value="">Nil</option>
                    {technicalEvents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {workshopSelected && <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Disabled: Workshop chosen.</small>}
                </div>

                {/* Non-Technical Event Dropdown */}
                <div className="reg-field">
                  <label className="reg-field-label">Non-Technical Event</label>
                  <select
                    className="reg-input"
                    value={workshopSelected || ctfSelected ? '' : nonTechnicalEventId}
                    disabled={workshopSelected || ctfSelected}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNonTechnicalEventId(val);
                      if (val) setWorkshopEventId('');
                      setError('');
                    }}
                  >
                    <option value="">Nil</option>
                    {nonTechnicalEvents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {workshopSelected ? (
                    <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Disabled: Workshop chosen.</small>
                  ) : ctfSelected ? (
                    <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Disabled: CTF chosen.</small>
                  ) : null}
                </div>

                {/* IGNITE 200 character abstract box - shown only when IGNITE is selected */}
                {!workshopSelected && technicalEventId === 'ignite' && (
                  <div className="reg-field reg-field--full">
                    <div className="reg-field-header">
                      <label className="reg-field-label" htmlFor="ignite-abstract">
                        IGNITE Project Idea / Abstract <span className="reg-required-star">*</span>
                      </label>
                      <span className={`reg-char-count ${igniteAbstract.length >= 200 ? 'reg-char-count--limit' : ''}`}>
                        {igniteAbstract.length}/200 chars
                      </span>
                    </div>
                    <textarea
                      id="ignite-abstract"
                      className="reg-input reg-textarea"
                      rows={3}
                      maxLength={200}
                      placeholder="Briefly state your project idea, problem statement, or PPT concept (max 200 characters)..."
                      value={igniteAbstract}
                      onChange={(e) => {
                        setError('');
                        setIgniteAbstract(e.target.value.slice(0, 200));
                      }}
                    />
                    <span className="reg-field-hint">
                      Maximum 200 characters limit. Pitch will be reviewed by the event coordinators.
                    </span>
                  </div>
                )}
              </div>

              {error && <p className="reg-error" role="alert">{error}</p>}

              <div className="reg-actions reg-actions--split">
                <NotchedButton variant="ghost" onClick={() => setStep(1)}>
                  &lt; BACK
                </NotchedButton>
                <NotchedButton variant="primary" onClick={continueToReview}>
                  VERIFY DETAILS &gt;
                </NotchedButton>
              </div>
            </div>
          )}

          {/* Step 3: Verify Details */}
          {registrationOpen && !receipt && step === 3 && (
            <div className="reg-body">
              <div className="reg-review-event-card">
                <div>
                  <span className="reg-kicker">CONFIRMED SELECTIONS</span>
                  <h3 className="reg-review-event-title">{selectedEventNames || 'No events selected'}</h3>
                </div>
                <strong className="reg-review-amount">₹{amount}</strong>
              </div>

              <div className="reg-review-grid">
                <div className="reg-review-item">
                  <span className="reg-review-label">FULL NAME</span>
                  <strong className="reg-review-val">{form.name || '—'}</strong>
                </div>
                <div className="reg-review-item">
                  <span className="reg-review-label">COLLEGE / INSTITUTION</span>
                  <strong className="reg-review-val">{form.college || '—'}</strong>
                </div>
                <div className="reg-review-item">
                  <span className="reg-review-label">PHONE NUMBER</span>
                  <strong className="reg-review-val">{form.phone || '—'}</strong>
                </div>
                <div className="reg-review-item">
                  <span className="reg-review-label">EMAIL ADDRESS</span>
                  <strong className="reg-review-val">{form.email || '—'}</strong>
                </div>
                <div className="reg-review-item">
                  <span className="reg-review-label">FOOD PREFERENCE</span>
                  <strong className="reg-review-val">
                    {form.foodPreference === 'veg' ? 'VEGETARIAN' : form.foodPreference === 'non-veg' ? 'NON-VEGETARIAN' : '—'}
                  </strong>
                </div>
                <div className="reg-review-item">
                  <span className="reg-review-label">SELECTED TECHNICAL</span>
                  <strong className="reg-review-val">{selectedTechnicalEvent?.name || 'Nil'}</strong>
                </div>
                <div className="reg-review-item">
                  <span className="reg-review-label">SELECTED NON-TECHNICAL</span>
                  <strong className="reg-review-val">
                    {ctfSelected ? 'Nil (CTF selected)' : selectedNonTechnicalEvent?.name || 'Nil'}
                  </strong>
                </div>
                {technicalEventId === 'ignite' && igniteAbstract.trim() && (
                  <div className="reg-review-item reg-review-item--full">
                    <span className="reg-review-label">IGNITE PROJECT IDEA / ABSTRACT</span>
                    <strong className="reg-review-val reg-review-val--abstract">
                      {igniteAbstract.trim()}
                    </strong>
                  </div>
                )}
              </div>

              {error && <p className="reg-error" role="alert">{error}</p>}

              <div className="reg-actions reg-actions--split">
                <NotchedButton variant="ghost" onClick={() => setStep(2)}>
                  EDIT EVENTS
                </NotchedButton>
                <NotchedButton variant="primary" onClick={continueToPayment}>
                  CONTINUE TO PAYMENT &gt;
                </NotchedButton>
              </div>
            </div>
          )}

          {/* Step 4: Complete Payment */}
          {registrationOpen && !receipt && step === 4 && (
            <form className="reg-body" onSubmit={submitRegistration}>
              <div className="reg-review-event-card">
                <div>
                  <span className="reg-kicker">BILLING SUMMARY</span>
                  <h3 className="reg-review-event-title">{selectedEventNames}</h3>
                </div>
                <strong className="reg-review-amount">₹{amount}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: '2rem', border: '1px solid var(--line)', padding: '1.5rem', background: 'rgba(0, 0, 0, 0.2)' }}>
                {!isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', background: '#fff', padding: '1rem', boxSizing: 'border-box' }}>
                    {qrDataUrl ? (
                      <img src={qrDataUrl} width="220" height="220" alt="UPI Pay QR" />
                    ) : (
                      <div style={{ color: 'var(--bg)', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem', height: '220px', display: 'flex', alignItems: 'center' }}>Generating QR…</div>
                    )}
                    <span style={{ color: 'var(--bg)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', fontWeight: 600 }}>SCAN WITH UPI APP</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <a className="button button-primary pay-upi-btn" href={upiLink} onClick={handleUpiClick} style={{ textAlign: 'center', display: 'block', padding: '1rem' }}>
                      OPEN IN PAYMENTS APP
                    </a>
                    {showUpiFallback && (
                      <div style={{ border: '1px dashed var(--line)', padding: '1rem' }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono' }}>UPI Address:</span>
                        <button type="button" onClick={copyUpiId} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', width: '100%', padding: '0.5rem', cursor: 'pointer', marginTop: '0.5rem', fontFamily: 'IBM Plex Mono' }}>
                          <code>{upiId}</code> — {copiedUpi ? 'COPIED' : 'TAP TO COPY'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <span className="reg-kicker">UPI CREDENTIALS</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>UPI ID:</span><span style={{ color: 'var(--cyan)' }}>{upiId}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PAYEE:</span><span>{payee}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>REFERENCE:</span><span>{paymentReference}</span></div>
                </div>
              </div>

              <div className="reg-field">
                <label className="reg-field-label">12-Digit Transaction UTR</label>
                <input
                  className="reg-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                  minLength="12"
                  maxLength="12"
                  autoComplete="off"
                  placeholder="Enter UTR reference after paying"
                  value={utr}
                  aria-invalid={utrStatus.state === 'duplicate'}
                  onChange={(e) => {
                    setError('');
                    setUtr(e.target.value.replace(/\D/g, '').slice(0, 12));
                  }}
                />
                <small style={{ color: utrStatus.state === 'duplicate' ? 'var(--error)' : 'var(--muted)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  {utrStatus.message}
                </small>
              </div>

              <label className="reg-food-label" style={{ alignItems: 'flex-start', gap: '0.8rem', marginTop: '1rem' }}>
                <input className="reg-food-input" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: '0.2rem' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                  I declare that I have made the payment of ₹{amount} and all details are correct.
                </span>
              </label>

              {error && <p className="reg-error" role="alert">{error}</p>}

              <div className="reg-actions reg-actions--split">
                <NotchedButton variant="ghost" onClick={() => setStep(3)}>
                  &lt; BACK
                </NotchedButton>
                <NotchedButton
                  variant="primary"
                  type="submit"
                  disabled={submitting || !consent || utr.length !== 12 || utrStatus.state === 'checking' || utrStatus.state === 'duplicate'}
                >
                  {submitting ? 'PROCESSING...' : 'CONFIRM ENTRY'}
                </NotchedButton>
              </div>
            </form>
          )}

          {/* Success Step */}
          {registrationOpen && receipt && (
            <div className="reg-body reg-success-box">
              <div style={{ color: 'var(--cyan)', border: '1px solid var(--line)', padding: '1rem 2rem', background: 'rgba(0, 200, 224, 0.1)', fontFamily: 'Aldrich', letterSpacing: '0.1em' }}>
                REGISTRATION RECEIVED
              </div>

              <p style={{ color: 'var(--muted)', fontFamily: 'IBM Plex Mono', fontSize: '0.9rem', maxWidth: '420px', lineHeight: '1.6' }}>
                Your request has been filed. Coordinators will review your UTR transaction code to finalize verification.
              </p>

              <div className="reg-receipt-card">
                {receiptQrDataUrl && <img className="reg-receipt-qr" src={receiptQrDataUrl} width="180" height="180" alt="Ticket Check-in QR" />}
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.8rem', color: 'var(--muted)' }}>TICKET IDENTIFICATION</span>
                <strong className="reg-receipt-id">{receipt.registrationId}</strong>
                <small style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>
                  Present this QR check-in voucher at the help desk.
                </small>
              </div>

              <NotchedButton variant="primary" onClick={onClose}>
                CLOSE CONSOLE
              </NotchedButton>
            </div>
          )}

        </section>
      </HudCorners>
    </div>
  );
}
