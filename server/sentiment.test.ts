import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const caller = () => appRouter.createCaller(createContext());

describe("sentiment.analyzeOne", () => {
  it("returns a positive label and compound score for positive prose", async () => {
    const result = await caller().sentiment.analyzeOne({ review: "A beautiful, joyful, wonderfully made film." });
    expect(result.predicted).toBe("positive");
    expect(result.compound).toBeGreaterThan(0.05);
  }, 30000);

  it("returns a negative label for clearly negative prose", async () => {
    const result = await caller().sentiment.analyzeOne({ review: "A terrible, boring, disappointing waste of time." });
    expect(result.predicted).toBe("negative");
    expect(result.compound).toBeLessThan(-0.05);
  }, 30000);

  it("returns neutral for text without a strong sentiment signal", async () => {
    const result = await caller().sentiment.analyzeOne({ review: "The film is about a person who visits a town." });
    expect(result.predicted).toBe("neutral");
    expect(result.compound).toBeGreaterThan(-0.05);
    expect(result.compound).toBeLessThan(0.05);
  }, 30000);
});

describe("sentiment.history", () => {
  it("lists the caller's persistent analysis archive safely", async () => {
    const result = await caller().sentiment.listHistory();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("sentiment.analyzeCsv", () => {
  it("rejects CSV files without the required columns", async () => {
    await expect(caller().sentiment.analyzeCsv({ csv: "title,rating\nA film,5\n" })).rejects.toThrow("review and sentiment columns");
  });

  it("returns rows, metrics, and a three-label matrix", async () => {
    const csv = "review,sentiment\nA wonderful film,positive\nA terrible film,negative\nA film about a town,negative\n";
    const result = await caller().sentiment.analyzeCsv({ csv });
    expect(result.metrics.total).toBe(3);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toHaveProperty("compound");
    expect(result.metrics.predictedCounts).toHaveProperty("neutral");
    expect(result.matrix).toHaveProperty("positive");
    const saved = await caller().sentiment.listHistory();
    expect(saved.length).toBeGreaterThan(0);
    const detail = await caller().sentiment.getHistory({ id: saved[0].id });
    expect(detail?.totalReviews).toBeGreaterThan(0);
    expect(detail?.matrixJson).toContain("positive");
  }, 30000);
});
