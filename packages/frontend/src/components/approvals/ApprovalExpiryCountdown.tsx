import { useEffect, useState } from 'react';
import { useLocaleStore } from '../../store/localeStore';
import { formatExpiryCountdown } from '../../utils/approvalValidation';
import { formatDate } from '../../utils/localeFormat';

interface ApprovalExpiryCountdownProps {
  expiresAt: string;
}

export function ApprovalExpiryCountdown({ expiresAt }: ApprovalExpiryCountdownProps) {
  const locale = useLocaleStore((state) => state.locale);
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
        Expires at {formatDate(expiresAt, locale)}
      </p>
    </section>
  );
}
