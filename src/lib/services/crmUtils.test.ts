import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCrmPhone, parseCrmCsv } from "./crmUtils";

test("CRM CSV parser handles BOM, quoted delimiters, and embedded newlines", () => {
  assert.deepEqual(
    parseCrmCsv('\uFEFFName,Phone,Notes\r\n"Ahmed, Ali",01012345678,"line one\nline two"\r\n'),
    [
      ["Name", "Phone", "Notes"],
      ["Ahmed, Ali", "01012345678", "line one\nline two"],
    ]
  );
});

test("CRM CSV parser detects semicolon separators and escaped quotes", () => {
  assert.deepEqual(parseCrmCsv('Name;Notes\nSara;"Said ""hello"""\n'), [
    ["Name", "Notes"],
    ["Sara", 'Said "hello"'],
  ]);
});

test("CRM phone normalization accepts Egyptian mobile formats and rejects invalid values", () => {
  assert.equal(normalizeCrmPhone("01012345678"), "+201012345678");
  assert.equal(normalizeCrmPhone("+20 10 1234 5678"), "+201012345678");
  assert.equal(normalizeCrmPhone("1012345678"), "+201012345678");
  assert.equal(normalizeCrmPhone("٠١٠١٢٣٤٥٦٧٨"), "+201012345678");
  assert.equal(normalizeCrmPhone("0101234"), "");
  assert.equal(normalizeCrmPhone(""), "");
});
