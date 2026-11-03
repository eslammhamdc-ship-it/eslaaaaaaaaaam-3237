import { expect, test } from "bun:test";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword, passwordSalt } from "./password";
import { runtime, type DatabaseRuntime } from "./runtime";

test("native password hashing has unique salts and preserves legacy Bun verification", async () => {
  const password = crypto.randomUUID();
  const first = await hashPassword(password),
    second = await hashPassword(password);
  expect(first).not.toBe(second);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword("incorrect", first)).toBe(false);
  const legacy = await Bun.password.hash(password);
  expect(await verifyPassword(password, legacy)).toBe(true);
});
test("Worker password verifier requires the correct PBKDF2 proof, never the stored hash", async () => {
  const salt = randomBytes(16).toString("hex"),
    password = crypto.randomUUID();
  const key = pbkdf2Sync(password, Buffer.from(salt, "hex"), 600000, 32, "sha256").toString("hex");
  const wire = `p2$600000$${salt}$${key}`;
  await runtime.run(
    { database: {} as DatabaseRuntime, env: { MIDWAY_CLIENT_KDF: "true" } },
    async () => {
      const stored = await hashPassword(wire);
      expect(stored).not.toContain(key);
      expect(passwordSalt(stored)).toBe(salt);
      expect(await verifyPassword(wire, stored)).toBe(true);
      expect(await verifyPassword(password, stored)).toBe(false);
      expect(await verifyPassword(`p2$600000$${salt}$${stored.split("$").at(-1)}`, stored)).toBe(
        false,
      );
      expect(await verifyPassword(`p2$600000$${"00".repeat(16)}$${key}`, stored)).toBe(false);
      expect(await verifyPassword(`p2$600000$${salt}$${"00".repeat(32)}`, stored)).toBe(false);
      await expect(hashPassword(password)).rejects.toThrow("INVALID_PASSWORD_PROOF");
      await expect(hashPassword(`p2$1000$${salt}$${key}`)).rejects.toThrow(
        "INVALID_PASSWORD_PROOF",
      );
    },
  );
});
