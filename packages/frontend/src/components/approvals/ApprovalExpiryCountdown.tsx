import { useEffect, useState } from 'react';
import { formatExpiryCountdown } from '../../utils/approvalValidation';

interface ApprovalExpiryCountdownProps {
  expiresAt: string;
}

export function ApprovalExpiryCountdown({ expiresAt }: ApprovalExpiryCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const label = formatExpiryCountdown(expiresAt, nowMs);
  const isExpired = label === 'Expired';

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [expiresAt]);

  return (
    <section
      className={`approval-expiry profile-card ${isExpired ? 'approval-expiry-expired' : ''}`}
      aria-labelledby="approval-expiry-heading"
    >
      <h2 id="approval-expiry-heading">Expiration</h2>
      <p role="status" aria-live="polite" className="approval-expiry-countdown">
        {isExpired
          ? 'This approval request has expired. Re-initiate approval to continue.'
          : `Countdown toward 72-hour expiry: ${label}`}
      </p>
      <p className="field-hint">
        Expires at {new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
    </section>
  );
}
