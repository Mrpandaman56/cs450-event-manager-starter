# Event Manager Starter

A full-stack event planning and RSVP application for organizing events, tracking attendance, and managing registrations.

## Product overview
This app helps organizers create events, invite attendees, manage RSVPs, and monitor capacity in one place. It is designed to model common event operations and real-world business rules.

## Core user experience
- create events with a title, date, time, location, and description
- view upcoming events in a searchable list
- RSVP to an event
- update attendee status
- monitor event capacity and attendance
- filter events by date or category

## MVP features to implement
- event list and detail pages
- event creation and editing
- attendee RSVP flow
- attendance and status tracking
- capacity and registration rules
- seeded demo events for testing

## Optional PM enhancements
- waitlist logic
- event categories and tags
- organizer check-in workflow
- cancellation and refund handling
- attendee messaging
- attendance trend analytics

## Tech stack
- Backend: Node.js, Express, TypeScript
- Frontend: React + TypeScript
- Database: PostgreSQL + Prisma
- Tooling: Docker Compose

## Getting started

### Prerequisites

Install the following before starting:

- Git
- Node.js 20 or later, which includes npm
- Docker Desktop or Docker Engine with Docker Compose

### Create your project copy

1. Click **Fork** and create the fork in your own account or team organization. Forking creates your GitHub copy; it does not download the files to your computer.
2. Clone your fork, replacing `YOUR-GITHUB-USERNAME` with the account or organization that owns your fork:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/cs450-event-manager-starter.git
cd cs450-event-manager-starter
```

### Configure and start the application

Run these commands from the project root:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Set `JWT_SECRET` in both `.env` files to the same randomly generated value of at
least 32 characters before starting the services. For example, generate one
with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
Do not commit either `.env` file.

Then install dependencies and start the database:

```bash
npm --prefix backend install
npm --prefix frontend install
docker compose up -d --wait
npm --prefix backend run prisma:generate
npm --prefix backend run db:push
```

The database runs in Docker on port `5433`. The `db:push` command creates or
updates the database tables from the Prisma schema.

The demo uses an event and user-service slice of the microservice
architecture. The React client calls the API gateway, which routes account
requests to the user service and event, registration, and invitation requests
to the event service. Both services use PostgreSQL.

Open four terminal windows from the project root and start each service:

Terminal 1, the event service:

```bash
npm --prefix backend run dev:event
```

Terminal 2, the user service:

```bash
npm --prefix backend run dev:user
```

Terminal 3, the API gateway:

```bash
npm --prefix backend run dev
```

Terminal 4, the frontend:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5174 in a browser. The API gateway is available at
http://localhost:4001 and the event service at http://localhost:4002. The
user service is available at http://localhost:4003. The
frontend proxies `/api` requests to the gateway, so it does not need a separate
API URL or CORS configuration.

## Run with Docker

1. `cp .env.example .env`
2. Set `JWT_SECRET` in `.env` to a randomly generated value of at least 32
   characters (for example, generate one with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`).
3. `docker compose up --build`
4. Access the UI: http://localhost:5174
5. Verify the API gateway directly: `curl http://localhost:4001/api/health`
6. Verify the frontend proxy: `curl http://localhost:5174/api/health`
7. Shut down: `docker compose down`

Compose uses the Event Manager-specific `EVENT_MANAGER_DB_NAME` setting and
defaults to `event_manager_app`, so unrelated `POSTGRES_DB` settings in a
local `.env` do not change the app's database name. If changing an existing
installation's database name, note that PostgreSQL does not rename databases
inside an already-initialized data volume.

The gateway is published on port `4001`; the event and user services use
ports `4002` and `4003` inside the Compose network. PostgreSQL listens on
container port `5432` and is published on host port `5433`. Use the Compose
service name and container port for service-to-service connections, not
`localhost` or the host-published port.

### Diagnostics & Verification

| Check | Expected result | Underlying concept |
|---|---|---|
| Startup order | The API services wait for the database health check, and the gateway waits for schema setup to finish. | A running process is not necessarily ready to serve requests. |
| Database connection | Backend services connect to `db:5432`. | Compose service DNS and container ports are used between containers. |
| Gateway health | `curl http://localhost:4001/api/health` returns a successful health response. | Published host ports forward traffic to the container. |
| Frontend proxy | `curl http://localhost:5174/api/health` returns the gateway health response. | Vite forwards `/api` requests to the gateway service. |
| Persistence | The `postgres_data` volume remains after `docker compose down`. | Named volumes preserve database data beyond a container's lifetime. |

If a check fails, inspect the relevant service with `docker compose ps` and
`docker compose logs <service>`. For example, use `docker compose logs gateway`
for gateway startup errors. `docker compose down -v` also removes the database
volume and its data; only use it when you intend to reset the local database.

### Pull Request checklist

- [ ] README setup commands, URLs, and ports match the Team V Compose configuration.
- [ ] Each student adds a code review comment answering their role's concept question.
- [ ] Runbook verification results and any troubleshooting findings are recorded after testing.

## Demo walkthrough

1. Create a user account with an email and a password of at least 10 characters.
2. Create an event with a name, date, location, capacity, and optional price,
   directions link, description, and invitations to existing accounts.
3. Sign out and sign in as an invited account. Accept or decline the invitation,
   or choose **Attending** or **Not attending** for an open event in **Discover**.
4. Check **My events** to see events you host (including past events) or events
   you are attending. Remaining spots update when users reserve or cancel.
   Open **Guest list** on a hosted event to see invited, accepted, and declined
   guests along with the current attendance count and spots left.
5. Use **Invite people** on an event you host to invite registered users later.

Event prices are informational only; this demo does not collect payments.
Passwords are stored as salted hashes. Registration and login return a signed
JWT using HS256. Its contract includes `sub` (the account ID), `iss`
(`event-manager-user-service`), `aud` (`event-manager-api`), `iat`, and `exp`;
the lifetime is one hour, and no password, email, or profile data is included
in the token. `JWT_SECRET` must be supplied through the environment and contain
at least 32 characters; use the same randomly generated value for the user and
event services. The browser keeps the token in session storage and sends it in
the `Authorization: Bearer <token>` header for authenticated API requests;
sign-out clears it from session storage, and cookies are not used for
authentication. On application startup, the frontend checks the stored token
with `/api/auth/me` before loading authenticated event data.
Account creation is local and does not send email verification messages.

To stop the database, run this from the project root:

```bash
docker compose down
```

## Expected project outcomes
- a working event management and RSVP workflow
- a structured backlog for feature enhancements
- a deployable app setup
- a polished final demo and product walkthrough

## Architecture and schema decisions

The website is split into a React/TypeScript client, an Express API gateway, and two backend services. Vite serves the frontend and proxies its `/api` calls to the gateway. The gateway forwards `/api/auth` requests to the user service and `/api/events` and `/api/invitations` requests to the event service, forwarding bearer authorization headers and returning service responses. Both services use PostgreSQL through Prisma.

The user service handles accounts and issues signed JWT access tokens after registration and sign-in. It stores a unique email and a salted password hash; the event service verifies bearer tokens using the same `JWT_SECRET` and requires an authenticated user for event, registration, and invitation routes.

The Prisma schema separates `User`, `Event`, `Registration`, and `Invitation` because hosting, attending, and being invited are distinct relationships. A unique `[eventId, userId]` constraint prevents duplicate registrations, and a unique `[eventId, recipientId]` constraint prevents duplicate invitations to the same event. Account-based RSVP responses are stored on `Registration` as attending or declined; only attending registrations count toward capacity. Changing an RSVP to not attending releases the spot and appears in the host's guest list. The schema also contains a separate guest-name `RSVP` model; the current account-based RSVP routes use `Registration`.

Each event stores its total `capacity` and its `remainingSpots`. Transactions update availability when users register or cancel, while a unique user/event registration prevents duplicate reservations. Request validation uses Zod: event dates must be valid `YYYY-MM-DD` dates, capacity must be a non-negative integer, and RSVP responses must be attending or not attending. Prices entered in dollars are converted to an integer. PostgreSQL runs through Docker Compose, and Prisma applies the schema with `db:push`.


- **Invite-Only Events:** Hides events from non-invitees and restricts RSVP responses to invitees and event creators.
- **Capacity Rules & Warning Banners:** Supports zero-capacity events (`capacity = 0`), serializable reservation locking, and dynamic `≥ 90% CAPACITY (ALMOST FULL)` warning badges.
- **50-Event Demo Seeding:** Populates the database with test events across realistic dates, capacities, and invitation states.

# Generate Prisma types and apply migrations
npm --prefix backend run prisma:generate
npm --prefix backend run db:push

# Run the 50-event seed script:
cd backend
npx tsx prisma/seed.ts