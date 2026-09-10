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
cp backend/.env.example backend/.env
npm --prefix backend install
npm --prefix frontend install
docker compose up -d
npx --prefix backend prisma generate
npx --prefix backend prisma migrate dev --name init
```

The database runs in Docker on port `5433`. The migration command creates the
database tables from the Prisma schema.

Open two terminal windows from the project root and start the application:

Terminal 1, the backend:

```bash
npm --prefix backend run dev
```

Terminal 2, the frontend:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5174 in a browser. The backend API is available at
http://localhost:4001.

To stop the database, run this from the project root:

```bash
docker compose down
```

## Expected project outcomes
- a working event management and RSVP workflow
- a structured backlog for feature enhancements
- a deployable app setup
- a polished final demo and product walkthrough
