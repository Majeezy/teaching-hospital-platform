import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SALT_ROUNDS = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Used for admin-assisted password resets -- the admin communicates
 * this to the user out-of-band (no email provider exists anywhere in
 * this project). base64url keeps it free of characters that break
 * copy-paste into a terminal or URL; 16 bytes is comfortably past the
 * app's own 8-character minimum.
 */
export function generateTemporaryPassword() {
  return randomBytes(16).toString("base64url");
}
