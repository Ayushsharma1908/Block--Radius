import "dotenv/config";
import neo4j from "neo4j-driver";
import { describe, expect, it } from "vitest";

describe("Neo4j AuraDB configuration", () => {
  it("connects and can execute a lightweight query", async () => {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    expect(uri, "NEO4J_URI must be configured").toBeTruthy();
    expect(user, "NEO4J_USER must be configured").toBeTruthy();
    expect(password, "NEO4J_PASSWORD must be configured").toBeTruthy();

    const driver = neo4j.driver(
      uri ?? "",
      neo4j.auth.basic(user ?? "", password ?? "")
    );

    try {
      const result = await driver.executeQuery("RETURN 1 AS ok");

      expect(result.records.length).toBe(1);
      expect(result.records[0]?.get("ok")).toEqual(neo4j.int(1));
    } finally {
      await driver.close();
    }
  }, 20_000);
});