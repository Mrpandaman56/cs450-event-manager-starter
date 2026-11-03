import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleTitles = [
  'Tech Meetup & Networking', 'Community Garden Cleanup', 'Design Thinking Workshop',
  'Startup Pitch Night', 'Local Farmers Market', 'Indie Music Showcase',
  'Outdoor Yoga Session', 'Cybersecurity Panel', 'AI & ML Discussion',
  'Board Game Night'
];

const sampleLocations = [
  'Main Auditorium, Building A', 'Central Park Pavilion', 'Downtown Co-working Space',
  'Community Center Room 101', 'City Library Conference Room', 'Rooftop Lounge',
  'Innovation Hub Studio B'
];

async function seed() {
  console.log('Seeding database with demo user and 50 events...');

  // Ensure a primary demo host account exists
  let host = await prisma.user.findFirst();
  if (!host) {
    host = await prisma.user.create({
      data: {
        name: 'Demo Host',
        email: 'demohost@example.com',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv' // placeholder hash
      }
    });
  }

  const eventsData = [];
  const baseDate = new Date();

  for (let i = 1; i <= 50; i++) {
    const titleIndex = (i - 1) % sampleTitles.length;
    const locationIndex = (i - 1) % sampleLocations.length;

    // Distribute event dates across the next 60 days
    const eventDate = new Date(baseDate);
    eventDate.setDate(baseDate.getDate() + (i % 60));

    const capacity = (i % 5 === 0) ? 0 : 10 + (i * 2); // Mix in capacity = 0 events
    const inviteOnly = i % 4 === 0; // Every 4th event is invite-only

    eventsData.push({
      title: `${sampleTitles[titleIndex]} #${i}`,
      date: eventDate,
      location: sampleLocations[locationIndex],
      capacity: capacity,
      remainingSpots: capacity,
      priceCents: (i % 3 === 0) ? 1500 : 0,
      description: `Description for demo event #${i}. Join us for an engaging community gathering.`,
      inviteOnly: inviteOnly,
      createdById: host.id
    });
  }

  // Clear previous test events if needed and insert batch
  await prisma.event.createMany({
    data: eventsData
  });

  console.log('Successfully seeded 50 events into PostgreSQL database.');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });