# Auth Lab

Simple authentication system built to refresh how modern web auth works.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Frontend:** Vanilla JavaScript
- **Storage:** just JSON files (instead of a database)
- **Password hashing:** Argon2id
- **JWT:** RS256 (asymmetric signing)
- **Refresh tokens:**SHA-256 hashed, cryptographically secure random tokens

## Architecture

```text
Browser                          Express Backend
   |                                   |
   |  POST /register                   |
   |---------------------------------->|
   |                                   | Argon2id(password)
   |                                   | Save to users.json
   |                                   |
   |  POST /login                      |
   |---------------------------------->|
   |                                   | Verify password
   |                                   | Generate tokens
   |<----------------------------------|
   |  Access JWT (response body)       |
   |  Refresh token (HttpOnly cookie)  |
   |                                   |
   |  GET /me                          |
   |  Authorization: Bearer <JWT>      |
   |---------------------------------->|
   |                                   | Verify JWT signature
   |<----------------------------------|
   |  User profile                     |
   |                                   |
   |  POST /refresh                    |
   |  Cookie: refreshToken=<token>     |
   |---------------------------------->|
   |                                   | Validate refresh token
   |                                   | Rotate refresh token
   |<----------------------------------|
   |  New JWT + refresh cookie         |
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Authenticate and issue tokens |
| GET | `/me` | Get authenticated user |
| POST | `/refresh` | Rotate refresh token and issue new JWT |
| POST | `/logout` | Revoke refresh session |

## Security Concepts

- **Argon2id:** Slow, salted hashing protects human passwords.
- **SHA-256:** Fast hashing is sufficient hashing refresh tokens.
- **RS256:** Private key signs JWTs; public key verifies signatures. (Not required for our architecture, we could use HS256 as our backend is the only one who signs and verifies JWT)
- **HttpOnly:** Prevents JavaScript from accessing refresh cookies.
- **SameSite: "strict"** Restricts when browsers attach cookies to cross-site requests.
- **CSRF protection:** Origin validation middleware in pair with sameSite: "strict"
- **Cache-Control: no-store:** Prevents HTTP caching of sensitive API responses.

## Running Locally

```bash
npm install

mkdir -p keys

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/private.pem
openssl pkey -in keys/private.pem -pubout -out keys/public.pem

make dev
```

Open http://localhost:3000.

## Production Limitations

This is an educational project, not a production-ready authentication service.

Production improvements would include:

- PostgreSQL with atomic refresh-token rotation.
- Refresh-token reuse detection.
- Rate limiting and stronger input validation.
- Complete CSRF protection.
- Cross-tab synchronization. 
- ...
