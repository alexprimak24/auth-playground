import express from "express";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { getUsers, saveUsers } from "./store.js";

const app = express();
// parses incoming JSON req bodies and puts the result in req.body
app.use(express.json());

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

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
