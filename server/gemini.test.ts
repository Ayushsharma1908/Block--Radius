import "dotenv/config";
import { describe, expect, it } from "vitest";

describe("Gemini configuration", () => {
  it("accepts the configured API key for the models endpoint", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be configured").toBeTruthy();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key ?? "")}`);
    expect(response.ok).toBe(true);
  }, 20_000);
});
