import assert from "node:assert/strict";
import { test } from "node:test";
import { isCredentialKey, maskCredentials } from "@compforge/ts-stdx/string";

test("field names use the same rules in text and structured consumers", () => {
  for (const key of [
    "TOKEN",
    "clientSecret",
    "apiKey",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ACCESS_KEY_ID",
    "X-Amz-Signature",
  ]) {
    assert.equal(isCredentialKey(key), true, key);
    assert.equal(maskCredentials(key + "=value"), key + "=[REDACTED]");
  }
  for (const key of ["monkey", "token_count", "secret_names", "region"]) {
    assert.equal(isCredentialKey(key), false, key);
    assert.equal(maskCredentials(key + "=value"), key + "=value");
  }
});

test("mask URL credentials without reserializing ordinary parameters or paths", () => {
  const input =
    "GET HTTPS://user:pass@STORE:443/a%2Fb?region=cn+east&%74oken=a&token=b&bad%xx=ok#access_token=c";
  const expected =
    "GET HTTPS://[REDACTED]@STORE:443/a%2Fb?region=cn+east&%74oken=[REDACTED]&token=[REDACTED]&bad%xx=ok#access_token=[REDACTED]";
  assert.equal(maskCredentials(input), expected);
  assert.equal(maskCredentials(expected), expected);
  assert.equal(
    maskCredentials("https://store/a?region=cn#info"),
    "https://store/a?region=cn#info",
  );
});

test("mask headers, shell assignments and escaped JSON strings", () => {
  const input =
    'Authorization: Bearer abc.def\nBasic dTpw==\npassword = \'a b\'; {"token":"a\\"b","region":"cn"}';
  const expected =
    'Authorization: Bearer [REDACTED]\nBasic [REDACTED]\npassword = \'[REDACTED]\'; {"token":"[REDACTED]","region":"cn"}';
  assert.equal(maskCredentials(input), expected);
  assert.equal(maskCredentials(expected), expected);
  assert.equal(
    maskCredentials("secret=https://store/path"),
    "secret=[REDACTED]",
  );
  assert.equal(
    maskCredentials("message contains no key"),
    "message contains no key",
  );
  assert.equal(maskCredentials(""), "");
});

test("retain a URL path containing ampersands and mask a quoted value in a truncated log line", () => {
  assert.equal(
    maskCredentials("https://store/path&token=file?region=cn"),
    "https://store/path&token=file?region=cn",
  );
  assert.equal(
    maskCredentials('token="not closed\nnext=value'),
    'token="[REDACTED]\nnext=value',
  );
});
