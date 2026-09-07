import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes a password to a bcrypt hash distinct from the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it("verifies a matching password", async () => {
    const hash = await hashPassword("parent1234");
    await expect(verifyPassword("parent1234", hash)).resolves.toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("parent1234");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("hashes a 4-digit PIN like any other secret", async () => {
    const hash = await hashPassword("4821");
    await expect(verifyPassword("4821", hash)).resolves.toBe(true);
    await expect(verifyPassword("1248", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("same-input"), hashPassword("same-input")]);
    expect(a).not.toBe(b);
  });
});
