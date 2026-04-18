import { describe, expect, it } from "vitest";

import { loadPolicyDocuments } from "../server/lib/store.js";

describe("policy document loading", () => {
  it("falls back to repo-seeded policy snippets when Firestore is unavailable", async () => {
    const result = await loadPolicyDocuments({ db: null });

    expect(result.source).toBe("seed");
    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.documents[0]?.sourceUrl).toMatch(/^https?:\/\//);
  });

  it("prefers Firestore policy snippets when present", async () => {
    const fakeDb = {
      collection: () => ({
        get: async () => ({
          docs: [
            {
              id: "firestore-policy",
              data: () => ({
                title: "Firestore Policy",
                source: "Firestore",
                sourceUrl: "https://example.com/policy",
                jurisdiction: "Malaysia",
                summary: "Firestore-backed policy summary.",
                excerpt: "Firestore-backed policy excerpt.",
                topics: ["scam_verification"],
                keywords: ["verify"],
              }),
            },
          ],
        }),
      }),
    };

    const result = await loadPolicyDocuments({ db: fakeDb as never });

    expect(result.source).toBe("firestore");
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.title).toBe("Firestore Policy");
  });
});
