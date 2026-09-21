import "dotenv/config";
import { describe, expect, it } from "vitest";
import { analyzeSource, getDemoGraphForTests, getGraph, simulateChange } from "./analysis";

const fixture = [
  { path: "src/db.ts", content: "export function writeOrder() { return 1; }" },
  { path: "src/service.ts", content: "import { writeOrder } from './db';\nexport function createOrder() { return writeOrder(); }" },
  { path: "src/api.ts", content: "import { createOrder } from './service';\nexport function checkout() { return createOrder(); }" },
  { path: "src/api.test.ts", content: "import { checkout } from './api';\ntest('checkout', () => checkout());" },
];

describe("blast-radius graph analysis", () => {
  it("keeps a demo graph available as the no-credentials fallback", () => {
    const graph = getDemoGraphForTests();
    expect(graph.source).toBe("demo");
    expect(graph.stats.functions).toBeGreaterThan(0);
  });

  it("parses, persists, reads, and simulates a real Neo4j graph", async () => {
    const analyzed = await analyzeSource({ slug: "fixture-repository", files: fixture });
    expect(analyzed.graph.source).toBe("neo4j");
    expect(analyzed.graph.stats.functions).toBeGreaterThanOrEqual(3);
    expect(analyzed.graph.stats.calls).toBeGreaterThanOrEqual(2);
    expect((await getGraph(analyzed.projectId)).nodes.length).toBeGreaterThanOrEqual(3);

    const selected = analyzed.graph.nodes.find((node) => node.name === "createOrder");
    expect(selected).toBeTruthy();
    const impact = await simulateChange(analyzed.projectId, selected?.id ?? "", "change_parameters");
    expect(impact.deterministicSummary).toContain("change parameters");
    expect(impact.directCallers.some((node) => node.name === "checkout")).toBe(true);
    expect(impact.directCallees.some((node) => node.name === "writeOrder")).toBe(true);
    expect(impact.affectedFunctions.some((node) => node.name === "checkout")).toBe(true);
    expect(impact.impactPaths.length).toBeGreaterThan(0);
    expect(impact.before.links.length).toBeGreaterThan(0);
    expect(impact.after.note).toContain("Affected");
    expect(impact.riskFactors.fanIn).toBeGreaterThan(0);
    expect(impact.riskFactors.fanOut).toBeGreaterThan(0);
    expect(impact.totals.files).toBeGreaterThan(0);
  }, 120_000);
});
