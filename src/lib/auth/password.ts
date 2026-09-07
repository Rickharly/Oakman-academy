import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hash a plaintext password or PIN (cost 10). PINs (4-6 digits) are hashed the same way. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify a plaintext password/PIN against a bcrypt hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
