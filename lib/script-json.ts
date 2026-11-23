/**
 * Serialise a value so it is safe to paste inside an inline <script> block.
 *
 * JSON.stringify does NOT escape "<", so a value such as "</script><script>..."
 * (for example a customer name or package description that ends up in the
 * Razorpay checkout options) closes the script element early and lets the rest
 * run as markup/script in the payment WebView. Escaping <, >, & and the two
 * JS line separators keeps the output valid JSON/JS that evaluates to the same value.
 *
 * No imports on purpose: runnable by plain Node for tests.
 */
const LS = String.fromCharCode(0x2028); // LINE SEPARATOR
const PS = String.fromCharCode(0x2029); // PARAGRAPH SEPARATOR

export function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}
