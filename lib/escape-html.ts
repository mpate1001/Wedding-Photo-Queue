/**
 * Escapes special HTML characters to prevent XSS when interpolating
 * untrusted strings (e.g. member names from Google Sheets) into HTML templates.
 *
 * Replaces in order: & < > " '
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
