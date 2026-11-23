// Run: npm run test:security   (plain Node >= 22.6; no extra dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jsonForInlineScript } from '../lib/script-json.ts';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const hostile = {
  description: '</script><script>window.ReactNativeWebView.postMessage("x")</script>',
  prefill: { name: 'A<!--B', email: 'a&b@example.com', contact: LS + PS },
};

test('plain JSON.stringify would let the value break out of the script (the bug)', () => {
  assert.ok(JSON.stringify(hostile).includes('</script>'));
});

test('escaped output never contains a raw script terminator or HTML-significant character', () => {
  const out = jsonForInlineScript(hostile);
  for (const ch of ['<', '>', '&', LS, PS]) assert.ok(!out.includes(ch), 'unescaped character left in output: ' + ch.charCodeAt(0));
  assert.ok(!out.toLowerCase().includes('</script'));
});

test('escaped output evaluates to exactly the same value', () => {
  assert.deepEqual(JSON.parse(jsonForInlineScript(hostile)), hostile);
  assert.deepEqual(JSON.parse(jsonForInlineScript({ a: 1, b: [true, null, 'x'] })), { a: 1, b: [true, null, 'x'] });
});

test('RazorpayCheckout builds its options through the helper', () => {
  const src = readFileSync(new URL('../components/RazorpayCheckout.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('jsonForInlineScript('), 'RazorpayCheckout must use jsonForInlineScript');
  assert.ok(!/const options = JSON\.stringify\(/.test(src), 'raw JSON.stringify of options is back');
});
