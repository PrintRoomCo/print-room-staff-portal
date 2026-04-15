/**
 * Invitation Email Template
 *
 * Sent when an admin invites a new staff member to the portal.
 * Uses Supabase Auth Go template variables:
 *   {{ .ConfirmationURL }} — the invite acceptance link
 *   {{ .SiteURL }}         — the site base URL
 *   {{ .Token }}           — OTP token
 *
 * To use: paste the output of getInvitationHtml() into
 * Supabase Dashboard → Auth → Email Templates → Invite user
 */

import { wrapEmail } from './shared'

export const INVITATION_SUBJECT = "You're invited to The Print Room Staff Portal"

export function getInvitationHtml(): string {
  return wrapEmail(
    INVITATION_SUBJECT,
    `
      <h1>You've been invited</h1>
      <p>Kia ora,</p>
      <p>You've been invited to join the <strong>Print Room Staff Portal</strong> — our internal hub for managing jobs, generating images, building quotes, and more.</p>

      <div class="accent-box">
        <p>Click the button below to accept your invitation and set up your password.</p>
      </div>

      <div class="button-row">
        <a href="{{ .ConfirmationURL }}" class="button" target="_blank">Accept Invitation</a>
      </div>

      <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br/><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

      <div class="divider"></div>

      <p class="text-muted">This invitation was sent by a Print Room administrator. If you weren't expecting this, you can safely ignore it.</p>

      <p style="margin-top:18px;font-size:14px;color:#111827;">Cheers,<br/><strong>The Print Room Team</strong></p>
    `
  )
}
