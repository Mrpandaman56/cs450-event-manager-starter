import { useCallback, useEffect, useState, type FormEvent } from 'react';

type User = { id: string; name: string; email: string };
type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  guidanceUrl: string | null;
  capacity: number;
  remainingSpots: number;
  registeredCount: number;
  priceCents: number;
  description: string | null;
  inviteOnly: boolean;
  viewerRsvpStatus: 'attending' | 'not_attending' | null;
  creator: { id: string; name: string };
};
type EventGuest = {
  id: string;
  name: string;
  email: string;
  status: 'invited' | 'attending' | 'declined';
};
type Attendance = {
  capacity: number;
  remainingSpots: number;
  attendingCount: number;
  guests: EventGuest[];
};
type Invitation = {
  id: string;
  createdAt: string;
  sender: { name: string };
  event: EventItem;
};
type Page = 'discover' | 'my-events' | 'invitations' | 'create';
type ApiError = { error?: string; details?: Record<string, string[] | undefined> };
let accessToken: string | null = null;

function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem('accessToken', token);
  else sessionStorage.removeItem('accessToken');
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json() as ApiError;
      const details = Object.values(body.details || {}).flat().filter(Boolean);
      throw new Error(details.length ? details.join(' ') : body.error || `Request failed (${response.status})`);
    }
    throw new Error(`Request failed (${response.status}). Check that the app services are running.`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function api<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  return readResponse<T>(await fetch(path, {
    ...init,
    credentials: 'omit',
    headers
  }));
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function formatPrice(cents: number) {
  return cents === 0 ? 'Free' : new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

function eventPayload(form: HTMLFormElement) {
  const values = new FormData(form);
  return {
    title: String(values.get('title') || '').trim(),
    date: String(values.get('date') || ''),
    location: String(values.get('location') || '').trim(),
    guidanceUrl: String(values.get('guidanceUrl') || '').trim(),
    capacity: Number(values.get('capacity')),
    price: Number(values.get('price') || 0),
    description: String(values.get('description') || '').trim(),
    inviteOnly: values.get('inviteOnly') === 'on',
    inviteEmails: String(values.get('inviteEmails') || '')
      .split(/[\n,;]/)
      .map((email) => email.trim())
      .filter(Boolean)
  };
}

function EventCard({
  event,
  currentUser,
  page,
  onRsvp,
  onEdit,
  onInvite,
  busy,
  attendance,
  attendanceLoading,
  attendanceExpanded,
  onToggleAttendance
}: {
  event: EventItem;
  currentUser: User;
  page: Page;
  onRsvp: (event: EventItem, status: 'attending' | 'not_attending') => void;
  onEdit: (event: EventItem) => void;
  onInvite: (event: EventItem) => void;
  busy: boolean;
  attendance?: Attendance;
  attendanceLoading: boolean;
  attendanceExpanded: boolean;
  onToggleAttendance: (event: EventItem) => void;
}) {
  const isOwner = event.creator.id === currentUser.id;
  const full = event.remainingSpots === 0 || event.capacity === 0;
  const fillPercentage = event.capacity > 0 ? (event.registeredCount / event.capacity) * 100 : 100;
  const isAlmostFull = !full && event.capacity > 0 && fillPercentage >= 90;

  return (
    <article className="event-card">
      <div className="event-date">
        <span>{formatDate(event.date, { month: 'short' }).toUpperCase()}</span>
        <strong>{event.date.slice(-2)}</strong>
        <small>{event.date.slice(0, 4)}</small>
      </div>
      <div className="event-main">
        <div className="event-kicker">
          <span>{formatDate(event.date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          {event.inviteOnly && <span className="availability">INVITE ONLY</span>}
          {isAlmostFull && <span className="availability availability-warning">≥ 90% CAPACITY (ALMOST FULL)</span>}
          <span className={`availability ${full ? 'availability-full' : ''}`}>
            {full ? 'SOLD OUT' : `${event.remainingSpots} SPOTS LEFT`}
          </span>
        </div>
        <h3>{event.title}</h3>
        <p className="event-place">{event.location} <span>·</span> hosted by {event.creator.name}</p>
        {event.description && <p className="event-description">{event.description}</p>}
        {event.guidanceUrl && (
          <a className="map-link" href={event.guidanceUrl} target="_blank" rel="noreferrer">
            OPEN DIRECTIONS <span aria-hidden="true">↗</span>
          </a>
        )}
        <div className="event-meta">
          <span>{event.registeredCount} / {event.capacity} REGISTERED</span>
          <span>{formatPrice(event.priceCents)}</span>
        </div>
      </div>
      <div className="event-actions">
        {page === 'discover' && (
          <>
            <button
              className={event.viewerRsvpStatus === 'attending' ? 'button button-quiet' : 'button button-light'}
              type="button"
              aria-pressed={event.viewerRsvpStatus === 'attending'}
              disabled={busy || event.viewerRsvpStatus === 'attending'}
              onClick={() => onRsvp(event, 'attending')}
            >
              {busy ? 'PLEASE WAIT' : event.viewerRsvpStatus === 'attending' ? 'ATTENDING' : full ? 'ATTEND · FULL' : 'ATTEND'}
            </button>
            <button
              className={event.viewerRsvpStatus === 'not_attending' ? 'button button-quiet' : 'button button-light'}
              type="button"
              aria-pressed={event.viewerRsvpStatus === 'not_attending'}
              disabled={busy || event.viewerRsvpStatus === 'not_attending'}
              onClick={() => onRsvp(event, 'not_attending')}
            >
              {busy ? 'PLEASE WAIT' : 'NOT ATTENDING'}
            </button>
          </>
        )}
        {page === 'my-events' && isOwner && (
          <>
            <button
              className="button button-quiet"
              type="button"
              aria-expanded={attendanceExpanded}
              onClick={() => onToggleAttendance(event)}
            >
              {attendanceLoading ? 'LOADING…' : attendanceExpanded ? 'HIDE GUESTS' : 'GUEST LIST'}
            </button>
            <button className="button button-quiet" type="button" onClick={() => onEdit(event)}>EDIT EVENT</button>
            <button className="button button-light" type="button" onClick={() => onInvite(event)}>INVITE PEOPLE</button>
          </>
        )}
      </div>
      {page === 'my-events' && isOwner && attendanceExpanded && (
        <section className="attendance-panel" aria-label={`${event.title} attendance`}>
          <div className="attendance-summary">
            <span>{attendance?.attendingCount ?? event.registeredCount} ATTENDING</span>
            <span>{attendance?.remainingSpots ?? event.remainingSpots} SPOTS LEFT</span>
          </div>
          {attendanceLoading ? (
            <p className="attendance-empty">Loading guest list…</p>
          ) : attendance?.guests.length ? (
            <ul className="attendance-guests">
              {attendance.guests.map((guest) => (
                <li key={guest.id}>
                  <span><strong>{guest.name}</strong><small>{guest.email}</small></span>
                  <span className={`guest-status guest-status-${guest.status}`}>{guest.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="attendance-empty">No invitations or RSVPs yet.</p>
          )}
        </section>
      )}
    </article>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [page, setPage] = useState<Page>('discover');
  const [eventScope, setEventScope] = useState<'hosted' | 'attending'>('hosted');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendanceByEvent, setAttendanceByEvent] = useState<Record<string, Attendance>>({});
  const [attendanceLoadingEvent, setAttendanceLoadingEvent] = useState('');
  const [expandedAttendanceEvent, setExpandedAttendanceEvent] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyEvent, setBusyEvent] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [inviting, setInviting] = useState<EventItem | null>(null);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const storedToken = sessionStorage.getItem('accessToken');
    accessToken = storedToken;
    if (!storedToken) {
      setAuthChecked(true);
      return;
    }

    void api<{ user: User }>('/api/auth/me')
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const scope = page === 'my-events'
      ? eventScope === 'hosted' ? 'mine' : 'registered'
      : 'active';
    const parameters = new URLSearchParams({ scope });
    if (query && page === 'discover') parameters.set('q', query);
    try {
      setEvents(await api<EventItem[]>(`/api/events?${parameters}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, [eventScope, page, query, user]);

  const loadInvitations = useCallback(async () => {
    if (!user || page !== 'invitations') return;
    setLoading(true);
    setError('');
    try {
      setInvitations(await api<Invitation[]>('/api/invitations'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load invitations.');
    } finally {
      setLoading(false);
    }
  }, [page, user]);

  useEffect(() => {
    if (page === 'invitations') void loadInvitations();
    else if (page !== 'create') void loadEvents();
  }, [page, loadEvents, loadInvitations]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSubmitting(true);
    setError('');
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register'
        ? { name: String(values.get('name') || '').trim(), email: String(values.get('email') || '').trim(), password: String(values.get('password') || '') }
        : { email: String(values.get('email') || '').trim(), password: String(values.get('password') || '') };
      const result = await api<{ user: User; token: string; expiresAt: string }>(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      setAccessToken(result.token);
      setUser(result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not authenticate.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError('');
    setAccessToken(null);
    setUser(null);
    setPage('discover');
    setEvents([]);
    setInvitations([]);
  }

  async function handleEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = eventPayload(form);
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await api<EventItem>(editing ? `/api/events/${editing.id}` : '/api/events', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing
          ? (({ inviteEmails: _inviteEmails, ...updates }) => updates)(payload)
          : payload)
      });
      setNotice(editing ? 'Event details saved.' : 'Event created and published.');
      setEditing(null);
      setPage('my-events');
      setEventScope('hosted');
      if (!editing && payload.inviteEmails.length) {
        setNotice('Event created and invitations sent.');
      }
      setAttendanceByEvent((current) => {
        const updated = { ...current };
        delete updated[result.id];
        return updated;
      });
      setEvents((current) => [result, ...current.filter((item) => item.id !== result.id)]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the event.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRsvp(event: EventItem, status: 'attending' | 'not_attending') {
    setBusyEvent(event.id);
    setError('');
    setNotice('');
    try {
      await api(`/api/events/${event.id}/registrations`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      setNotice(status === 'attending'
        ? `Your spot for ${event.title} is reserved.`
        : `You’re marked as not attending ${event.title}.`);
      setAttendanceByEvent((current) => {
        const updated = { ...current };
        delete updated[event.id];
        return updated;
      });
      await loadEvents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update your registration.');
    } finally {
      setBusyEvent('');
    }
  }

  async function toggleAttendance(event: EventItem) {
    if (expandedAttendanceEvent === event.id) {
      setExpandedAttendanceEvent('');
      return;
    }
    setExpandedAttendanceEvent(event.id);
    setAttendanceLoadingEvent(event.id);
    setError('');
    try {
      const attendance = await api<Attendance>(`/api/events/${event.id}/attendance`);
      setAttendanceByEvent((current) => ({ ...current, [event.id]: attendance }));
    } catch (requestError) {
      setExpandedAttendanceEvent('');
      setError(requestError instanceof Error ? requestError.message : 'Could not load the guest list.');
    } finally {
      setAttendanceLoadingEvent('');
    }
  }

  async function handleSendInvitations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviting) return;
    const form = event.currentTarget;
    const emails = String(new FormData(form).get('emails') || '')
      .split(/[\n,;]/).map((email) => email.trim()).filter(Boolean);
    setSubmitting(true);
    setError('');
    try {
      const result = await api<{ sent: number }>(`/api/events/${inviting.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ emails })
      });
      setAttendanceByEvent((current) => {
        const updated = { ...current };
        delete updated[inviting.id];
        return updated;
      });
      setExpandedAttendanceEvent((current) => current === inviting.id ? '' : current);
      setNotice(`${result.sent} invitation${result.sent === 1 ? '' : 's'} sent.`);
      setInviting(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send invitations.');
    } finally {
      setSubmitting(false);
    }
  }

  async function answerInvitation(invitation: Invitation, answer: 'accept' | 'decline') {
    setBusyEvent(invitation.id);
    setError('');
    try {
      await api<void>(`/api/invitations/${invitation.id}/${answer}`, { method: 'POST', body: '{}' });
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setNotice(answer === 'accept' ? `You’re registered for ${invitation.event.title}.` : 'Invitation declined.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not respond to invitation.');
    } finally {
      setBusyEvent('');
    }
  }

  const pageTitle = page === 'discover'
    ? 'Find your people.'
    : page === 'my-events'
      ? 'Your events.'
      : page === 'invitations'
        ? 'You’re invited.'
        : editing ? 'Make it yours.' : 'Start something.';

  if (!authChecked) {
    return <main className="auth-loading"><span className="loader-mark">●</span><p>LOADING YOUR SPACE</p></main>;
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <div className="auth-brand"><span className="brand-mark">●</span> COMMON / GROUND</div>
        <section className="auth-card">
          <p className="micro-label">A PLACE TO COME TOGETHER</p>
          <h1>{authMode === 'login' ? 'Good to see you.' : 'Come on in.'}</h1>
          <p className="auth-subtitle">{authMode === 'login' ? 'Sign in to find your next thing.' : 'Create an account to host, discover, and join.'}</p>
          {error && <p className="message message-error" role="alert">{error}</p>}
          <form className="stack-form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <label>Your name<input name="name" autoComplete="name" placeholder="How should we call you?" maxLength={80} required /></label>
            )}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label>Password<input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 10 : 1} maxLength={128} placeholder={authMode === 'register' ? 'At least 10 characters' : 'Your password'} required /></label>
            <button className="button button-primary button-wide" disabled={submitting} type="submit">{submitting ? 'ONE MOMENT…' : authMode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'} <span>↗</span></button>
          </form>
          <p className="auth-switch">
            {authMode === 'login' ? 'New around here?' : 'Already have an account?'}
            {' '}<button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}>
              {authMode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <p className="auth-privacy">Your password is securely hashed before it is stored. Your account keeps your events and registrations together.</p>
        </section>
        <span className="auth-orbit orbit-a" /><span className="auth-orbit orbit-b" />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="wordmark" type="button" onClick={() => { setPage('discover'); setNotice(''); }}>
          <span className="brand-mark">●</span><span>COMMON<span className="slash">/</span>GROUND</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {([
            ['discover', 'DISCOVER'],
            ['my-events', 'MY EVENTS'],
            ['invitations', 'INVITATIONS']
          ] as const).map(([destination, label]) => (
            <button
              key={destination}
              className={page === destination ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => { setPage(destination); setEditing(null); setInviting(null); setError(''); setNotice(''); }}
            >
              {label}{destination === 'invitations' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="user-menu">
          <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="user-name">{user.name}</span>
          <button className="signout-button" type="button" onClick={() => void handleSignOut()}>SIGN OUT</button>
        </div>
      </header>

      <section className="page-intro">
        <div>
          <p className="micro-label">IN REAL LIFE, TOGETHER</p>
          <h1>{pageTitle}</h1>
          <p className="intro-subtitle">
            {page === 'discover' && 'Find a room, a reason, a new connection.'}
            {page === 'my-events' && 'The things you bring to life, all in one place.'}
            {page === 'invitations' && 'A little note from someone who thought of you.'}
            {page === 'create' && 'Good things start with a date on the calendar.'}
          </p>
        </div>
        <div className="intro-art" aria-hidden="true"><span /><i /><b>◎</b></div>
        {page !== 'create' && page !== 'invitations' && (
          <button className="button button-primary intro-create" type="button" onClick={() => { setEditing(null); setPage('create'); setError(''); }}>
            <span>＋</span> CREATE EVENT
          </button>
        )}
      </section>

      <div className="page-rule"><span>FIELD NOTES / 01</span><span>LOCAL EVENTS, REAL PEOPLE</span></div>

      <div className="workspace">
        <section className="main-column">
          {page === 'discover' && (
            <div className="list-heading">
              <div><p className="micro-label">OPEN INVITATION</p><h2>On the calendar<span className="red-dot">.</span></h2></div>
              <form className="search-box" onSubmit={(event) => { event.preventDefault(); setQuery(searchInput.trim()); }}>
                <span aria-hidden="true">⌕</span>
                <input aria-label="Search events" placeholder="SEARCH EVENTS" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                {query && <button type="button" aria-label="Clear search" onClick={() => { setSearchInput(''); setQuery(''); }}>×</button>}
              </form>
            </div>
          )}
          {page === 'my-events' && (
            <div className="list-heading">
              <div><p className="micro-label">YOUR FOOTPRINT</p><h2>{eventScope === 'hosted' ? 'Made by you' : 'You’re going'}<span className="red-dot">.</span></h2></div>
              <div className="segmented">
                <button className={eventScope === 'hosted' ? 'selected' : ''} onClick={() => setEventScope('hosted')} type="button">HOSTED</button>
                <button className={eventScope === 'attending' ? 'selected' : ''} onClick={() => setEventScope('attending')} type="button">ATTENDING</button>
              </div>
            </div>
          )}
          {page === 'invitations' && (
            <div className="list-heading">
              <div><p className="micro-label">ON YOUR DOORSTEP</p><h2>Your invitations<span className="red-dot">.</span></h2></div>
            </div>
          )}

          {error && <div className="message message-error" role="alert"><span>{error}</span><button className="text-button" type="button" onClick={() => { setError(''); if (page === 'invitations') void loadInvitations(); else void loadEvents(); }}>RETRY</button></div>}
          {notice && <p className="message message-success" role="status">{notice}</p>}

          {page === 'create' && (
            <section className="editor-card">
              <div className="editor-heading"><p className="micro-label">{editing ? 'EVENT SETTINGS' : 'MAKE THE FIRST MOVE'}</p><h2>{editing ? 'Edit event' : 'Create an event'}</h2><p>Bring the details. We’ll bring the people.</p></div>
              <form className="event-form" onSubmit={handleEventSubmit}>
                <label>EVENT NAME<input name="title" defaultValue={editing?.title || ''} placeholder="A night under the open sky" maxLength={120} required /></label>
                <div className="form-row">
                  <label>DATE<input name="date" type="date" defaultValue={editing?.date || ''} required /></label>
                  <label>CAPACITY<input name="capacity" type="number" min={0} max={100000} step={1} defaultValue={editing !== null ? editing.capacity : ''} required /></label>
                </div>
                <label>LOCATION<input name="location" defaultValue={editing?.location || ''} placeholder="Street, venue, or landmark" maxLength={200} required /></label>
                <label>MAP / DIRECTIONS LINK <span className="field-optional">OPTIONAL</span><input name="guidanceUrl" type="url" defaultValue={editing?.guidanceUrl || ''} placeholder="https://maps.example.com/…" /></label>
                <div className="form-row">
                  <label>PRICE (USD) <span className="field-optional">OPTIONAL · INFO ONLY</span><input name="price" type="number" min="0" max="10000" step="0.01" defaultValue={editing ? (editing.priceCents / 100).toFixed(2) : '0'} /></label>
                  <div className="price-note">NO PAYMENTS COLLECTED<br />PRICE SHOWN TO GUESTS</div>
                </div>
                <label>THE DETAILS <span className="field-optional">OPTIONAL</span><textarea name="description" rows={4} defaultValue={editing?.description || ''} maxLength={1000} placeholder="A few words about what to expect…" /></label>
                {!editing && <label>INVITE USERS BY EMAIL <span className="field-optional">OPTIONAL · EXISTING ACCOUNTS</span><textarea name="inviteEmails" rows={3} placeholder="alex@example.com&#10;sam@example.com" /></label>}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', margin: '0.5rem 0 1rem 0' }}>
                  <input name="inviteOnly" type="checkbox" defaultChecked={editing?.inviteOnly || false} style={{ width: 'auto', margin: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Only by invite</span>
                </label>
                <div className="form-footer">
                  <button className="button button-primary" disabled={submitting} type="submit">{submitting ? 'SAVING…' : editing ? 'SAVE CHANGES' : 'PUBLISH EVENT'} <span>↗</span></button>
                  <button className="button button-quiet" type="button" onClick={() => { setEditing(null); setPage('my-events'); }}>CANCEL</button>
                </div>
              </form>
            </section>
          )}

          {(page === 'discover' || page === 'my-events') && (
            loading ? (
              <div className="loading-row"><span className="loader-mark">●</span> LOADING THE GUEST LIST</div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <span className="empty-symbol">◎</span>
                <h3>{page === 'my-events' ? 'Nothing on your list yet.' : 'A quiet moment.'}</h3>
                <p>{page === 'my-events' ? 'Create an event, or explore what others are hosting.' : 'Try another search, or check back soon for new gatherings.'}</p>
                <button className="button button-light" type="button" onClick={() => setPage(page === 'my-events' ? 'create' : 'discover')}>
                  {page === 'my-events' ? 'CREATE YOUR FIRST EVENT' : 'CLEAR YOUR SEARCH'}
                </button>
              </div>
            ) : (
              <div className="event-list">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    currentUser={user}
                    page={page}
                    onRsvp={(item, status) => void handleRsvp(item, status)}
                    onEdit={(item) => { setEditing(item); setPage('create'); }}
                    onInvite={setInviting}
                    busy={busyEvent === event.id}
                    attendance={attendanceByEvent[event.id]}
                    attendanceLoading={attendanceLoadingEvent === event.id}
                    attendanceExpanded={expandedAttendanceEvent === event.id}
                    onToggleAttendance={(item) => void toggleAttendance(item)}
                  />
                ))}
              </div>
            )
          )}

          {page === 'invitations' && (
            loading ? (
              <div className="loading-row"><span className="loader-mark">●</span> CHECKING THE POST</div>
            ) : invitations.length === 0 ? (
              <div className="empty-state"><span className="empty-symbol">◎</span><h3>No new invitations.</h3><p>When someone saves you a seat, you’ll find it here.</p></div>
            ) : (
              <div className="invitation-list">
                {invitations.map((invitation) => (
                  <article className="invitation-card" key={invitation.id}>
                    <p className="micro-label">A NOTE FROM {invitation.sender.name.toUpperCase()}</p>
                    <h3>{invitation.event.title}</h3>
                    <p>{formatDate(invitation.event.date, { weekday: 'long', month: 'long', day: 'numeric' })} · {invitation.event.location}</p>
                    <p className="invitation-price">{formatPrice(invitation.event.priceCents)} <span>· {invitation.event.remainingSpots} spots left</span></p>
                    <div className="form-footer">
                      <button className="button button-primary" type="button" disabled={busyEvent === invitation.id} onClick={() => void answerInvitation(invitation, 'accept')}>ACCEPT INVITE ↗</button>
                      <button className="button button-quiet" type="button" disabled={busyEvent === invitation.id} onClick={() => void answerInvitation(invitation, 'decline')}>DECLINE</button>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </section>

        <aside className="side-column">
          <div className="side-stamp"><span>●</span><span>NO FEED.<br />NO FOMO.<br />JUST PEOPLE.</span><i>◎</i></div>
          <div className="side-note"><p className="micro-label">THE SMALL PRINT</p><p>Events with a price are listed for planning. Payment isn’t collected through this demo.</p></div>
          <button className="side-create" type="button" onClick={() => { setEditing(null); setPage('create'); }}>HAVE AN IDEA?<br /><strong>PUT IT OUT THERE <span>↗</span></strong></button>
        </aside>
      </div>

      <footer className="site-footer"><span>COMMON/GROUND © 2026</span><span>BUILT FOR GETTING TOGETHER</span><span>GOOD THINGS HAPPEN OFFLINE <i>●</i></span></footer>

      {inviting !== null && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviting(null); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="invite-heading">
            <button className="modal-close" aria-label="Close invitation dialog" type="button" onClick={() => setInviting(null)}>×</button>
            <p className="micro-label">PASS IT ALONG</p><h2 id="invite-heading">Invite someone in.</h2>
            <p>Send {inviting.title} to people with an account. Separate email addresses with commas or new lines.</p>
            <form className="event-form" onSubmit={(event) => void handleSendInvitations(event)}>
              <label>ACCOUNT EMAILS<textarea name="emails" rows={4} placeholder="friend@example.com&#10;another@example.com" required /></label>
              <button className="button button-primary" disabled={submitting} type="submit">{submitting ? 'SENDING…' : 'SEND INVITATIONS ↗'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}