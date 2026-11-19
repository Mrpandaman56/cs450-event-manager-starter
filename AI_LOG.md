# AI Assistance Log

## Week 8 containerization workshop

- **Prompt:** "Do role D for me."
- **Assistance:** Updated the Docker runbook and pull request checklist in `README.md` for the Team V ports and expected service topology.
- **Verification:** Docker Compose built and started successfully. Prisma reported that the database was already in sync with the schema, and both gateway health checks (`localhost:4001` and the frontend proxy at `localhost:5174`) returned a successful response.

## Spring 2 help - Rayden Powell
- AI Assistance Log

- Sprint 2 event 50-event database seeding

- Prompt: "Implement Sprint 2 task of a 50-event seed script."

- Assistance: Created a 50-event seeding script (backend/prisma/seed.ts) to populate dynamic test events into PostgreSQL and updated README.md.

- Verification: Generated Prisma client types, executed npx tsx prisma/seed.ts inside backend/ to populate 50 events into the PostgreSQL container volume, and verified live UI event list rendering and capacity warning banners at http://localhost:5174.

- App.tsx syntax debugging and UI layout refinement

- Prompt: "Fix syntax errors in App.tsx and explain and fix the disabled button hover cursor."

- Assistance: Repaired broken string literals, missing closing JSX tags, and TypeScript errors around line 493 in App.tsx. Added explicit cursor: 'not-allowed' styling to full event buttons on hover to prevent the browser's blue loading cursor.

- Verification: Resolved all 13 issues in the VS Code Problems panel, verified error-free Vite compilation, and visually confirmed cursor behavior at http://localhost:5174.

## Sprint 3 help - George Herrera
- AI Assistance Log

- Prisma schema and database errors

- Prompt: "Help me add event cancellation to the Prisma schema and fix the errors when updating the database."

- Assistance: Helped identify that the wrong version of schema.prisma was open and that running backend
services were locking Prisma files. Added the cancelledAt field to the correct Event model.

- Verification: Successfully generated the Prisma Client and ran db:push. Confirmed the database was in sync with the updated schema.

- Prompt: "Fix the login error and authentication service unavailable message when testing the Event Manager website."

- Assistance: Identified a missing JWT_SECRET in the environment files and helped configure the authentication services. Also helped resolve port conflicts when starting the backend services.

- Verification: Successfully signed in using the Demo Host account. Tested event cancellation and confirmed the event disappeared from Discover, remained in Hosted as CANCELLED, and preserved RSVP history while showing zero active attendance.