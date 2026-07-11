export function TicketEmptyState() {
  return (
    <section className="ticket-empty-state" aria-labelledby="empty-heading">
      <h2 id="empty-heading">No ticket selected</h2>
      <p>Search for a ticket by key to begin ingestion, or enter a key manually if Forge is unavailable.</p>
      <p className="field-hint">
        Assigned ticket browsing requires Jira connection. Use ticket key search below.
      </p>
    </section>
  );
}
