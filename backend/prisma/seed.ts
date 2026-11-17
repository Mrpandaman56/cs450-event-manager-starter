import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const demoEventPrefix = '[Demo] ';

const demoAccounts = {
  host: {
    name: 'Demo Host',
    email: 'demohost@example.com',
    password: 'DemoHost123!'
  },
  guest: {
    name: 'Demo Guest',
    email: 'demoguest@example.com',
    password: 'DemoGuest123!'
  }
};

const demoEvents = [
  {
    title: 'Community Tech Meetup',
    daysFromNow: 3,
    location: 'Downtown Co-working Space',
    capacity: 2,
    priceCents: 0,
    inviteOnly: false,
    registeredUsers: ['host'],
    description: 'Meet local developers and share what you are building.'
  },
  {
    title: 'Invite-only Product Workshop',
    daysFromNow: 7,
    location: 'Innovation Hub Studio B',
    capacity: 12,
    priceCents: 1500,
    inviteOnly: true,
    registeredUsers: [],
    description: 'A hands-on workshop. A pending invitation is ready for the demo guest.'
  },
  {
    title: 'Community Garden Cleanup',
    daysFromNow: 10,
    location: 'Central Park Pavilion',
    capacity: 20,
    priceCents: 0,
    inviteOnly: false,
    registeredUsers: [],
    description: 'Help prepare the community garden for the season.'
  },
  {
    title: 'Fully Booked Design Thinking Workshop',
    daysFromNow: 14,
    location: 'City Library Conference Room',
    capacity: 2,
    priceCents: 1000,
    inviteOnly: false,
    registeredUsers: ['host', 'guest'],
    description: 'Practice turning user needs into useful product ideas.'
  },
  {
    title: 'Indie Music Showcase',
    daysFromNow: 21,
    location: 'Rooftop Lounge',
    capacity: 50,
    priceCents: 2000,
    inviteOnly: false,
    registeredUsers: [],
    description: 'An evening of live music from local artists.'
  },
  {
    title: 'Board Game Night',
    daysFromNow: 28,
    location: 'Community Center Room 101',
    capacity: 18,
    priceCents: 0,
    inviteOnly: false,
    registeredUsers: [],
    description: 'Bring a favorite game or join a table when you arrive.'
  }
];

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

function eventDate(daysFromNow: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function seed() {
  const [hostPasswordHash, guestPasswordHash] = await Promise.all([
    hashPassword(demoAccounts.host.password),
    hashPassword(demoAccounts.guest.password)
  ]);

  await prisma.$transaction(async (transaction) => {
    const host = await transaction.user.upsert({
      where: { email: demoAccounts.host.email },
      update: { name: demoAccounts.host.name, passwordHash: hostPasswordHash },
      create: {
        name: demoAccounts.host.name,
        email: demoAccounts.host.email,
        passwordHash: hostPasswordHash
      }
    });
    const guest = await transaction.user.upsert({
      where: { email: demoAccounts.guest.email },
      update: { name: demoAccounts.guest.name, passwordHash: guestPasswordHash },
      create: {
        name: demoAccounts.guest.name,
        email: demoAccounts.guest.email,
        passwordHash: guestPasswordHash
      }
    });

    await transaction.event.deleteMany({
      where: { title: { startsWith: demoEventPrefix } }
    });

    const createdEvents = [];
    for (const [index, event] of demoEvents.entries()) {
      createdEvents.push(await transaction.event.create({
        data: {
          title: `${demoEventPrefix}${event.title}`,
          date: eventDate(event.daysFromNow),
          location: event.location,
          capacity: event.capacity,
          remainingSpots: event.capacity - event.registeredUsers.length,
          priceCents: event.priceCents,
          description: event.description,
          inviteOnly: event.inviteOnly,
          createdById: host.id
        }
      }));

      if (event.registeredUsers.length > 0) {
        await transaction.registration.createMany({
          data: event.registeredUsers.map((userRole) => ({
            eventId: createdEvents[index].id,
            userId: userRole === 'host' ? host.id : guest.id
          }))
        });
      }

      if (index === 1) {
        await transaction.invitation.create({
          data: {
            eventId: createdEvents[index].id,
            senderId: host.id,
            recipientId: guest.id
          }
        });
      }
    }
  });

  console.log('Seeded 2 demo accounts, 6 upcoming events, and 1 pending invitation.');
  console.log(`Host:  ${demoAccounts.host.email} / ${demoAccounts.host.password}`);
  console.log(`Guest: ${demoAccounts.guest.email} / ${demoAccounts.guest.password}`);
}

seed()
  .catch((error) => {
    console.error('Seeding error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
