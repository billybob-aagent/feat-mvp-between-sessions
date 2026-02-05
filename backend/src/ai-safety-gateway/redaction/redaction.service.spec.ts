import { RedactionService } from "./redaction.service";

describe("RedactionService", () => {
  const service = new RedactionService();

  it("redacts emails, phones, urls, addresses, ssn and name fields", () => {
    const payload = {
      client_response:
        "Email test@example.com phone 617-555-1212 site https://example.com address 12 Main St and SSN 123-45-6789",
      full_name: "John Smith",
      nested: {
        first_name: "Jane",
        note: "Contact at foo@bar.com or 415-555-9999",
      },
      list: ["Visit http://foo.com", "Phone (212) 555-1212"],
    };

    const { sanitizedPayload, redactionStats } = service.redact(payload);

    expect(sanitizedPayload).toEqual({
      client_response:
        "Email [REDACTED_EMAIL] phone [REDACTED_PHONE] site [REDACTED_URL] address [REDACTED_ADDRESS] and SSN [REDACTED_SSN]",
      full_name: "[REDACTED_NAME]",
      nested: {
        first_name: "[REDACTED_NAME]",
        note: "Contact at [REDACTED_EMAIL] or [REDACTED_PHONE]",
      },
      list: ["Visit [REDACTED_URL]", "Phone [REDACTED_PHONE]"],
    });

    expect(redactionStats.emails).toBe(2);
    expect(redactionStats.phones).toBe(3);
    expect(redactionStats.urls).toBe(2);
    expect(redactionStats.addresses).toBe(1);
    expect(redactionStats.ssn).toBe(1);
    expect(redactionStats.names).toBe(2);
  });
});
