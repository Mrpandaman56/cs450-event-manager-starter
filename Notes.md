  
Implement Tests:
Reject Capacity, and non integer capacity

Test, Code changes and be able to explain them, Developmend Branch, JWT - user authentication



## JWT Authentication for Explain in Class

Here’s a class-friendly way to explain the changes.

## The flow

1. **The frontend submits credentials** to the API Gateway. On later requests, it sends the JWT in the `Authorization: Bearer <token>` header. The API client and auth UI are in `App.tsx`.
2. **The Gateway forwards the request** to the user service for authentication, or the event service for event operations. It forwards the bearer header rather than relying on cookies, in `app.ts`.
3. **The user service validates and handles the credentials**, then returns a safe user object and a token, in `userService/app.ts`.
4. **The event service verifies the token** before allowing protected actions, using `middleware/auth.ts`.

## Registration and password storage

The registration schema checks the name, email, and password and normalizes the email—for example, trimming spaces and converting it to lowercase. Invalid input is rejected before the route creates an account.

For a valid registration, the service generates a random salt and uses `scrypt` to derive a password hash. It stores the salt and hash, not the original password. The database’s unique email constraint prevents duplicates; if Prisma reports a duplicate, the API responds with a consistent `409 Conflict`.

The database query explicitly selects only public user fields, so neither the password nor its hash is returned. Registration also returns a JWT, preserving the app’s behavior of signing the user in immediately.

## Login and JWTs

On login, the service looks up the normalized email, hashes the submitted password with the stored salt, and compares the result using a timing-safe comparison. Unknown emails and wrong passwords get the same `401` response. A dummy hash is checked for unknown emails to reduce timing differences between those cases.

The token is a signed **HS256 JWT** with:

- `sub`: the user’s ID
- `iss`: `event-manager-user-service`
- `aud`: `event-manager-api`
- `iat`: issue time
- `exp`: expiration time, one hour after issuance

The token also has an `expiresAt` response field for the client. A JWT is **signed, not encrypted**: its claims can be read by whoever has the token. That’s why it contains an ID and standard token metadata, but not a password, email, or profile details.

The signing secret comes from `JWT_SECRET`, is required to be at least 32 characters, and is configured through environment files—not committed as a secret. The user and event services must use the same value because the user service signs tokens and the event service verifies them. See the `README setup and JWT contract`.

## Frontend startup and sign-out

The frontend keeps the token in `sessionStorage` and attaches it to API calls. When the app starts, it sends the stored token to `/api/auth/me`; if verification fails, it clears the token and shows the sign-in screen. Sign-out clears the token and the current user state.

Because the JWT is stateless, sign-out clears it from this browser but does **not** revoke a copy someone else may have obtained. That copy remains usable until the one-hour expiry. This is a tradeoff of the current design.

## Tests

The auth flow tests use mocked Prisma so they can exercise registration, login, duplicate emails, validation, and `/auth/me` without a running database. Token tests check the claims, expiry, tampering, and configuration requirements. Those tests are in `authFlow.test.ts` and `auth.test.ts`.  
  
  
## NR 2. JWT Verification  
## A class-friendly explanation

The main idea is that a **valid login proves who the caller is, but it does not prove they own every event or invitation**. The API uses the JWT subject to identify the caller, then applies separate resource permissions.

### How authentication works

1. A user registers or logs in through the public auth routes.
2. The user service returns a signed JWT. It contains the account ID in `sub`, plus issuer, audience, issued-at, and expiry claims.
3. For later requests, the frontend sends the token in the `Authorization: Bearer <token>` header.
4. The gateway forwards that header to the event service.
5. The shared auth middleware verifies the token’s signature and claims, checks expiry, and sets `request.userId` from the verified `sub`.

So the API does **not** rely on a user ID supplied in the request body to decide who is making a request. Missing or invalid credentials get `401`. The underlying token handling was already present; I added tests to verify its behavior in `auth.test.ts`.

### Authentication versus authorization

After authentication, the service still checks what the user is allowed to do:

- Only the event creator can edit an event or manage its invitations.
- Registration records use the authenticated user’s ID.
- Invitation actions are limited to the intended recipient.

A logged-in user who lacks permission is denied; authentication alone does not grant ownership. These rules are tested in `authorization.test.ts`.

### Gateway and public routes

The gateway forwards bearer credentials and preserves the service’s response, including authentication errors. Health checks and registration/login remain public, while event, invitation, and `/auth/me` routes require a valid token. I added gateway tests for forwarding and public registration in `api.test.ts`.

### Environment configuration

I changed the gateway and service entry points to load `.env` before importing the apps. That matters because the apps read settings such as `JWT_SECRET` and service URLs during initialization. The user and event services must use the same secret to sign and verify tokens: `gateway index`, `event service index`, and `user service index`.

The README now documents the token transport, expiry, environment setup, and route protection map in `README.md`.

### Short version to say in class

> “The frontend sends a signed JWT in the Authorization header. The API verifies it and takes the user identity from the token, not from user-supplied request data. Then it separately checks permissions—for example, only the event creator can edit an event, and only the invitation recipient can respond. I added tests for invalid tokens, gateway forwarding, and those ownership and recipient rules, and documented which routes are public or protected.”

The backend build passed, and all 33 backend tests passed.