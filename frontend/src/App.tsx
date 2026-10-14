import { useCallback, useEffect, useState, type FormEvent } from 'react';

type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  capacity: number;
  description: string | null;
};

type ApiError = {
  error?: string;
  details?: Record<string, string[] | undefined>;
};

async function getErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await response.json() as ApiError;
    const fieldErrors = Object.values(body.details || {}).flat().filter(Boolean);
    return fieldErrors.length
      ? fieldErrors.join(' ')
      : body.error || `Request failed (${response.status})`;
  }

  return `Request failed (${response.status}). Check that the API gateway and event service are running.`;
}

function formatEventDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function App() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/events');
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setEvents(await response.json() as EventItem[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError('');
    setNotice('');

    const form = new FormData(formElement);
    const payload = {
      title: String(form.get('title') || '').trim(),
      date: String(form.get('date') || ''),
      location: String(form.get('location') || '').trim(),
      capacity: Number(form.get('capacity')),
      description: String(form.get('description') || '').trim() || undefined
    };

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const createdEvent = await response.json() as EventItem;
      setEvents((currentEvents) => [...currentEvents, createdEvent]
        .sort((a, b) => a.date.localeCompare(b.date)));
      formElement.reset();
      setNotice('Event created and saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the event.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Gather home">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span>gather<span className="brand-period">.</span></span>
        </a>
        <span className="header-label">EVENT MANAGER</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MAKE IT HAPPEN</p>
          <h1>Bring people<br />together.</h1>
          <p className="hero-description">Create an event, find your people, and make a day worth remembering.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-sun" />
          <span className="art-orbit art-orbit-one" />
          <span className="art-orbit art-orbit-two" />
          <span className="art-caption">GOOD THINGS<br />HAPPEN TOGETHER</span>
        </div>
      </section>

      <section className="content-grid" aria-label="Event management">
        <div className="event-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR COMMUNITY</p>
              <h2>Events you’ve made</h2>
            </div>
            <span className="event-count">{events.length} {events.length === 1 ? 'EVENT' : 'EVENTS'}</span>
          </div>

          {error && (
            <div className="message message-error" role="alert">
              <span>{error}</span>
              <button className="text-button" type="button" onClick={() => void loadEvents()}>
                Try again
              </button>
            </div>
          )}
          {notice && <p className="message message-success" role="status">{notice}</p>}

          {loading ? (
            <div className="empty-state" role="status">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">✳</span>
              <h3>Your next great event starts here.</h3>
              <p>Use the form to create the first event for your community.</p>
            </div>
          ) : (
            <div className="event-list">
              {events.map((item) => (
                <article className="event-card" key={item.id}>
                  <div className="event-date" aria-label={formatEventDate(item.date)}>
                    <span>{new Date(`${item.date}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>
                    <strong>{item.date.slice(-2)}</strong>
                  </div>
                  <div className="event-details">
                    <p className="event-full-date">{formatEventDate(item.date)}</p>
                    <h3>{item.title}</h3>
                    <p className="event-location">
                      <span aria-hidden="true">↗</span> {item.location}
                    </p>
                    {item.description && <p className="event-description">{item.description}</p>}
                  </div>
                  <div className="event-capacity">
                    <strong>{item.capacity}</strong>
                    <span>SPOTS</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="form-panel">
          <div className="form-heading">
            <span className="form-icon" aria-hidden="true">＋</span>
            <div>
              <p className="eyebrow">START SOMETHING</p>
              <h2>Create an event</h2>
            </div>
          </div>
          <p className="form-intro">The best memories begin with an invitation.</p>

          <form className="event-form" onSubmit={handleSubmit}>
            <label>
              Event name
              <input name="title" type="text" placeholder="e.g. Sunday supper club" maxLength={120} required />
            </label>
            <div className="form-row">
              <label>
                Date
                <input name="date" type="date" required />
              </label>
              <label>
                Capacity
                <input name="capacity" type="number" min={1} step={1} placeholder="30" required />
              </label>
            </div>
            <label>
              Location
              <input name="location" type="text" placeholder="Where are we meeting?" maxLength={200} required />
            </label>
            <label>
              A little about it <span className="optional-label">OPTIONAL</span>
              <textarea name="description" rows={3} placeholder="What should guests know?" maxLength={1000} />
            </label>
            <button className="submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Creating event…' : 'Create event'} <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="form-footnote">Your event will appear in the list as soon as it’s saved.</p>
        </aside>
      </section>

      <footer className="site-footer">
        <span>gather<span className="brand-period">.</span></span>
        <span>Make room for good things.</span>
      </footer>
    </main>
  );
}
