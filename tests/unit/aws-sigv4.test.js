import { describe, expect, it } from "vitest";

import { escapeUri, signAwsRequest } from "../../open-sse/utils/awsSigv4.js";

/**
 * The two pinned signatures below were cross-verified byte-for-byte against the `aws4`
 * reference implementation, not copied from documentation. Re-derive them any time with
 * `node tasks/test-commands/verify-sigv4-against-aws4.mjs` (installs aws4 with --no-save).
 * We pin the values rather than depending on aws4 so the suite stays dependency-free.
 */
const SIGNING_DATE = new Date("2015-08-30T12:36:00Z");
const CREDENTIALS = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

const IAM_BODY = "Action=ListUsers&Version=2010-05-08";
const IAM_REQUEST = {
  method: "POST",
  url: "https://iam.amazonaws.com/",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(IAM_BODY)),
  },
  body: IAM_BODY,
  region: "us-east-1",
  service: "iam",
  credentials: CREDENTIALS,
  date: SIGNING_DATE,
};

// A real Bedrock model id: the ":0" version suffix is what makes path encoding matter.
const BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-20250514-v1:0";
const BEDROCK_BODY = JSON.stringify({
  anthropic_version: "bedrock-2023-05-31",
  messages: [],
});
const BEDROCK_REQUEST = {
  method: "POST",
  url:
    "https://bedrock-runtime.us-east-1.amazonaws.com/model/" +
    `${encodeURIComponent(BEDROCK_MODEL_ID)}/invoke-with-response-stream`,
  headers: { "Content-Type": "application/json" },
  body: BEDROCK_BODY,
  region: "us-east-1",
  service: "bedrock",
  credentials: CREDENTIALS,
  date: SIGNING_DATE,
};

describe("AWS SigV4 signing", () => {
  it("matches the aws4 reference for a plain signed request", () => {
    expect(signAwsRequest(IAM_REQUEST).Authorization).toBe(
      "AWS4-HMAC-SHA256 " +
        "Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
        "SignedHeaders=content-length;content-type;host;x-amz-date, " +
        "Signature=afcae41d2eaf39c1b479fff3b5ae64d6806f975e7b6efb60038301a42c8dcb14",
    );
  });

  it("matches the aws4 reference for a Bedrock path holding a versioned model id", () => {
    expect(signAwsRequest(BEDROCK_REQUEST).Authorization).toBe(
      "AWS4-HMAC-SHA256 " +
        "Credential=AKIDEXAMPLE/20150830/us-east-1/bedrock/aws4_request, " +
        "SignedHeaders=content-type;host;x-amz-date, " +
        "Signature=53d28679a943780f541a376e6ae08bb2b10379169a756a881a166d63132c94ab",
    );
  });

  it("sets the x-amz-date header in AWS's compact form", () => {
    expect(signAwsRequest(IAM_REQUEST)["x-amz-date"]).toBe("20150830T123600Z");
  });

  it("signs the session token so STS and SSO credentials are accepted", () => {
    const headers = signAwsRequest({
      ...BEDROCK_REQUEST,
      credentials: { ...CREDENTIALS, sessionToken: "FwoGZXIvYXdzEExample" },
    });

    // Omitting the token from SignedHeaders is the classic cause of SignatureDoesNotMatch
    // on temporary credentials, so pin that it is both sent and signed.
    expect(headers["x-amz-security-token"]).toBe("FwoGZXIvYXdzEExample");
    expect(headers.Authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-date;x-amz-security-token",
    );
  });

  it("escapes characters that encodeURIComponent leaves alone", () => {
    // Dots and dashes must survive unescaped; the colon must not.
    expect(escapeUri(BEDROCK_MODEL_ID)).toBe(
      "us.anthropic.claude-sonnet-4-20250514-v1%3A0",
    );
    expect(escapeUri("a!b'c(d)e*f")).toBe("a%21b%27c%28d%29e%2Af");
  });

  it("double-encodes the path, which Bedrock requires and S3 does not", () => {
    const doubled = signAwsRequest(BEDROCK_REQUEST).Authorization;
    const single = signAwsRequest({
      ...BEDROCK_REQUEST,
      doubleEncodePath: false,
    }).Authorization;

    // Both are valid SigV4; they must differ, or the doubleEncodePath switch is dead code
    // and every Bedrock request with a versioned model id would fail to authenticate.
    expect(doubled).not.toBe(single);
  });

  it("refuses to sign without both key parts rather than emitting a bad signature", () => {
    expect(() =>
      signAwsRequest({ ...IAM_REQUEST, credentials: { accessKeyId: "AKIA" } }),
    ).toThrow(/accessKeyId and secretAccessKey/);
  });
});

describe("AWS SigV4 query-string contract", () => {
  it("matches the official AWS SigV4 GET query test vector regardless of parameter order", () => {
    const expected =
      "AWS4-HMAC-SHA256 " +
      "Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
      "SignedHeaders=content-type;host;x-amz-date, " +
      "Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7";

    const inOrder = signAwsRequest({
      method: "GET",
      url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      region: "us-east-1",
      service: "iam",
      credentials: CREDENTIALS,
      date: SIGNING_DATE,
    });
    const reversed = signAwsRequest({
      method: "GET",
      url: "https://iam.amazonaws.com/?Version=2010-05-08&Action=ListUsers",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      region: "us-east-1",
      service: "iam",
      credentials: CREDENTIALS,
      date: SIGNING_DATE,
    });

    expect(inOrder.Authorization).toBe(expected);
    expect(reversed.Authorization).toBe(expected);
  });

  it("canonicalizes spaces as %20 rather than + when signing query strings", () => {
    const withPercent20 = signAwsRequest({
      ...BEDROCK_REQUEST,
      url: `${BEDROCK_REQUEST.url}?b=2&a=a%20b`,
    });
    const withPlus = signAwsRequest({
      ...BEDROCK_REQUEST,
      url: `${BEDROCK_REQUEST.url}?a=a+b&b=2`,
    });

    expect(withPercent20.Authorization).toBe(withPlus.Authorization);
  });
});
