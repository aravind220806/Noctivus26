import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Icon from './Icon';
import type { SiteEvent } from '../data/site';

export interface RegistrationModalProps {
  events: SiteEvent[];
  registrationOpen: boolean;
  initialEventId: string | null;
  onClose: () => void;
}

export interface RegistrationFormData {
  name: string;
  college: string;
  phone: string;
  email: string;
  foodPreference: string;
}

export interface UtrStatus {
  state: 'idle' | 'checking' | 'available' | 'duplicate' | 'error';
  message: string;
}

export interface RegistrationReceipt {
  registrationId: string;
  [key: string]: unknown;
}

const emptyForm: RegistrationFormData = {
  name: '',
  college: '',
  phone: '',
  email: '',
  foodPreference: '',
};

const createPaymentReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NOC26-${timestamp}-${random}`.slice(0, 35);
};

export default function RegistrationModal({
  events,
  registrationOpen,
  initialEventId,
  onClose,
}: RegistrationModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [step, setStep] = useState<number>(1);
  const [form, setForm] = useState<RegistrationFormData>(emptyForm);
  const [eventId, setEventId] = useState<string>(initialEventId || '');
  const [paymentReference] = useState<string>(createPaymentReference);
  const [paymentStarted, setPaymentStarted] = useState<boolean>(false);
  const [utr, setUtr] = useState<string>('');
  const [utrStatus, setUtrStatus] = useState<UtrStatus>({
    state: 'idle',
    message: 'Enter all 12 digits to check this UTR.',
  });
  const [consent, setConsent] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId),
    [eventId, events]
  );
  const amount = Number(selectedEvent?.fee || 0);
  const upiId = import.meta.env.VITE_UPI_ID || '8825979172@axl';
  const payee = import.meta.env.VITE_UPI_PAYEE || 'Noctivus 26';
  const upiLink = useMemo(() => {
    if (!selectedEvent || !amount) return '';
    const parameters = new URLSearchParams({
      pa: upiId,
      pn: payee,
      am: amount.toFixed(2),
      tr: paymentReference,
      tn: `Noctivus 26 - ${selectedEvent.name}`,
      cu: 'INR',
    });
    return `upi://pay?${parameters.toString()}`;
  }, [amount, payee, paymentReference, selectedEvent, upiId]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (step !== 3 || !paymentStarted || !upiLink) return undefined;
    let active = true;
    setQrDataUrl('');
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(upiLink, {
          width: 260,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0a1224', light: '#ffffff' },
        })
      )
      .then((url) => active && setQrDataUrl(url))
      .catch(() =>
        active &&
        setError(
          'The payment QR could not be generated. Use the UPI app button instead.'
        )
      );
    return () => {
      active = false;
    };
  }, [paymentStarted, step, upiLink]);

  useEffect(() => {
    if (utr.length !== 12) {
      setUtrStatus({ state: 'idle', message: `${utr.length}/12 digits entered.` });
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUtrStatus({ state: 'checking', message: 'Checking for a duplicate UTR…' });
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiBase}/api/utr/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ utrNumber: utr }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Unable to check this UTR.');
        setUtrStatus(
          data.available
            ? { state: 'available', message: 'UTR is available and ready to submit.' }
            : { state: 'duplicate', message: data.message || 'This UTR has already been submitted.' }
        );
      } catch (checkError: any) {
        if (checkError.name !== 'AbortError') {
          setUtrStatus({
            state: 'error',
            message: checkError.message || 'Unable to check this UTR right now.',
          });
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [utr]);

  const update = (key: keyof RegistrationFormData, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const continueToReview = () => {
    if (!selectedEvent) return setError('Select an event to continue.');
    if (form.name.trim().length < 2) return setError('Enter your full name.');
    if (form.college.trim().length < 2) return setError('Enter your college name.');
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, '')))
      return setError('Enter a valid 10-digit mobile number.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.');
    if (!['veg', 'non-veg'].includes(form.foodPreference))
      return setError('Choose a food preference.');
    setError('');
    setStep(2);
  };

  const continueToPayment = () => {
    setError('');
    setStep(3);
  };

  const submitRegistration = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{12}$/.test(utr))
      return setError('Enter the 12-digit UTR/reference number shown in your payment app.');
    if (utrStatus.state === 'duplicate')
      return setError('This UTR has already been submitted. Enter the UTR from your own payment.');
    if (utrStatus.state === 'checking')
      return setError('Wait a moment while we check this UTR.');
    if (!consent) return setError('Confirm the payment and privacy declaration to continue.');

    setSubmitting(true);
    setError('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant: { ...form, phone: form.phone.replace(/\D/g, '') },
          events: [{ eventId: selectedEvent?.id, teamSize: 1, teamMembers: [] }],
          paymentReference,
          utrNumber: utr,
          claimedAmount: amount,
          consent: { privacyAccepted: true, rulesAccepted: true },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || 'Registration could not be submitted.');
      setReceipt(data);
    } catch (submissionError: any) {
      setError(submissionError.message || 'Unable to reach the registration server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-shell"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="registration-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-title"
      >
        <header className="registration-modal__header">
          <div>
            <span className="kicker">EVENT REGISTRATION</span>
            <h2 id="registration-title">
              {receipt
                ? 'Registration received.'
                : step === 1
                ? 'Your details.'
                : step === 2
                ? 'Verify everything.'
                : 'Complete payment.'}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            onClick={onClose}
            aria-label="Close registration"
          >
            <Icon name="close" />
          </button>
        </header>

        {!receipt && (
          <div className="registration-progress" aria-label={`Registration step ${step} of 3`}>
            <span className={step >= 1 ? 'active' : ''}>Details</span>
            <span className={step >= 2 ? 'active' : ''}>Review</span>
            <span className={step >= 3 ? 'active' : ''}>Payment</span>
          </div>
        )}

        {!registrationOpen && (
          <div className="registration-body registration-closed">
            <span className="kicker">Registration status</span>
            <h3>Entries open soon.</h3>
            <p>The form is ready, but organizers have not enabled live submissions yet.</p>
            <button className="button button-primary" type="button" onClick={onClose}>
              Return to events <Icon name="arrow" />
            </button>
          </div>
        )}

        {registrationOpen && !receipt && step === 1 && (
          <div className="registration-body registration-details">
            <div className="selected-registration-event">
              <label className="field">
                <span>Event</span>
                <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                  <option value="">Select an event</option>
                  {events.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · ₹{item.fee}
                    </option>
                  ))}
                </select>
              </label>
              {selectedEvent && (
                <div>
                  <span>{selectedEvent.category}</span>
                  <strong>₹{amount}</strong>
                </div>
              )}
            </div>
            <div className="field-grid registration-field-grid">
              <Field
                label="Full name"
                value={form.name}
                onChange={(value) => update('name', value)}
                autoComplete="name"
              />
              <Field
                label="College name"
                value={form.college}
                onChange={(value) => update('college', value)}
                autoComplete="organization"
              />
              <Field
                label="Phone number"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(value) => update('phone', value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="tel"
              />
              <Field
                label="Email ID"
                type="email"
                value={form.email}
                onChange={(value) => update('email', value)}
                autoComplete="email"
              />
            </div>
            <fieldset className="food-preference">
              <legend>Food preference</legend>
              <div>
                <FoodOption
                  label="Vegetarian"
                  value="veg"
                  selected={form.foodPreference}
                  onSelect={(value) => update('foodPreference', value)}
                />
                <FoodOption
                  label="Non-vegetarian"
                  value="non-veg"
                  selected={form.foodPreference}
                  onSelect={(value) => update('foodPreference', value)}
                />
              </div>
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="registration-actions">
              <button className="button button-primary" type="button" onClick={continueToReview}>
                Verify details <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}

        {registrationOpen && !receipt && step === 2 && (
          <div className="registration-body registration-review">
            <div className="review-event">
              <div>
                <span className="kicker">SELECTED EVENT</span>
                <h3>{selectedEvent?.name}</h3>
                <small>{selectedEvent?.category}</small>
              </div>
              <strong>₹{amount}</strong>
            </div>
            <dl className="review-grid">
              <ReviewItem label="Full name" value={form.name} />
              <ReviewItem label="College" value={form.college} />
              <ReviewItem label="Phone" value={form.phone} />
              <ReviewItem label="Email" value={form.email} />
              <ReviewItem
                label="Food"
                value={form.foodPreference === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
              />
            </dl>
            <p className="review-note">
              <Icon name="check" size={17} /> Check every detail carefully. Your confirmation will be
              sent to this email address.
            </p>
            <div className="registration-actions registration-actions--split">
              <button className="button button-secondary" type="button" onClick={() => setStep(1)}>
                Edit details
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={continueToPayment}
              >
                Continue to payment <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}

        {registrationOpen && !receipt && step === 3 && (
          <form className="registration-body payment-step" onSubmit={submitRegistration}>
            <div className="payment-summary">
              <div>
                <span>Amount to pay</span>
                <strong>₹{amount}</strong>
                <small>{selectedEvent?.name}</small>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPaymentStarted(false);
                  setStep(2);
                }}
              >
                Edit details
              </button>
            </div>
            {!paymentStarted ? (
              <div className="payment-gate">
                <span className="kicker">SECURE UPI PAYMENT</span>
                <h3>Ready to pay ₹{amount}?</h3>
                <p>
                  A unique payment QR will be generated for <strong>{selectedEvent?.name}</strong>.
                  Verify the payee and amount in your UPI app before authorizing.
                </p>
                <div>
                  <small>PAYEE</small>
                  <strong>{payee}</strong>
                  <span>{upiId}</span>
                </div>
                <button
                  className="button button-primary button-large"
                  type="button"
                  onClick={() => setPaymentStarted(true)}
                >
                  Pay now <Icon name="arrow" />
                </button>
              </div>
            ) : (
              <>
                <div className="payment-layout">
                  <div className="qr-panel">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        width="260"
                        height="260"
                        alt={`Dynamic UPI QR code to pay ₹${amount} for ${selectedEvent?.name}`}
                      />
                    ) : (
                      <div className="qr-loading">Generating payment QR…</div>
                    )}
                    <span>Scan & pay with any UPI app</span>
                  </div>
                  <div className="payment-instructions">
                    <span className="kicker">PAYMENT DETAILS</span>
                    <h3>Pay ₹{amount}</h3>
                    <dl>
                      <div>
                        <dt>UPI ID</dt>
                        <dd>{upiId}</dd>
                      </div>
                      <div>
                        <dt>Reference</dt>
                        <dd>{paymentReference}</dd>
                      </div>
                      <div>
                        <dt>Event</dt>
                        <dd>{selectedEvent?.name}</dd>
                      </div>
                    </dl>
                    <a className="button button-primary" href={upiLink}>
                      <Icon name="external" /> Open in UPI app
                    </a>
                    <p className="payment-safety">
                      Never share your UPI PIN. Complete authorization only inside your trusted UPI app.
                    </p>
                  </div>
                </div>
                <label className={`field utr-field utr-field--${utrStatus.state}`}>
                  <span>12-digit UTR / payment reference</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    minLength={12}
                    maxLength={12}
                    autoComplete="off"
                    placeholder="Enter 12 digits after payment"
                    value={utr}
                    aria-invalid={utrStatus.state === 'duplicate'}
                    aria-describedby="utr-status"
                    onChange={(event) => {
                      setError('');
                      setUtr(event.target.value.replace(/\D/g, '').slice(0, 12));
                    }}
                  />
                  <small id="utr-status" className="utr-status" aria-live="polite">
                    {utrStatus.message}
                  </small>
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <span>
                    I confirm that I paid the exact amount and consent to these details being stored
                    for event registration and payment verification.
                  </span>
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="registration-actions registration-actions--split">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    className="button button-primary"
                    disabled={
                      submitting ||
                      utr.length !== 12 ||
                      utrStatus.state === 'checking' ||
                      utrStatus.state === 'duplicate'
                    }
                    type="submit"
                  >
                    {submitting
                      ? 'Submitting…'
                      : utrStatus.state === 'checking'
                      ? 'Checking UTR…'
                      : 'Submit registration'}{' '}
                    <Icon name="arrow" />
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {registrationOpen && receipt && (
          <div className="registration-body receipt-step">
            <div className="success-mark">
              <Icon name="check" size={34} />
            </div>
            <span className="kicker">PAYMENT VERIFICATION PENDING</span>
            <h3>You're registered.</h3>
            <p>
              Your entry has been received. Organizers will verify the UTR before confirming the
              registration.
            </p>
            <div className="receipt-card">
              <span>Registration ID</span>
              <strong>{receipt.registrationId}</strong>
              <small>Save this number for future communication.</small>
            </div>
            <button className="button button-primary" type="button" onClick={onClose}>
              Return to Noctivus <Icon name="arrow" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text' | 'tel' | 'email';
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function FoodOption({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: string;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <label className={selected === value ? 'selected' : ''}>
      <input
        type="radio"
        name="food-preference"
        value={value}
        checked={selected === value}
        onChange={() => onSelect(value)}
      />
      <span>
        <i />
        <strong>{label}</strong>
      </span>
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
