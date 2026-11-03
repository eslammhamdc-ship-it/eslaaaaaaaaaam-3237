import { setting } from "./runtime";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

// Memory-hard scrypt, using an OWASP-listed N/r/p combination (16 MiB, p=5).
const N = 16384,
  r = 8,
  p = 5;
const derive = (password: string, salt: Uint8Array) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export const clientPasswordMode = () => setting("MIDWAY_CLIENT_KDF") === "true";
export const PASSWORD_ITERATIONS = 600000;
const proofPattern = /^p2\$600000\$([a-f0-9]{32})\$([a-f0-9]{64})$/;
const storedPattern = /^client-pbkdf2\$v1\$600000\$([a-f0-9]{32})\$([a-f0-9]{64})$/;
export function passwordSalt(encoded: string): string | undefined {
  return storedPattern.exec(encoded)?.[1];
}
const proofHash = (proof: string) =>
  createHash("sha256").update(Buffer.from(proof, "hex")).digest();
export async function hashPassword(password: string): Promise<string> {
  if (clientPasswordMode()) {
    const proof = proofPattern.exec(password);
    if (!proof) throw new Error("INVALID_PASSWORD_PROOF");
    // The expensive standard PBKDF2 runs in the HTTPS browser, outside the Worker
    // CPU budget. Store a one-way verifier, never the password-equivalent proof.
    return `client-pbkdf2$v1$600000$${proof[1]}$${proofHash(proof[2]).toString("hex")}`;
  }
  const salt = randomBytes(16),
    key = await derive(password, salt);
  return `scrypt$v1$${N}$${r}$${p}$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const stored = storedPattern.exec(encoded);
  if (stored) {
    const proof = proofPattern.exec(password);
    return (
      !!proof &&
      proof[1] === stored[1] &&
      timingSafeEqual(proofHash(proof[2]), Buffer.from(stored[2], "hex"))
    );
  }
  if (clientPasswordMode()) return false;
  const parts = encoded.split("$");
  if (
    parts.length === 7 &&
    parts[0] === "scrypt" &&
    parts[1] === "v1" &&
    parts[2] === String(N) &&
    parts[3] === String(r) &&
    parts[4] === String(p) &&
    /^[a-f0-9]{32}$/.test(parts[5]) &&
    /^[a-f0-9]{64}$/.test(parts[6])
  ) {
    return timingSafeEqual(
      await derive(password, Buffer.from(parts[5], "hex")),
      Buffer.from(parts[6], "hex"),
    );
  }
  // Preserve existing local Bun accounts. New Worker deployments use fresh D1 accounts.
  if (encoded.startsWith("$argon2") && typeof Bun !== "undefined")
    return Bun.password.verify(password, encoded);
  return false;
}
