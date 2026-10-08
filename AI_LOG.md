# AI Use Log - Assignment 1

## Prompts & Requests
1. "Help me figure out where i need to continue and guide me through the tasks."
2. Diagnostics on PowerShell path execution, Prisma schema resolution, and Docker Desktop startup errors.

## Summary of AI Output
- Identified current environment parameters and verified correct assigned ports for Event Manager (`5174`, `4001`, `5433`).
- Diagnosed Docker engine startup state and Prisma schema path resolution behavior in PowerShell.
- Provided a typed health check utility for TypeScript verification requirement.

## Manual Changes Made
- Navigated explicitly into the `backend/` folder to run `npx prisma generate` and `npx prisma migrate dev`.
- Created `backend/src/utils/healthCheck.ts` with explicit TypeScript interface exports.
- Updated `README.md` with team setup specifications and troubleshooting documentation.

## Verification Method
- Verified PostgreSQL container was running via `docker compose ps`.
- Verified migration creation in `backend/prisma/migrations/`.
- Verified dev servers start up and render at `http://localhost:5174`.