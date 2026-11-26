const masked = "[REDACTED]";

/** Recognize common credential field names in text and structured records. */
export function isCredentialKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return /(?:^|[._-])(?:password|passwd|token|secret|credentials?|authorization|api[_-]?key|access[_-]?key(?:[_-]?id)?|private[_-]?key|secret[_-]?key|signature|sig|ak|sk)$/i.test(
    normalized,
  );
}

export interface MaskUrlOptions {
  /** Mask every query parameter value, including keys outside the credential rules. */
  readonly maskAllQueryValues?: boolean;
  /** Remove the URL fragment, including its delimiter. */
  readonly stripFragment?: boolean;
}

function maskParameters(parameters: string, maskAll: boolean): string {
  return parameters.replace(
    /([?&#])([^?&#=]+)=([^&#]*)/g,
    (field, delimiter: string, key: string) => {
      let decoded = key;
      try {
        decoded = decodeURIComponent(key);
      } catch {
        // An invalid escape in one field must not prevent masking subsequent fields.
      }
      return maskAll || isCredentialKey(decoded)
        ? delimiter + key + "=" + masked
        : field;
    },
  );
}

/** @spec Mask credentials in scheme:// URLs and DSNs while preserving host, path, and ordinary parameters by default. */
export function maskUrl(url: string, options: MaskUrlOptions = {}): string {
  const scheme = /^[a-z][a-z\d+.-]*:\/\//i.exec(url)?.[0];
  if (!scheme) return url;
  // Work on the original spelling to preserve escapes and duplicate keys.
  const address =
    scheme + url.slice(scheme.length).replace(/^[^/?#\s]*@/, masked + "@");
  const fragmentStart = address.indexOf("#");
  const end = fragmentStart < 0 ? address.length : fragmentStart;
  const queryStart = address.indexOf("?");
  const beforeFragment = address.slice(0, end);
  const base =
    queryStart < 0 || queryStart >= end
      ? beforeFragment
      : beforeFragment.slice(0, queryStart) +
        maskParameters(
          beforeFragment.slice(queryStart),
          options.maskAllQueryValues ?? false,
        );
  return options.stripFragment
    ? base
    : base + maskParameters(address.slice(end), false);
}

/** Mask recognizable credential values in diagnostic text while preserving surrounding syntax. */
export function maskCredentials(
  text: string,
  urlOptions?: MaskUrlOptions,
): string {
  const token =
    /\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+|\b(Bearer|Basic)([ \t]+)(?:\[REDACTED\]|[a-z0-9._~+/=-]+)|\b([\w.-]+)(["']?[ \t]*[:=][ \t]*)?/gi;
  const value =
    /"(?:\\[^\r\n]|[^"\\\r\n])*(")?|'(?:\\[^\r\n]|[^'\\\r\n])*(')?|\[REDACTED\]|[^\s"',;}\]]+/y;
  let result = "";
  let copied = 0;
  for (let match = token.exec(text); match; match = token.exec(text)) {
    const [spelling, scheme, space, key, separator] = match;
    let replacement: string;
    if (scheme) {
      replacement = scheme + space + masked;
    } else if (key === undefined) {
      replacement = maskUrl(spelling, urlOptions);
    } else {
      if (!separator || !isCredentialKey(key)) continue;
      value.lastIndex = token.lastIndex;
      const field = value.exec(text);
      if (!field) continue;
      // Let the scheme matcher retain the authentication scheme in a plain header.
      if (
        /authorization$/i.test(key) &&
        /^(?:Bearer|Basic)$/i.test(field[0]) &&
        /[ \t]/.test(text[value.lastIndex] ?? "")
      )
        continue;
      const openingQuote = /^["']/.exec(field[0])?.[0] ?? "";
      const closingQuote = field[1] ?? field[2] ?? "";
      replacement = spelling + openingQuote + masked + closingQuote;
      token.lastIndex = value.lastIndex;
    }
    result += text.slice(copied, match.index) + replacement;
    copied = token.lastIndex;
  }
  return result + text.slice(copied);
}
