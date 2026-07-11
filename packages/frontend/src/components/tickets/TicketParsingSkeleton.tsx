interface TicketParsingSkeletonProps {
  ticketKey: string;
  progressMessage: string | null;
}

export function TicketParsingSkeleton({ ticketKey, progressMessage }: TicketParsingSkeletonProps) {
  return (
    <section className="ticket-parsing-skeleton" aria-busy="true" aria-live="polite">
      <h2>Parsing {ticketKey}</h2>
      <div className="skeleton-lines">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
        <div className="skeleton-line medium" />
      </div>
      <p className="field-hint">{progressMessage ?? 'Processing ticket…'}</p>
      <div className="progress-indicator" role="progressbar" aria-label="Ticket parsing in progress" />
    </section>
  );
}
