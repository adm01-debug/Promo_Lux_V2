import { describe, expect, it } from "vitest";
import { signTrackingParams, verifyTrackingParams } from "../tracking-signature";

const SECRET = "test-secret";
const RECIPIENT = "11111111-1111-1111-1111-111111111111";

describe("tracking-signature", () => {
  it("round-trips a click URL", async () => {
    const url = "https://empresa.com/promo";
    const sig = await signTrackingParams(RECIPIENT, url, SECRET);
    expect(await verifyTrackingParams(RECIPIENT, url, sig, SECRET)).toBe(true);
  });

  it("round-trips an open pixel (null url)", async () => {
    const sig = await signTrackingParams(RECIPIENT, null, SECRET);
    expect(await verifyTrackingParams(RECIPIENT, null, sig, SECRET)).toBe(true);
  });

  it("rejects a tampered url", async () => {
    const sig = await signTrackingParams(RECIPIENT, "https://empresa.com/promo", SECRET);
    expect(await verifyTrackingParams(RECIPIENT, "https://evil.example/phish", sig, SECRET)).toBe(false);
  });

  it("rejects a signature minted for a different recipient", async () => {
    const url = "https://empresa.com/promo";
    const sig = await signTrackingParams(RECIPIENT, url, SECRET);
    expect(await verifyTrackingParams("22222222-2222-2222-2222-222222222222", url, sig, SECRET)).toBe(false);
  });

  it("rejects a signature minted with a different secret", async () => {
    const url = "https://empresa.com/promo";
    const sig = await signTrackingParams(RECIPIENT, url, SECRET);
    expect(await verifyTrackingParams(RECIPIENT, url, sig, "other-secret")).toBe(false);
  });

  it("rejects a missing signature", async () => {
    expect(await verifyTrackingParams(RECIPIENT, "https://empresa.com", null, SECRET)).toBe(false);
  });

  it("rejects an empty-string signature", async () => {
    expect(await verifyTrackingParams(RECIPIENT, "https://empresa.com", "", SECRET)).toBe(false);
  });

  it("distinguishes a click signature from an open signature for the same recipient", async () => {
    const openSig = await signTrackingParams(RECIPIENT, null, SECRET);
    expect(await verifyTrackingParams(RECIPIENT, "https://empresa.com", openSig, SECRET)).toBe(false);
  });
});
