import { readFile, writeFile } from "node:fs/promises";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
};

const FILE = "./users.json";

export async function getUsers(): Promise<User[]> {
  try {
    const data = await readFile(FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  await writeFile(FILE, JSON.stringify(users, null, 2));
}
