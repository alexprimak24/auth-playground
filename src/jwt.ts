import { readFile } from "node:fs/promises";
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";

const privatePem = await readFile("./keys/private.pem", "utf8");
const publicPem = await readFile("./keys/public.pem", "utf8");

const privateKey = await importPKCS8(privatePem, "RS256");
const publicKey = await importSPKI(publicPem, "RS256");

export async function createAccessToken(userId: string) {
  return new SignJWT({}) // Create empty JWT payload
    .setProtectedHeader({ alg: "RS256" }) // Signing algorithm
    .setSubject(userId) // sub: User ID
    .setIssuer("auth-lab") // iss: Who created the token
    .setAudience("auth-lab-api") // aud: Who should accept the token
    .setIssuedAt() // iat: Creation timestamp
    .setExpirationTime("15m") // exp: Expires in 15 minutes
    .sign(privateKey); // Sign using private key
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ["RS256"], // Only accept RS256
    issuer: "auth-lab", // Must be issued by auth-lab
    audience: "auth-lab-api", // Must target our API
  });

  return payload.sub; // Return user ID
}
