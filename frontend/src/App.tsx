const events = [
  { id: 1, title: 'Design Meetup', date: '2026-09-10', location: 'Studio 2', capacity: 40, attendees: 24 },
  { id: 2, title: 'Startup Pitch Night', date: '2026-09-14', location: 'Hudson Hall', capacity: 60, attendees: 31 }
];

export default function App() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Event Manager</h1>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {events.map((event) => (
          <div key={event.id} style={{ background: '#fff', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ margin: '0 0 0.5rem' }}>{event.title}</h2>
            <div style={{ color: '#4b5563' }}>
              {event.date} · {event.location}
            </div>
            <div style={{ marginTop: '0.75rem', fontWeight: 600 }}>
              {event.attendees} / {event.capacity} attendees
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
