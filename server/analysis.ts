import { randomUUID } from "node:crypto";
import neo4j, { type Driver, type Node as Neo4jNode, type Record as Neo4jRecord } from "neo4j-driver";
import { Node, Project, SyntaxKind, ts, type CallExpression, type SourceFile as TsSourceFile } from "ts-morph";

type GraphLabel = "Repository" | "File" | "Class" | "Function" | "API" | "Database" | "Test";
export type ChangeType = "modify_implementation" | "change_parameters" | "change_return_type" | "rename" | "remove";
export type SourceFile = { path: string; content: string };
export type FunctionNode = { id: string; name: string; file: string; line: number; kind: string; label?: string };
export type GraphLink = { from: string; to: string; kind?: string; state?: "existing" | "affected" | "removed" };
export type ProjectGraph = {
  slug: string;
  source: "neo4j" | "demo";
  stats: { files: number; functions: number; imports: number; calls: number; classes: number; apis: number; databases: number; tests: number };
  nodes: FunctionNode[];
  links: GraphLink[];
};

export type ImpactPath = { id: string; nodeIds: string[]; nodes: FunctionNode[]; relations: string[]; label: string };
export type RiskFactors = { affectedFunctions: number; affectedFiles: number; dependencyDepth: number; fanIn: number; fanOut: number; apiExposure: number; databaseUsage: number; testRelationships: number; testCoverageRatio: number };
export type ImpactSnapshot = { nodes: FunctionNode[]; links: GraphLink[]; note: string };
export type ImpactResult = {
  selectedId: string;
  selected: FunctionNode | null;
  changeType: ChangeType;
  directCallers: FunctionNode[];
  directCallees: FunctionNode[];
  directImpactIds: string[];
  transitiveImpactIds: string[];
  affectedIds: string[];
  affectedFunctions: FunctionNode[];
  affectedFiles: FunctionNode[];
  affectedClasses: FunctionNode[];
  affectedApis: FunctionNode[];
  affectedDatabases: FunctionNode[];
  affectedTests: FunctionNode[];
  impactPaths: ImpactPath[];
  riskFactors: RiskFactors;
  before: ImpactSnapshot;
  after: ImpactSnapshot;
  noTestsDetected: boolean;
  totals: { functions: number; files: number; classes: number; apis: number; databases: number; tests: number };
  deterministicSummary: string;
};

const CODE_EXT = /\.(tsx?|jsx?|mts|cts|mjs|cjs)$/i;
const SKIP_PATH = /(^|\/)(node_modules|dist|build|out|\.next|coverage|vendor)(\/|$)/;
const TEST_PATH = /(^|\/)(__tests__|tests?)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i;
const RELATION_TYPES = ["CONTAINS", "DEFINES", "CALLS", "IMPORTS", "EXPOSES", "USES", "TESTED_BY"] as const;
const LABELS: GraphLabel[] = ["File", "Class", "Function", "API", "Database", "Test"];

let driverPromise: Promise<Driver | null> | null = null;

function hasNeo4jCredentials() {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD);
}

async function getDriver(): Promise<Driver | null> {
  if (!hasNeo4jCredentials()) return null;
  if (!driverPromise) {
    driverPromise = Promise.resolve(neo4j.driver(
      process.env.NEO4J_URI as string,
      neo4j.auth.basic(process.env.NEO4J_USER as string, process.env.NEO4J_PASSWORD as string),
      { maxConnectionPoolSize: 20, connectionAcquisitionTimeout: 15_000 },
    ));
  }
  return driverPromise;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRepo(repo: string) {
  const cleaned = repo.trim().replace(/^https?:\/\//, "").replace(/^github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const [owner, name] = cleaned.split("/");
  if (!owner || !name) throw new Error("Use a public GitHub URL or owner/repo reference.");
  return { owner, name };
}

async function loadGithubFiles(repo: string): Promise<SourceFile[]> {
  const { owner, name } = normalizeRepo(repo);
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "blast-radius-gemini" };
  const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees/HEAD?recursive=1`, { headers });
  if (!treeResponse.ok) throw new Error(`GitHub could not load ${owner}/${name} (${treeResponse.status}).`);
  const tree = (await treeResponse.json()) as { tree?: Array<{ path: string; type: string }> };
  const paths = (tree.tree ?? []).filter((item) => item.type === "blob" && CODE_EXT.test(item.path) && !SKIP_PATH.test(item.path) && !item.path.endsWith(".d.ts")).slice(0, 160);
  const files = await Promise.all(paths.map(async ({ path }) => {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/HEAD/${path}`, { headers: { "User-Agent": headers["User-Agent"] } });
    return response.ok ? { path, content: await response.text() } : null;
  }));
  return files.filter((file): file is SourceFile => Boolean(file));
}

function relativePath(filePath: string) {
  return filePath.replace(/^\/+/, "");
}

function lineAt(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function resolveInMemoryFile(from: string, imported: string, files: Set<string>) {
  if (!imported.startsWith(".")) return undefined;
  const baseParts = from.split("/");
  baseParts.pop();
  const raw = [...baseParts, imported].join("/").split("/");
  const clean: string[] = [];
  for (const part of raw) {
    if (part === "..") clean.pop();
    else if (part !== ".") clean.push(part);
  }
  const base = clean.join("/");
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => files.has(candidate));
}

function fileId(projectId: string, path: string) { return `${projectId}:file:${path}`; }
function classId(projectId: string, path: string, name: string, line: number) { return `${projectId}:class:${path}:${name}:${line}`; }
function functionId(projectId: string, path: string, name: string, line: number) { return `${projectId}:function:${path}:${name}:${line}`; }
function apiId(projectId: string, path: string, method: string, route: string, line: number) { return `${projectId}:api:${path}:${method}:${route}:${line}`; }
function databaseId(projectId: string, path: string, operation: string, line: number) { return `${projectId}:database:${path}:${operation}:${line}`; }
function testId(projectId: string, path: string) { return `${projectId}:test:${path}`; }

function emptyGraph(source: "neo4j" | "demo", slug = "") : ProjectGraph {
  return { slug, source, stats: { files: 0, functions: 0, imports: 0, calls: 0, classes: 0, apis: 0, databases: 0, tests: 0 }, nodes: [], links: [] };
}

const demoGraph: ProjectGraph = {
  source: "demo",
  slug: "checkout-service",
  stats: { files: 8, functions: 19, imports: 17, calls: 31, classes: 0, apis: 0, databases: 0, tests: 0 },
  nodes: [
    { id: "routes/checkout.ts#handleCheckout", name: "handleCheckout", file: "routes/checkout.ts", line: 18, kind: "route", label: "Function" },
    { id: "services/orders.ts#createOrder", name: "createOrder", file: "services/orders.ts", line: 24, kind: "function", label: "Function" },
    { id: "services/payments.ts#chargeCard", name: "chargeCard", file: "services/payments.ts", line: 12, kind: "function", label: "Function" },
    { id: "services/risk.ts#scoreTransaction", name: "scoreTransaction", file: "services/risk.ts", line: 7, kind: "function", label: "Function" },
    { id: "db/orders.ts#insertOrder", name: "insertOrder", file: "db/orders.ts", line: 14, kind: "function", label: "Function" },
    { id: "db/users.ts#getUser", name: "getUser", file: "db/users.ts", line: 8, kind: "function", label: "Function" },
    { id: "lib/telemetry.ts#trackEvent", name: "trackEvent", file: "lib/telemetry.ts", line: 5, kind: "function", label: "Function" },
    { id: "emails/receipt.ts#sendReceipt", name: "sendReceipt", file: "emails/receipt.ts", line: 19, kind: "function", label: "Function" },
    { id: "routes/webhooks.ts#paymentWebhook", name: "paymentWebhook", file: "routes/webhooks.ts", line: 11, kind: "route", label: "Function" },
    { id: "services/refunds.ts#refundPayment", name: "refundPayment", file: "services/refunds.ts", line: 13, kind: "function", label: "Function" },
    { id: "jobs/reconcile.ts#reconcilePayments", name: "reconcilePayments", file: "jobs/reconcile.ts", line: 4, kind: "job", label: "Function" },
    { id: "lib/currency.ts#toMinorUnits", name: "toMinorUnits", file: "lib/currency.ts", line: 3, kind: "utility", label: "Function" },
    { id: "services/cart.ts#loadCart", name: "loadCart", file: "services/cart.ts", line: 8, kind: "function", label: "Function" },
    { id: "services/discounts.ts#applyDiscount", name: "applyDiscount", file: "services/discounts.ts", line: 16, kind: "function", label: "Function" },
    { id: "routes/cart.ts#getCart", name: "getCart", file: "routes/cart.ts", line: 10, kind: "route", label: "Function" },
    { id: "ui/checkout.ts#submitOrder", name: "submitOrder", file: "ui/checkout.ts", line: 42, kind: "handler", label: "Function" },
    { id: "ui/checkout.ts#showConfirmation", name: "showConfirmation", file: "ui/checkout.ts", line: 65, kind: "handler", label: "Function" },
    { id: "lib/logger.ts#log", name: "log", file: "lib/logger.ts", line: 2, kind: "utility", label: "Function" },
    { id: "lib/featureFlags.ts#isEnabled", name: "isEnabled", file: "lib/featureFlags.ts", line: 5, kind: "utility", label: "Function" },
  ],
  links: [
    ["routes/checkout.ts#handleCheckout", "services/cart.ts#loadCart"], ["routes/checkout.ts#handleCheckout", "services/orders.ts#createOrder"], ["routes/checkout.ts#handleCheckout", "services/payments.ts#chargeCard"], ["routes/checkout.ts#handleCheckout", "lib/telemetry.ts#trackEvent"], ["services/orders.ts#createOrder", "db/orders.ts#insertOrder"], ["services/orders.ts#createOrder", "db/users.ts#getUser"], ["services/orders.ts#createOrder", "lib/featureFlags.ts#isEnabled"], ["services/payments.ts#chargeCard", "services/risk.ts#scoreTransaction"], ["services/payments.ts#chargeCard", "lib/currency.ts#toMinorUnits"], ["services/payments.ts#chargeCard", "lib/telemetry.ts#trackEvent"], ["services/payments.ts#chargeCard", "lib/logger.ts#log"], ["services/risk.ts#scoreTransaction", "db/users.ts#getUser"], ["db/orders.ts#insertOrder", "lib/logger.ts#log"], ["db/users.ts#getUser", "lib/logger.ts#log"], ["emails/receipt.ts#sendReceipt", "lib/telemetry.ts#trackEvent"], ["routes/webhooks.ts#paymentWebhook", "services/refunds.ts#refundPayment"], ["routes/webhooks.ts#paymentWebhook", "lib/logger.ts#log"], ["services/refunds.ts#refundPayment", "lib/currency.ts#toMinorUnits"], ["jobs/reconcile.ts#reconcilePayments", "services/refunds.ts#refundPayment"], ["jobs/reconcile.ts#reconcilePayments", "lib/telemetry.ts#trackEvent"], ["services/cart.ts#loadCart", "db/users.ts#getUser"], ["services/cart.ts#loadCart", "services/discounts.ts#applyDiscount"], ["services/discounts.ts#applyDiscount", "lib/featureFlags.ts#isEnabled"], ["routes/cart.ts#getCart", "services/cart.ts#loadCart"], ["ui/checkout.ts#submitOrder", "routes/checkout.ts#handleCheckout"], ["ui/checkout.ts#submitOrder", "ui/checkout.ts#showConfirmation"], ["ui/checkout.ts#showConfirmation", "lib/telemetry.ts#trackEvent"], ["routes/checkout.ts#handleCheckout", "lib/featureFlags.ts#isEnabled"], ["services/orders.ts#createOrder", "lib/logger.ts#log"], ["services/risk.ts#scoreTransaction", "lib/featureFlags.ts#isEnabled"], ["services/refunds.ts#refundPayment", "lib/logger.ts#log"],
  ].map(([from, to]) => ({ from, to, kind: "CALLS" })),
};

function ensureGraphNode(nodes: Map<string, { label: GraphLabel; id: string; props: Record<string, unknown> }>, label: GraphLabel, id: string, props: Record<string, unknown>) {
  if (!nodes.has(id)) nodes.set(id, { label, id, props });
}

function isTestPath(path: string, sourceFile: TsSourceFile) {
  return TEST_PATH.test(path) || sourceFile.getImportDeclarations().some((imp) => /^(vitest|jest|mocha|@testing-library)/.test(imp.getModuleSpecifierValue()));
}

function isDatabaseCall(text: string) {
  return /(prisma|drizzle|knex|sequelize|mongoose|typeorm|pool|client|database|db|repository|repo)\b|\.(query|execute|findOne|findMany|insert|update|delete|save|create)\s*\(/i.test(text);
}

function apiCallDetails(call: CallExpression) {
  const expression = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
  if (!expression) return null;
  const method = expression.getName().toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "USE"].includes(method)) return null;
  const routeArg = call.getArguments()[0];
  if (!routeArg || !Node.isStringLiteral(routeArg)) return null;
  return { method, route: routeArg.getLiteralValue() };
}

function buildGraph(projectId: string, slug: string, inputs: SourceFile[]) {
  const compilerOptions: ts.CompilerOptions = { allowJs: true, jsx: ts.JsxEmit.Preserve, moduleResolution: ts.ModuleResolutionKind.Node10, target: ts.ScriptTarget.ES2020 };
  const configEntry = inputs.filter((file) => /(^|\/)(tsconfig|jsconfig)[^/]*\.json$/i.test(file.path)).sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  if (configEntry) {
    try {
      const parsed = ts.parseConfigFileTextToJson(`/${configEntry.path}`, configEntry.content);
      const config = parsed.config?.compilerOptions ?? {};
      compilerOptions.baseUrl = config.baseUrl ? `/${configEntry.path.split("/").slice(0, -1).join("/")}/${config.baseUrl}` : undefined;
      compilerOptions.paths = config.paths;
    } catch {
      // Keep plain Node resolution when a repository tsconfig is malformed.
    }
  }
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions });
  for (const file of inputs) if (CODE_EXT.test(file.path) && !file.path.endsWith(".d.ts")) project.createSourceFile(`/${file.path.replace(/^\/+/, "")}`, file.content, { overwrite: true });

  const nodes = new Map<string, { label: GraphLabel; id: string; props: Record<string, unknown> }>();
  const relations = new Map<string, { from: string; to: string }[]>();
  const functionInfos: Array<{ ast: Node; node: FunctionNode; source: TsSourceFile }> = [];
  const functionByAst = new Map<Node, FunctionNode>();
  const functionsByFile = new Map<string, FunctionNode[]>();
  const sourceFiles = project.getSourceFiles().filter((source) => !source.isDeclarationFile());
  const inputPaths = new Set(inputs.map((file) => file.path));
  const addRelation = (kind: string, from: string, to: string) => {
    const rows = relations.get(kind) ?? [];
    if (!rows.some((row) => row.from === from && row.to === to)) rows.push({ from, to });
    relations.set(kind, rows);
  };
  const addFunction = (ast: Node, name: string, source: TsSourceFile, kind: string, ownerId?: string) => {
    const file = relativePath(source.getFilePath());
    const line = ast.getStartLineNumber();
    const id = functionId(projectId, file, name, line);
    const node: FunctionNode = { id, name, file, line, kind, label: "Function" };
    ensureGraphNode(nodes, "Function", id, { ...node });
    functionInfos.push({ ast, node, source });
    functionByAst.set(ast, node);
    functionsByFile.set(file, [...(functionsByFile.get(file) ?? []), node]);
    addRelation("DEFINES", ownerId ?? fileId(projectId, file), id);
    return node;
  };

  for (const source of sourceFiles) {
    const file = relativePath(source.getFilePath());
    const fileNodeId = fileId(projectId, file);
    ensureGraphNode(nodes, "File", fileNodeId, { id: fileNodeId, name: file, path: file, file, line: 1, kind: "file", label: "File" });
    for (const imp of source.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile();
      const targetPath = target && inputPaths.has(relativePath(target.getFilePath())) ? relativePath(target.getFilePath()) : resolveInMemoryFile(file, imp.getModuleSpecifierValue(), inputPaths);
      if (targetPath) addRelation("IMPORTS", fileNodeId, fileId(projectId, targetPath));
    }
    for (const exported of source.getExportDeclarations()) {
      const target = exported.getModuleSpecifierSourceFile();
      const targetPath = target && inputPaths.has(relativePath(target.getFilePath())) ? relativePath(target.getFilePath()) : (exported.getModuleSpecifierValue() ? resolveInMemoryFile(file, exported.getModuleSpecifierValue() as string, inputPaths) : undefined);
      if (targetPath) addRelation("IMPORTS", fileNodeId, fileId(projectId, targetPath));
    }
    for (const classDeclaration of source.getClasses()) {
      const className = classDeclaration.getName() ?? `AnonymousClass_${classDeclaration.getStartLineNumber()}`;
      const id = classId(projectId, file, className, classDeclaration.getStartLineNumber());
      ensureGraphNode(nodes, "Class", id, { id, name: className, file, line: classDeclaration.getStartLineNumber(), kind: "class", label: "Class" });
      addRelation("CONTAINS", fileNodeId, id);
      for (const method of classDeclaration.getMethods()) addFunction(method, method.getName(), source, "method", id);
      for (const ctor of classDeclaration.getConstructors()) addFunction(ctor, "constructor", source, "method", id);
    }
    for (const fn of source.getFunctions()) if (fn.getName()) addFunction(fn, fn.getName() as string, source, "function");
    for (const variable of source.getVariableDeclarations()) {
      const initializer = variable.getInitializer();
      if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) addFunction(variable, variable.getName(), source, "function");
    }
    if (isTestPath(file, source)) {
      const id = testId(projectId, file);
      ensureGraphNode(nodes, "Test", id, { id, name: file.split("/").pop(), file, path: file, line: 1, kind: "test", label: "Test" });
      addRelation("CONTAINS", fileNodeId, id);
      for (const imp of source.getImportDeclarations()) {
        const target = imp.getModuleSpecifierSourceFile();
        const targetPath = target ? relativePath(target.getFilePath()) : resolveInMemoryFile(file, imp.getModuleSpecifierValue(), inputPaths);
        if (targetPath) for (const targetFn of functionsByFile.get(targetPath) ?? []) addRelation("TESTED_BY", targetFn.id, id);
      }
    }
  }

  const findEnclosingFunction = (call: CallExpression) => functionInfos.filter((info) => info.source === call.getSourceFile() && info.ast.getStart() <= call.getStart() && info.ast.getEnd() >= call.getEnd()).sort((a, b) => b.ast.getStart() - a.ast.getStart())[0];
  const findFunctionFromExpression = (expression: Node | undefined) => {
    if (!expression) return undefined;
    const symbol = expression.getSymbol();
    if (!symbol) return undefined;
    const symbols = [symbol, symbol.getAliasedSymbol()].filter(Boolean);
    for (const candidate of symbols) for (const declaration of candidate?.getDeclarations() ?? []) {
      const match = functionByAst.get(declaration);
      if (match) return match;
    }
    return undefined;
  };

  for (const source of sourceFiles) {
    const file = relativePath(source.getFilePath());
    const fileNodeId = fileId(projectId, file);
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const owner = findEnclosingFunction(call);
      const expressionSymbol = call.getExpression().getSymbol();
      const symbols = [expressionSymbol, expressionSymbol?.getAliasedSymbol()].filter(Boolean);
      for (const symbol of symbols) for (const declaration of symbol?.getDeclarations() ?? []) {
        const target = functionByAst.get(declaration);
        if (target && owner && target.id !== owner.node.id) addRelation("CALLS", owner.node.id, target.id);
      }
      const api = apiCallDetails(call);
      if (api) {
        const apiIdValue = apiId(projectId, file, api.method, api.route, call.getStartLineNumber());
        ensureGraphNode(nodes, "API", apiIdValue, { id: apiIdValue, name: `${api.method} ${api.route}`, file, line: call.getStartLineNumber(), kind: "api", label: "API", method: api.method, route: api.route });
        const handler = findFunctionFromExpression(call.getArguments()[1]) ?? owner?.node;
        if (handler) addRelation("EXPOSES", apiIdValue, handler.id);
        else addRelation("CONTAINS", fileNodeId, apiIdValue);
      }
      const callText = call.getText();
      if (isDatabaseCall(callText)) {
        const operation = callText.replace(/\s+/g, " ").slice(0, 120);
        const dbId = databaseId(projectId, file, operation, call.getStartLineNumber());
        ensureGraphNode(nodes, "Database", dbId, { id: dbId, name: operation, file, line: call.getStartLineNumber(), kind: "database", label: "Database", operation });
        addRelation("USES", owner?.node.id ?? fileNodeId, dbId);
      }
    }
  }

  const graphNodes = Array.from(nodes.values()).map((item) => ({ ...item.props, id: item.id, label: item.label })) as unknown as FunctionNode[];
  const links = Array.from(relations.entries()).flatMap(([kind, rows]) => rows.map((row) => ({ ...row, kind })));
  const nodeCount = (label: GraphLabel) => Array.from(nodes.values()).filter((node) => node.label === label).length;
  return {
    slug,
    source: "neo4j" as const,
    stats: { files: nodeCount("File"), functions: nodeCount("Function"), imports: relations.get("IMPORTS")?.length ?? 0, calls: relations.get("CALLS")?.length ?? 0, classes: nodeCount("Class"), apis: nodeCount("API"), databases: nodeCount("Database"), tests: nodeCount("Test") },
    nodes: graphNodes,
    links,
  } as ProjectGraph;
}

async function writeGraph(projectId: string, graph: ProjectGraph) {
  const driver = await getDriver();
  if (!driver) throw new Error("Neo4j AuraDB credentials are not configured.");
  const session = driver.session();
  try {
    await session.run("CREATE INDEX graph_project_id IF NOT EXISTS FOR (n:Function) ON (n.projectId, n.id)");
    await session.executeWrite(async (tx) => {
      await tx.run("MATCH (n { projectId: $projectId }) DETACH DELETE n", { projectId });
      await tx.run("MERGE (r:Repository { projectId: $projectId, id: $projectId }) SET r.name = $name, r.kind = 'repository', r.slug = $name", { projectId, name: graph.slug });
      const nodeRows = graph.nodes.map((node) => ({ id: node.id, props: { ...node, projectId } }));
      for (const label of LABELS) {
        const rows = nodeRows.filter((row) => row.props.label === label);
        if (!rows.length) continue;
        await tx.run(`UNWIND $rows AS row MERGE (n:${label} { projectId: $projectId, id: row.id }) SET n += row.props`, { projectId, rows });
      }
      await tx.run("UNWIND $ids AS id MATCH (r:Repository { projectId: $projectId }), (f:File { projectId: $projectId, id: id }) MERGE (r)-[:CONTAINS]->(f)", { projectId, ids: nodeRows.filter((row) => row.props.label === "File").map((row) => row.id) });
      for (const relationType of RELATION_TYPES) {
        const rows = graph.links.filter((link) => link.kind === relationType).map(({ from, to }) => ({ from, to }));
        if (!rows.length) continue;
        await tx.run(`UNWIND $rows AS row MATCH (a { projectId: $projectId, id: row.from }), (b { projectId: $projectId, id: row.to }) MERGE (a)-[:${relationType}]->(b)`, { projectId, rows });
      }
    });
  } finally {
    await session.close();
  }
}

function graphNodeFromNeo4j(node: Neo4jNode, labels: string[]): FunctionNode {
  const props = node.properties as Record<string, unknown>;
  const label = (labels.find((value) => LABELS.includes(value as GraphLabel)) ?? "Function") as GraphLabel;
  return { id: String(props.id), name: String(props.name ?? props.path ?? props.operation ?? props.id), file: String(props.file ?? props.path ?? ""), line: toNumber(props.line, 1), kind: String(props.kind ?? label.toLowerCase()), label };
}

async function readGraph(projectId: string): Promise<ProjectGraph> {
  const driver = await getDriver();
  if (!driver) return { ...demoGraph };
  const session = driver.session();
  try {
    const nodeResult = await session.run("MATCH (n { projectId: $projectId }) WHERE NOT n:Repository RETURN n, labels(n) AS labels", { projectId });
    const linkResult = await session.run(`MATCH (a { projectId: $projectId })-[r]->(b { projectId: $projectId }) WHERE type(r) IN $types RETURN a.id AS from, b.id AS to, type(r) AS kind`, { projectId, types: [...RELATION_TYPES] });
    const nodes = nodeResult.records.map((record: Neo4jRecord) => graphNodeFromNeo4j(record.get("n") as Neo4jNode, record.get("labels") as string[]));
    const links = linkResult.records.map((record) => ({ from: String(record.get("from")), to: String(record.get("to")), kind: String(record.get("kind")) }));
    const repoResult = await session.run("MATCH (r:Repository { projectId: $projectId }) RETURN r.slug AS slug", { projectId });
    const slug = repoResult.records[0]?.get("slug") ? String(repoResult.records[0].get("slug")) : "";
    const count = (label: string) => nodes.filter((node) => node.label === label).length;
    return { source: "neo4j", slug, nodes, links, stats: { files: count("File"), functions: count("Function"), imports: links.filter((link) => link.kind === "IMPORTS").length, calls: links.filter((link) => link.kind === "CALLS").length, classes: count("Class"), apis: count("API"), databases: count("Database"), tests: count("Test") } };
  } finally {
    await session.close();
  }
}

export function isNeo4jAvailable() { return hasNeo4jCredentials(); }

export async function analyzeSource({ repo, files, slug }: { repo?: string; files?: SourceFile[]; slug?: string }) {
  if (!hasNeo4jCredentials()) return { projectId: "demo-checkout-service", graph: { ...demoGraph } };
  const inputs = files?.length ? files : repo ? await loadGithubFiles(repo) : [];
  if (!inputs.length) throw new Error("No JavaScript or TypeScript files were found to analyze.");
  const projectId = randomUUID();
  const graph = buildGraph(projectId, slug ?? repo?.split("/").pop()?.replace(/\.git$/, "") ?? "uploaded-repo", inputs);
  await writeGraph(projectId, graph);
  return { projectId, graph: await readGraph(projectId) };
}

export async function getGraph(projectId: string) {
  if (!hasNeo4jCredentials()) return { ...demoGraph };
  return readGraph(projectId);
}

export async function seedDemo() {
  if (!hasNeo4jCredentials()) return { projectId: "demo-checkout-service", graph: { ...demoGraph } };
  return { projectId: "", graph: emptyGraph("neo4j") };
}

function changeTypeLabel(changeType: ChangeType) {
  return { modify_implementation: "modify implementation", change_parameters: "change parameters", change_return_type: "change return type", rename: "rename", remove: "remove" }[changeType];
}

function emptySnapshot(note: string): ImpactSnapshot { return { nodes: [], links: [], note }; }

function riskFor(result: Omit<ImpactResult, "deterministicSummary" | "riskFactors" | "before" | "after" | "impactPaths" | "noTestsDetected">, dependencyDepth: number): RiskFactors {
  return {
    affectedFunctions: result.affectedFunctions.length,
    affectedFiles: result.affectedFiles.length,
    dependencyDepth,
    fanIn: result.directCallers.length,
    fanOut: result.directCallees.length,
    apiExposure: result.affectedApis.length,
    databaseUsage: result.affectedDatabases.length,
    testRelationships: result.affectedTests.length,
    testCoverageRatio: result.affectedFunctions.length ? Number((result.affectedTests.length / result.affectedFunctions.length).toFixed(2)) : 0,
  };
}

function summaryFor(result: Omit<ImpactResult, "deterministicSummary">) {
  const label = changeTypeLabel(result.changeType);
  const selectedName = result.selected?.name ?? "the selected function";
  const factors = result.riskFactors;
  return `${label} on ${selectedName} reaches ${factors.affectedFunctions} upstream function${factors.affectedFunctions === 1 ? "" : "s"} across ${factors.affectedFiles} file${factors.affectedFiles === 1 ? "" : "s"}, with depth ${factors.dependencyDepth}, fan-in ${factors.fanIn}, fan-out ${factors.fanOut}, ${factors.apiExposure} API surface${factors.apiExposure === 1 ? "" : "s"}, ${factors.databaseUsage} database operation${factors.databaseUsage === 1 ? "" : "s"}, and ${factors.testRelationships} connected test${factors.testRelationships === 1 ? "" : "s"}.`;
}

function buildDemoImpact(selectedId: string, changeType: ChangeType): ImpactResult {
  const selected = demoGraph.nodes.find((node) => node.id === selectedId) ?? null;
  const callers = demoGraph.links.filter((link) => link.to === selectedId).map((link) => demoGraph.nodes.find((node) => node.id === link.from)).filter(Boolean) as FunctionNode[];
  const callees = demoGraph.links.filter((link) => link.from === selectedId).map((link) => demoGraph.nodes.find((node) => node.id === link.to)).filter(Boolean) as FunctionNode[];
  const reverse = new Map<string, string[]>();
  for (const link of demoGraph.links) reverse.set(link.to, [...(reverse.get(link.to) ?? []), link.from]);
  const all = new Set<string>();
  const queue = callers.map((node) => node.id);
  while (queue.length) { const current = queue.shift(); if (!current || all.has(current)) continue; all.add(current); queue.push(...(reverse.get(current) ?? [])); }
  const affectedFunctions = demoGraph.nodes.filter((node) => all.has(node.id));
  const base = { selectedId, selected, changeType, directCallers: callers, directCallees: callees, directImpactIds: callers.map((node) => node.id), transitiveImpactIds: affectedFunctions.filter((node) => !callers.some((caller) => caller.id === node.id)).map((node) => node.id), affectedIds: affectedFunctions.map((node) => node.id), affectedFunctions, affectedFiles: [], affectedClasses: [], affectedApis: [], affectedDatabases: [], affectedTests: [], impactPaths: [], totals: { functions: affectedFunctions.length, files: 0, classes: 0, apis: 0, databases: 0, tests: 0 } };
  const riskFactors = riskFor(base, affectedFunctions.length ? 1 : 0);
  const result = { ...base, riskFactors, before: emptySnapshot("Demo fallback has no persisted snapshot."), after: emptySnapshot("Demo fallback has no persisted snapshot."), noTestsDetected: true };
  return { ...result, deterministicSummary: summaryFor(result) };
}

function neoNodeList(record: Neo4jRecord | undefined, key: string, label: GraphLabel) {
  return ((record?.get(key) as Neo4jNode[] | undefined) ?? []).filter(Boolean).map((node) => graphNodeFromNeo4j(node, [label]));
}

async function snapshotFor(session: ReturnType<Driver["session"]>, projectId: string, ids: string[], note: string, changeType: ChangeType, selectedId: string) {
  const uniqueIds = [...new Set(ids)];
  const result = await session.run(`MATCH (n { projectId: $projectId }) WHERE n.id IN $ids OPTIONAL MATCH (n)-[r]->(m { projectId: $projectId }) WHERE m.id IN $ids RETURN n, labels(n) AS labels, collect({from: n.id, to: m.id, kind: type(r)}) AS outgoing`, { projectId, ids: uniqueIds });
  const nodes: FunctionNode[] = [];
  const links: GraphLink[] = [];
  for (const record of result.records) {
    const node = record.get("n") as Neo4jNode;
    nodes.push(graphNodeFromNeo4j(node, record.get("labels") as string[]));
    for (const link of (record.get("outgoing") as Array<{ from: string; to: string; kind: string }>).filter((item) => item.to)) links.push({ ...link, state: changeType === "remove" && (link.from === selectedId || link.to === selectedId) ? "removed" : changeType === "rename" && (link.from === selectedId || link.to === selectedId) ? "affected" : "existing" });
  }
  return { nodes, links: [...new Map(links.map((link) => [`${link.from}|${link.to}|${link.kind}`, link])).values()], note };
}

export async function simulateChange(projectId: string, selectedId: string, changeType: ChangeType): Promise<ImpactResult> {
  if (!hasNeo4jCredentials()) return buildDemoImpact(selectedId, changeType);
  const driver = await getDriver();
  if (!driver) throw new Error("Neo4j AuraDB credentials are not configured.");
  const session = driver.session();
  try {
    const selectedResult = await session.run("MATCH (selected:Function { projectId: $projectId, id: $selectedId }) RETURN selected, labels(selected) AS labels", { projectId, selectedId });
    const selectedRecord = selectedResult.records[0];
    if (!selectedRecord) throw new Error("Selected function was not found in the Neo4j project graph.");
    const selected = graphNodeFromNeo4j(selectedRecord.get("selected") as Neo4jNode, selectedRecord.get("labels") as string[]);
    const directResult = await session.run(`MATCH (selected:Function { projectId: $projectId, id: $selectedId }) OPTIONAL MATCH (caller:Function { projectId: $projectId })-[:CALLS]->(selected) OPTIONAL MATCH (selected)-[:CALLS]->(callee:Function { projectId: $projectId }) RETURN collect(DISTINCT caller) AS callers, collect(DISTINCT callee) AS callees`, { projectId, selectedId });
    const directRecord = directResult.records[0];
    const directCallers = neoNodeList(directRecord, "callers", "Function");
    const directCallees = neoNodeList(directRecord, "callees", "Function");
    const dependentResult = await session.run(`MATCH (selected:Function { projectId: $projectId, id: $selectedId }) OPTIONAL MATCH p=(dependent:Function { projectId: $projectId })-[:CALLS*1..6]->(selected) RETURN collect(DISTINCT dependent.id) AS ids, coalesce(max(length(p)), 0) AS depth`, { projectId, selectedId });
    const dependentRecord = dependentResult.records[0];
    const dependentIds = (dependentRecord?.get("ids") as unknown[] ?? []).filter(Boolean).map(String);
    const dependencyDepth = toNumber(dependentRecord?.get("depth"), 0);
    let extraIds: string[] = [];
    if (changeType === "rename") {
      const renameResult = await session.run(`MATCH (selected:Function { projectId: $projectId, id: $selectedId }) MATCH (selectedFile:File { projectId: $projectId })-[:DEFINES|CONTAINS]->(selected) OPTIONAL MATCH (importing:File { projectId: $projectId })-[:IMPORTS*1..]->(selectedFile) OPTIONAL MATCH (importing)-[:DEFINES|CONTAINS]->(imported:Function) RETURN collect(DISTINCT imported.id) AS ids`, { projectId, selectedId });
      extraIds = (renameResult.records[0]?.get("ids") as unknown[] ?? []).filter(Boolean).map(String);
    }
    const allIds = [...new Set([...dependentIds, ...extraIds])];
    const entityResult = await session.run(`UNWIND $ids AS id MATCH (fn:Function { projectId: $projectId, id: id }) OPTIONAL MATCH (file:File { projectId: $projectId })-[:DEFINES|CONTAINS]->(fn) OPTIONAL MATCH (class:Class { projectId: $projectId })-[:DEFINES]->(fn) OPTIONAL MATCH (api:API { projectId: $projectId })-[:EXPOSES]->(fn) OPTIONAL MATCH (fn)-[:USES]->(database:Database) OPTIONAL MATCH (fn)-[:TESTED_BY]->(test:Test) RETURN collect(DISTINCT fn) AS functions, collect(DISTINCT file) AS files, collect(DISTINCT class) AS classes, collect(DISTINCT api) AS apis, collect(DISTINCT database) AS databases, collect(DISTINCT test) AS tests`, { projectId, ids: [...new Set([selectedId, ...allIds])] });
    const record = entityResult.records[0];
    const allFunctions = neoNodeList(record, "functions", "Function");
    const affectedFunctions = allFunctions.filter((node) => node.id !== selectedId);
    const affectedFiles = neoNodeList(record, "files", "File");
    const affectedClasses = neoNodeList(record, "classes", "Class");
    const affectedApis = neoNodeList(record, "apis", "API");
    const affectedDatabases = neoNodeList(record, "databases", "Database");
    const affectedTests = neoNodeList(record, "tests", "Test");
    const pathResult = await session.run(`MATCH p=(dependent:Function { projectId: $projectId })-[:CALLS*1..6]->(selected:Function { projectId: $projectId, id: $selectedId }) RETURN p LIMIT 40`, { projectId, selectedId });
    const impactPaths: ImpactPath[] = pathResult.records.map((pathRecord, index) => {
      const path = pathRecord.get("p") as { nodes?: Neo4jNode[]; segments?: Array<{ relationship: { type: string } }> };
      const pathNodes = (path.nodes ?? []).map((node) => graphNodeFromNeo4j(node, ["Function"]));
      return { id: `path-${index}`, nodeIds: pathNodes.map((node) => node.id), nodes: pathNodes, relations: (path.segments ?? []).map((segment) => segment.relationship.type), label: pathNodes.map((node) => node.name).join(" → ") };
    });
    const scopeIds = [selectedId, ...directCallers.map((node) => node.id), ...directCallees.map((node) => node.id), ...affectedFunctions.map((node) => node.id), ...affectedFiles.map((node) => node.id), ...affectedClasses.map((node) => node.id), ...affectedApis.map((node) => node.id), ...affectedDatabases.map((node) => node.id), ...affectedTests.map((node) => node.id)];
    const before = await snapshotFor(session, projectId, scopeIds, "Current relationships from Neo4j.", changeType, selectedId);
    const afterLinks = before.links.filter((link) => !(changeType === "remove" && (link.from === selectedId || link.to === selectedId))).map((link) => ({ ...link, state: changeType === "rename" || affectedFunctions.some((node) => node.id === link.from || node.id === link.to) ? "affected" as const : "existing" as const }));
    const after: ImpactSnapshot = { nodes: changeType === "remove" ? before.nodes.filter((node) => node.id !== selectedId) : before.nodes, links: afterLinks, note: changeType === "remove" ? "Selected function and its connected edges removed." : changeType === "rename" ? "Selected symbol relationships marked for rename." : "Affected relationships highlighted for the selected change." };
    const base = { selectedId, selected, changeType, directCallers, directCallees, directImpactIds: directCallers.map((node) => node.id), transitiveImpactIds: affectedFunctions.filter((node) => !directCallers.some((caller) => caller.id === node.id)).map((node) => node.id), affectedIds: affectedFunctions.map((node) => node.id), affectedFunctions, affectedFiles, affectedClasses, affectedApis, affectedDatabases, affectedTests, impactPaths, totals: { functions: affectedFunctions.length, files: affectedFiles.length, classes: affectedClasses.length, apis: affectedApis.length, databases: affectedDatabases.length, tests: affectedTests.length } };
    const riskFactors = riskFor(base, dependencyDepth);
    const result = { ...base, riskFactors, before, after, noTestsDetected: affectedTests.length === 0 };
    return { ...result, deterministicSummary: summaryFor(result) };
  } finally {
    await session.close();
  }
}

export async function explainImpact(result: ImpactResult) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: result.deterministicSummary, provider: "fallback" as const };
  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Explain these deterministic graph facts in 80 words or fewer. Do not invent or change any number, dependency, API, file, database operation, or test. Change: ${changeTypeLabel(result.changeType)} on ${result.selected?.name ?? "selected function"}. Facts: ${JSON.stringify({ summary: result.deterministicSummary, directCallers: result.directCallers.map((node) => node.name), directCallees: result.directCallees.map((node) => node.name), totals: result.totals, riskFactors: result.riskFactors, tests: result.affectedTests.map((node) => node.name), paths: result.impactPaths.slice(0, 5).map((path) => path.label) })}` }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 180 } }) });
    if (!response.ok) throw new Error("Gemini request failed");
    const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    return { text: text || result.deterministicSummary, provider: text ? ("gemini" as const) : ("fallback" as const) };
  } catch { return { text: result.deterministicSummary, provider: "fallback" as const }; }
}

export function getDemoGraphForTests() { return demoGraph; }
export function getNeo4jDriverForTests() { return getDriver(); }
export function stableProjectId() { return randomUUID(); }
