import { Resend } from "resend";

/**
 * Mirrors lib/audit.ts/lib/notifications.ts -- one small helper per
 * concern, called from inside the action that causes the event. Only one
 * email exists so far (admin-assisted password reset, Phase 6 Stage 3);
 * a generic templating layer would be speculative scope for a single
 * caller.
 *
 * The Resend client is constructed per call, not at module load -- this
 * file gets imported by actions/users.ts even in test runs that mock
 * sendPasswordResetEmail entirely, and a missing RESEND_API_KEY shouldn't
 * throw before the mock ever gets a chance to intercept the call.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: params.to,
    subject: "Your password has been reset",
    text:
      `Hi ${params.name},\n\n` +
      `An administrator has reset your password for the Teaching Hospital Platform.\n\n` +
      `Your temporary password is:\n\n${params.temporaryPassword}\n\n` +
      `Sign in with it. If you weren't expecting this, contact your ` +
      `administrator right away.\n`,
  });
}
