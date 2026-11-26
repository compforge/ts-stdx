import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCredentialKey,
  maskCredentials,
  maskUrl,
  maskUrlsInText,
} from "@compforge/ts-stdx/string";

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

test("the standalone URL masker and free-text masker share DSN rules", () => {
  const dsn = "redis://default:pass@redis:6379/0?region=cn&token=value";
  const expected = "redis://[REDACTED]@redis:6379/0?region=cn&token=[REDACTED]";
  assert.equal(maskUrl(dsn), expected);
  assert.equal(maskCredentials("dial " + dsn), "dial " + expected);
  assert.equal(
    maskUrl("mysql://user:p%40ss@mysql:3306/db"),
    "mysql://[REDACTED]@mysql:3306/db",
  );
  assert.equal(maskUrl("token=ordinary"), "token=ordinary");
});

test("URL options can mask every query value and discard fragments independently", () => {
  const url = "HTTPS://store/asset?region=cn&custom=opaque&region=us#details";
  const queryMasked =
    "HTTPS://store/asset?region=[REDACTED]&custom=[REDACTED]&region=[REDACTED]";
  assert.equal(
    maskUrl(url, { maskAllQueryValues: true }),
    queryMasked + "#details",
  );
  assert.equal(maskUrl(url, { stripFragment: true }), url.split("#")[0]);
  assert.equal(
    maskUrlsInText("request token=ordinary " + url, {
      maskAllQueryValues: true,
      stripFragment: true,
    }),
    "request token=ordinary " + queryMasked,
  );
});
