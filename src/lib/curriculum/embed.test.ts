import { describe, expect, it } from "vitest";
import { headersAllowFraming } from "./embed";

const SELF = "https://school.example.com";
const h = (init: Record<string, string>) => new Headers(init);

describe("deciding whether a lesson page can be framed", () => {
  it("allows it when the site says nothing", () => {
    expect(headersAllowFraming(h({}), SELF)).toBe(true);
  });

  it("refuses DENY and SAMEORIGIN", () => {
    expect(headersAllowFraming(h({ "x-frame-options": "DENY" }), SELF)).toBe(false);
    expect(headersAllowFraming(h({ "x-frame-options": "SAMEORIGIN" }), SELF)).toBe(false);
    expect(headersAllowFraming(h({ "x-frame-options": "sameorigin" }), SELF)).toBe(false);
  });

  it("refuses frame-ancestors 'none' and 'self'", () => {
    expect(headersAllowFraming(h({ "content-security-policy": "frame-ancestors 'none'" }), SELF)).toBe(false);
    expect(headersAllowFraming(h({ "content-security-policy": "frame-ancestors 'self'" }), SELF)).toBe(false);
  });

  it("allows a wildcard", () => {
    expect(headersAllowFraming(h({ "content-security-policy": "frame-ancestors *" }), SELF)).toBe(true);
  });

  it("allows us when we are named", () => {
    expect(
      headersAllowFraming(
        h({ "content-security-policy": "default-src 'self'; frame-ancestors 'self' https://school.example.com" }),
        SELF,
      ),
    ).toBe(true);
  });

  it("refuses when someone else is named but we are not", () => {
    expect(
      headersAllowFraming(h({ "content-security-policy": "frame-ancestors https://someone-else.org" }), SELF),
    ).toBe(false);
  });

  it("reads frame-ancestors out of a policy with other directives around it", () => {
    expect(
      headersAllowFraming(
        h({ "content-security-policy": "script-src 'self'; frame-ancestors 'none'; img-src *" }),
        SELF,
      ),
    ).toBe(false);
  });
});
