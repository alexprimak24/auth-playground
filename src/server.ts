import express from "express";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { getUsers, saveUsers } from "./store.js";
import { createAccessToken, verifyAccessToken } from "./jwt.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  SEVEN_DAYS,
} from "./refresh.js";
import { checkOrigin } from "./security.js";

const isProduction = process.env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true, // js cannot read this cookie from document.cookie, therefore we reduce risk of XSS
  secure: isProduction, // false for - localhost development only; true with HTTPS , so this allows to send over HTTP
  sameSite: "strict" as const, // cookies is only sent on same-site requests
  path: "/", // cookie is sent to all paths /login /api/users....
};

const app = express();
// parses incoming JSON req bodies and puts the result in req.body
app.use(express.json());
app.use(express.static("public"));

// this mv decides whether to accept request.
// protect state-changing endpoints.
app.use(["/login", "/refresh", "/logout"], checkOrigin);
// while sameSite: "strict" - the browser decides whether to attack cookies
// example: browser sends req without adding Origin or Referer, so our checkOrigin mv will go though but sameSite: "strict" will catch that this req been done from another website, and won't attack cookies

// herefore my js endpoint will read that user does not have accessToken (as it is called from another website) , tries refreshToken - refreshToken does not exist - not authorized

app.use(["/login", "/refresh", "/me"], (req, res, next) => {
  // /me returns private user info, we don't want http caches store that stuff
  // no-store means do nnot store response in HTTP cache
  res.setHeader("Cache-Contol", "no-store");
  next();
});
app.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.includes("@") ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  try {
    const users = await getUsers();

    if (users.some((user) => user.email === email.toLocaleLowerCase())) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = {
      id: randomUUID(),
      email: email.toLowerCase(),
      // salt is already stored in there
      passwordHash,
    };

    users.push(user);
    await saveUsers(users);

    return res.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /login
//     ↓
// Access JWT → JSON response (15 min)
// Refresh token → HttpOnly cookie (7 days)
//     ↓
app.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const users = await getUsers();

    const user = users.find((user) => user.email === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await argon2.verify(user.passwordHash, password);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = await createAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.cookie("refreshToken", refreshToken, {
      ...refreshCookieOptions,
      maxAge: SEVEN_DAYS,
    });

    return res.json({ accessToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/me", async (req, res) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authorization.slice(7);

  try {
    const userId = await verifyAccessToken(token);

    const users = await getUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    return res.json({
      id: user.id,
      email: user.email,
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// POST /refresh
//     ↓
// Validate refresh token
// Rotate it (invalidate old token)
//     ↓
// New access JWT + new refresh cookie
app.post("/refresh", async (req, res) => {
  const cookies = req.headers.cookie ?? "";

  const refreshToken = cookies
    .split("; ")
    .find((c) => c.startsWith("refreshToken="))
    // undefined?.slice(13) // undefined ✅
    // undefined.slice(13)  // TypeError ❌
    ?.slice("refreshToken=".length);

  if (!refreshToken) {
    return res.status(401).json({ error: "Missing refresh token" });
  }

  const result = await rotateRefreshToken(refreshToken);

  if (!result) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  const accessToken = await createAccessToken(result.userId);

  res.cookie("refreshToken", result.token, {
    ...refreshCookieOptions,
    maxAge: SEVEN_DAYS,
  });

  return res.json({ accessToken });
});

// POST /logout
//     ↓
// Read refresh token from cookie
//     ↓
// Delete session from sessions.json
//     ↓
// Clear refresh cookie
//     ↓
// Return 204 No Content
app.post("/logout", async (req, res) => {
  const cookies = req.headers.cookie ?? "";

  const refreshToken = cookies
    .split("; ")
    .find((c) => c.startsWith("refreshToken="))
    ?.slice("refreshToken=".length);

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  res.clearCookie("refreshToken", refreshCookieOptions);

  return res.sendStatus(204);
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
