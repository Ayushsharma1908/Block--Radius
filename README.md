# ⚡ BlastRadius

> **Know what breaks before you ship.**

BlastRadius is an AI-assisted dependency intelligence platform that helps developers understand the potential impact of code changes before they are shipped.

It transforms a repository into an interactive dependency graph, allowing developers to select functions, simulate hypothetical changes, trace direct and transitive dependencies, inspect risk factors, and identify potentially affected tests.

Instead of only asking:
> *"What changed?"*

BlastRadius asks:
> **"What could this change affect?"**

---

## 🚀 What is BlastRadius?

Modern codebases are highly interconnected. A developer may change a single function without immediately realizing that it is used by multiple callers, APIs, database operations, or other parts of the application.

BlastRadius maps these relationships into a dependency graph and lets developers explore the potential blast radius of a hypothetical change.

### Core Workflow

```text
GitHub / Local Repository
          ↓
    Code Analysis
          ↓
   Dependency Graph
          ↓
    Select Function
          ↓
   Simulate Change
          ↓
 Blast Radius Analysis
          ↓
Risk + Test Impact + Explanation
```

---

## ✨ Features

### 🔍 Repository Dependency Graph
Analyze a TypeScript/JavaScript repository and build an interactive representation of its code dependencies.

The graph represents relationships between:
- **Functions & Methods**
- **Source Files**
- **Classes**
- **API Endpoints & HTTP Routes**
- **Database Operations**
- **Automated Tests**
- **Other dependency surfaces**

### 💥 Change Simulator
Select any function and simulate 5 distinct hypothetical mutations:
- **Change parameters** (signature mutation)
- **Modify implementation** (internal logic refactor)
- **Rename function** (identifier & import changes)
- **Remove function** (breaking deletion)
- **Change return type** (downstream contract break)

The system deterministically evaluates the impact of that mutation against the persisted Neo4j call graph.

### 🕸️ Direct & Transitive Impact
BlastRadius clearly distinguishes between:
- **Direct impact**: Functions directly calling or called by the selected symbol.
- **Transitive impact**: Functions reached through multiple indirect dependency levels ($N$-th degree callers).

This makes it possible to understand not only immediate callers but also deeper ripple effects across services.

### 🧭 Impact Paths
BlastRadius exposes *why* a particular function is affected. Instead of simply stating:
```text
Function A is affected
```
The system exposes the exact traversal chain:
```text
Function A → Function B → Function C → Changed Target Function
```
This makes complex refactors transparent and easy to reason about.

### 📊 Risk Analysis
BlastRadius computes deterministic, graph-based metrics describing the risk surface of a change:
- **Fan-in**: Number of upstream dependent callers
- **Fan-out**: Number of downstream internal dependencies
- **Dependency Depth**: Maximum depth of the transitive call tree
- **API Exposure**: Number of affected public HTTP endpoints
- **Database Operations**: Affected read/write database queries
- **Test Coverage Ratio**: Proportion of affected functions with detected test relationships
- **Affected Functions & Files**: Total volume of impacted source code

### 🧪 Test Impact
BlastRadius traces `TESTED_BY` relationships through the dependency graph to recommend exactly which test suites need to be rerun before opening a pull request.

### 🤖 Gemini-Assisted Review
Gemini AI functions as a grounded explanation layer on top of verified graph facts:

```text
Graph Data → Deterministic Analysis → Computed Impact → Gemini AI → Human-readable Risk Review
```

- The dependency graph remains the single source of truth.
- **AI explains the impact. The graph determines the impact.**

---

## 🧠 Why BlastRadius?

Traditional code navigation helps developers answer:
> *"Where is this function used?"*

BlastRadius is designed to help answer a much larger question:
> **"If I change this function, what could be affected across the entire system?"**

This shifts dependency analysis from manual grep exploration toward an automated, change-aware engineering workflow.

---

## 🏗️ Architecture

```text
                 ┌─────────────────────┐
                 │  GitHub Repository  │
                 │    / Local Repo     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  Repository Parser  │
                 │   ts-morph / AST    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │    Neo4j AuraDB     │
                 │  Dependency Graph   │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Impact Analysis   │
                 │       Cypher        │
                 └──────────┬──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌───────────┐
        │   Risk   │  │   Test   │  │  Impact   │
        │ Analysis │  │  Impact  │  │   Paths   │
        └────┬─────┘  └────┬─────┘  └─────┬─────┘
             └─────────────┼──────────────┘
                           ▼
                  ┌─────────────────┐
                  │  Gemini Review  │
                  │   Explanation   │
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ React Dashboard │
                  │   Interactive   │
                  │ Graph Workspace │
                  └─────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19** & **TypeScript**
- **Vite** (Optimized chunking & code splitting)
- **Tailwind CSS** (Modern dark-mode design system)
- **Lucide Icons**
- **Framer Motion** & **Wouter**

### Backend & API
- **Node.js** & **Express**
- **tRPC** (End-to-end type safety)
- **ts-morph** (Abstract Syntax Tree parsing & static analysis)
- **TypeScript Compiler API**

### Graph Database
- **Neo4j AuraDB** (Cloud graph persistence)
- **Cypher Query Language** (Deterministic transitive path traversals)

### Artificial Intelligence
- **Google Gemini** (`gemini-2.0-flash` / grounded contextual explanations)

### Repository Integration
- **GitHub REST API** (Tree recursive parser)
- **Local Directory Upload** (Browser directory reader)

---

## 🎯 Product Workflow

1. **Add a repository**: Paste a public GitHub URL, enter a repository slug, or upload a local folder.
2. **Analyze the repository**: BlastRadius parses TypeScript/JavaScript ASTs and constructs the dependency graph.
3. **Explore the graph**: Browse functions in the index or view the interactive architectural call graph.
4. **Select a function**: Click any function to make it the mutation target.
5. **Simulate a change**: Choose a change type (modify implementation, change parameters, rename, remove, etc.).
6. **Inspect the blast radius**:
   - Upstream direct callers & downstream callees
   - Transitive blast radius paths
   - Affected files, APIs, database operations, and tests
7. **Understand the risk**: Review deterministic graph facts and Gemini's natural language risk assessment.

---

## 🖥️ Interface

BlastRadius is structured into a 3-column developer workspace:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Repository Input / Top Bar                      │
├─────────────────┬──────────────────────────────────┬───────────────────┤
│                 │                                  │                   │
│  Function Index │         Call Graph Canvas        │  Impact Inspector │
│                 │                                  │                   │
│ • Search filter │ • Upstream Callers (Affected)    │ • Change Simulator│
│ • Function list │ • Selected Target Capsule        │ • Surface Metrics │
│ • File & line   │ • Downstream Callees             │ • Connected Tests │
│                 │ • Smooth Bézier Dependency Paths │ • Gemini AI Review│
│                 │ • Interactive Hover HUD          │                   │
│                 │                                  │                   │
└─────────────────┴──────────────────────────────────┴───────────────────┘
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# Neo4j AuraDB Configuration
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Optional GitHub Token (increases GitHub API rate limits)
GITHUB_TOKEN=your_github_personal_access_token
```

> **Security Note:** Never commit `.env` or credentials to git. Verify that your `.gitignore` contains:
> ```text
> .env
> .env.local
> node_modules
> dist
> ```

---

## ⚙️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ayushsharma1908/Block--Radius.git
   cd Block--Radius
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Populate your Neo4j and Gemini credentials in `.env`.*

---

## ▶️ Development

Start the local server with hot reloading:

```powershell
# Windows PowerShell
$env:NODE_ENV="development"; pnpm exec tsx watch server/_core/index.ts

# Linux / macOS
NODE_ENV=development pnpm exec tsx watch server/_core/index.ts
```

The application will be accessible at:
👉 **[http://localhost:3000](http://localhost:3000/)** (or next available port, e.g. `http://localhost:3001`)

---

## 🧪 Testing & Verification

Run the automated test suite:
```bash
pnpm test
```

Run TypeScript typecheck:
```bash
pnpm check
```

---

## 🏗️ Production Build

Compile client and server bundles:
```bash
pnpm build
```

Run production server:
```bash
pnpm start
```

---

## 📈 Current Capabilities

- [x] Static AST parsing of TypeScript & JavaScript repositories
- [x] Dependency graph construction & Neo4j persistence
- [x] Built-in demo graph fallback (no credentials required to explore)
- [x] Interactive SVG node capsule visualization with semantic kind tags
- [x] Architectural swimlanes (`Upstream Callers` → `Target` → `Downstream Callees`)
- [x] Smooth cubic Bézier connectors with animated flow streams
- [x] 5 distinct mutation simulation types
- [x] Multi-tier transitive blast radius calculation
- [x] Impact path tracing (`A → B → C → Target`)
- [x] Graph-derived risk factor metrics (fan-in, fan-out, depth, API surface)
- [x] Test relationship detection & rerun recommendations
- [x] Grounded Gemini AI change risk summaries
- [x] Code-split bundles & sub-millisecond in-memory simulation caching

---

## 🗺️ Roadmap

### Current
- Repository dependency graph
- Interactive function graph
- Change simulation
- Direct impact analysis
- Transitive impact analysis
- Impact path analysis
- Risk factor analysis
- Test impact analysis
- Gemini-assisted review

### Next
- Pull Request analysis & CI/CD GitHub Action integration
- Deeper GitHub integration with branch diff comparison
- Dependency hotspots & coupling detection
- Architectural code smell warnings
- Before / after architecture visual simulation
- Enhanced test coverage mapping
- Broader language support (Python, Go, Java)

---

## 🔬 Design Principle

BlastRadius follows a strict principle:

> **Deterministic graph computation first. AI explanation second.**

The system never relies on an AI model to guess or hallucinate dependency relationships:

```text
Source Code → Static Analysis → Dependency Graph → Graph Traversal → Verified Facts → AI Explanation
```

This ensures that every explanation is 100% grounded in verified mathematical call graph data.

---

## ⚠️ Limitations

- BlastRadius currently focuses on JavaScript and TypeScript codebases.
- Impact analysis is based on relationships that can be statically extracted from source code.
- Dynamic behavior, runtime-evaluated dependencies, reflection, or external distributed microservices may not be fully captured.
- BlastRadius should be treated as an intelligent developer-assistance and analysis tool rather than a guarantee that every possible regression will be caught.

---

## 🌟 Vision

Software systems become harder to reason about as they scale. BlastRadius aims to make dependency relationships visible and change impact understandable before developers ship code.

The long-term vision is a development workflow where engineers can simply ask:
> **"What happens if I change this?"**

...and immediately explore the affected surface of their system with confidence.

---

## 👨‍💻 Built With

- **React** · **TypeScript** · **Vite** · **Tailwind CSS**
- **ts-morph** · **Neo4j AuraDB** · **Cypher** · **Google Gemini**

---

## 📄 License

This project is currently provided for demonstration and development purposes.
Add an appropriate open-source license (e.g. MIT) before presenting this repository as an officially licensed open-source project.
