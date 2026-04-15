/**
 * Confirm Email Change Template
 *
 * Sent when a user changes their email address and needs to verify the new one.
 * Uses Supabase Auth Go template variables:
 *   {{ .ConfirmationURL }} — the email change confirmation link
 *   {{ .SiteURL }}         — the site base URL
 *   {{ .Token }}           — OTP token
 *
 * To use: paste the output of getConfirmEmailHtml() into
 * Supabase Dashboard → Auth → Email Templates → Change Email Address
 */

import { wrapEmail } from './shared'

export const CONFIRM_EMAIL_SUBJECT = 'Confirm your new email address — Print Room Staff Portal'

export function getConfirmEmailHtml(): string {
  return wrapEmail(
    CONFIRM_EMAIL_SUBJECT,
    `
      <h1>Confirm your new email</h1>
      <p>Kia ora,</p>
      <p>We received a request to update the email address on your Print Room Staff Portal account. Please confirm this change by clicking the button below.</p>

      <div class="accent-box">
        <p>This will update your login email for the Staff Portal.</p>
      </div>

      <div class="button-row">
        <a href="{{ .ConfirmationURL }}" class="button" target="_blank">Confirm New Email</a>
      </div>

      <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br/><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

      <div class="divider"></div>

      <p class="text-muted">If you didn't request this email change, please contact your portal administrator immediately.</p>

      <p style="margin-top:18px;font-size:14px;color:#111827;">Cheers,<br/><strong>The Print Room Team</strong></p>
    `
  )
}
