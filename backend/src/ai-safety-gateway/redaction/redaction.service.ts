import { Injectable } from "@nestjs/common";

export type RedactionStats = {
  emails: number;
  phones: number;
  urls: number;
  addresses: number;
  ssn: number;
  names: number;
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const ADDRESS_REGEX = /\b\d{1,5}\s+\w+(?:\s+\w+){0,4}\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard)\b/gi;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

const NAME_KEYS = new Set(["name", "full_name", "first_name", "last_name"]);

const DEFAULT_STATS: RedactionStats = {
  emails: 0,
  phones: 0,
  urls: 0,
  addresses: 0,
  ssn: 0,
  names: 0,
};

const applyRedaction = (
  input: string,
  regex: RegExp,
  token: string,
  stats: RedactionStats,
  key: keyof RedactionStats,
) => {
  let count = 0;
  const output = input.replace(regex, () => {
    count += 1;
    return token;
  });
  stats[key] += count;
  return output;
};

@Injectable()
export class RedactionService {
  redact(payload: unknown) {
    const stats: RedactionStats = { ...DEFAULT_STATS };
    const sanitizedPayload = this.redactValue(payload, stats, null);

    return { sanitizedPayload, redactionStats: stats };
  }

  private redactValue(
    value: unknown,
    stats: RedactionStats,
    key: string | null,
  ): unknown {
    if (value === null || value === undefined) return value;

    if (key && NAME_KEYS.has(key.toLowerCase())) {
      stats.names += 1;
      return "[REDACTED_NAME]";
    }

    if (typeof value === "string") {
      return this.redactString(value, stats);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.redactValue(entry, stats, null));
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        result[childKey] = this.redactValue(childValue, stats, childKey);
      }
      return result;
    }

    return value;
  }

  private redactString(value: string, stats: RedactionStats) {
    let output = value;
    output = applyRedaction(output, EMAIL_REGEX, "[REDACTED_EMAIL]", stats, "emails");
    output = applyRedaction(output, PHONE_REGEX, "[REDACTED_PHONE]", stats, "phones");
    output = applyRedaction(output, URL_REGEX, "[REDACTED_URL]", stats, "urls");
    output = applyRedaction(
      output,
      ADDRESS_REGEX,
      "[REDACTED_ADDRESS]",
      stats,
      "addresses",
    );
    output = applyRedaction(output, SSN_REGEX, "[REDACTED_SSN]", stats, "ssn");
    return output;
  }
}
