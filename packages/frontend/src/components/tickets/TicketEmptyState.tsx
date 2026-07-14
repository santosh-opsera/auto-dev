export function TicketEmptyState() {
  return (
    <section className="ticket-empty-state" aria-live="polite">
      <h2>Load a Jira ticket</h2>
      <p>Search for a ticket by key to begin ingestion via the Jira REST API.</p>
    </section>
  );
}
