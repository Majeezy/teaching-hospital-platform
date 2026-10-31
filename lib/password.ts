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
 * Used for admin-assisted password resets -- emailed to the user
 * directly (Phase 6 Stage 3), with the admin sharing it out-of-band as
 * a fallback if that email fails to send. base64url keeps it free of
 * characters that break copy-paste into a terminal or URL; 16 bytes is
 * comfortably past the app's own 8-character minimum.
 */
export function generateTemporaryPassword() {
  return randomBytes(16).toString("base64url");
}
