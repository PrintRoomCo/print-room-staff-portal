/**
 * Sign Up Confirmation Email Template
 *
 * Sent when a new user signs up and needs to confirm their email.
 * Uses Supabase Auth Go template variables:
 *   {{ .ConfirmationURL }} — the confirmation link
 *   {{ .SiteURL }}         — the site base URL
 *   {{ .Token }}           — OTP token
 *
 * To use: paste the output of getSignupConfirmationHtml() into
 * Supabase Dashboard → Auth → Email Templates → Confirm signup
 */

import { wrapEmail } from './shared'

export const SIGNUP_CONFIRMATION_SUBJECT = 'Confirm your Print Room Staff Portal account'

export function getSignupConfirmationHtml(): string {
  return wrapEmail(
    SIGNUP_CONFIRMATION_SUBJECT,
    `
      <h1>Welcome to the team</h1>
      <p>Kia ora,</p>
      <p>Thanks for signing up to the Print Room Staff Portal. Please confirm your email address to activate your account and get started.</p>

      <div class="accent-box">
        <p>Click the button below to verify your email and log in to the portal.</p>
      </div>

      <div class="button-row">
        <a href="{{ .ConfirmationURL }}" class="button" target="_blank">Confirm Email</a>
      </div>

      <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br/><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

      <div class="divider"></div>

      <p class="text-muted">If you didn't sign up for this account, you can safely ignore this email.</p>

      <p style="margin-top:18px;font-size:14px;color:#111827;">Cheers,<br/><strong>The Print Room Team</strong></p>
    `
  )
}
