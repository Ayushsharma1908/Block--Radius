⚡ BlastRadius


Know what breaks before you ship.

BlastRadius is an AI-assisted dependency intelligence platform that helps developers understand the potential impact of code changes before they are shipped.

It transforms a repository into an interactive dependency graph, allowing developers to select functions, simulate hypothetical changes, trace direct and transitive dependencies, inspect risk factors, and identify potentially affected tests.

Instead of only asking "What changed?", BlastRadius asks:


"What could this change affect?"




🚀 What is BlastRadius?

Modern codebases are highly interconnected.

A developer may change a single function without immediately realizing that it is used by multiple callers, APIs, database operations, or other parts of the application.

BlastRadius maps these relationships into a dependency graph and lets developers explore the potential blast radius of a hypothetical change.

Core workflow

Plain Text


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






✨ Features

🔍 Repository Dependency Graph

Analyze a TypeScript/JavaScript repository and build an interactive representation of its code dependencies.

The graph can represent relationships between:

•
Functions

•
Files

•
Classes

•
APIs

•
Database operations

•
Tests

•
Other dependency surfaces




💥 Change Simulator

Select a function and simulate different hypothetical changes:

•
Change parameters

•
Change implementation

•
Rename

•
Remove

•
Change return type

The system then evaluates the potential impact of that change against the persisted dependency graph.




🕸️ Direct & Transitive Impact

BlastRadius distinguishes between:

Direct impact

Functions directly connected to the selected function.

Transitive impact

Functions reached through multiple dependency levels.

This makes it possible to understand not only immediate callers but also deeper dependency chains.




🧭 Impact Paths

BlastRadius can show why a particular function or node is affected.

Instead of simply saying:

Plain Text


Function A is affected



the system can expose the dependency path:

Plain Text


Function A
    ↓
Function B
    ↓
Function C
    ↓
Changed Function



This makes the result easier to reason about.




📊 Risk Analysis

BlastRadius calculates deterministic graph-based factors that help describe the potential risk surface of a change.

Factors can include:

•
Fan-in

•
Fan-out

•
Dependency depth

•
API exposure

•
Database operations

•
Test coverage

•
Number of affected functions

•
Number of affected files

The goal is to provide an explainable view of the change rather than a black-box score.




🧪 Test Impact

BlastRadius can identify connected tests through the dependency graph and highlight areas where test coverage may need attention.

This can help developers focus testing around the affected portion of the repository.




🤖 Gemini-Assisted Review

Gemini is used as an explanation layer on top of the deterministic graph analysis.

The architecture follows:

Plain Text


Graph Data
    ↓
Deterministic Analysis
    ↓
Computed Impact
    ↓
Gemini
    ↓
Human-readable Explanation



The dependency graph remains the source of truth.


AI explains the impact. The graph determines the impact.




🧠 Why BlastRadius?

Traditional code navigation helps developers answer:


"Where is this function used?"

BlastRadius is designed to help answer a larger question:


"If I change this function, what could be affected?"

This shifts dependency analysis from manual exploration toward an interactive, change-aware workflow.




🏗️ Architecture

Plain Text


                 ┌─────────────────────┐
                 │   GitHub Repository │
                 │     / Local Repo    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Repository Parser │
                 │   ts-morph / AST    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │     Neo4j AuraDB    │
                 │   Dependency Graph  │
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
             └─────────────┼───────────────┘
                           ▼
                  ┌─────────────────┐
                  │ Gemini Review   │
                  │ Explanation     │
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ React Dashboard │
                  │ Interactive     │
                  │ Graph Workspace │
                  └─────────────────┘






🛠️ Tech Stack

Frontend

•
React

•
TypeScript

•
Vite

•
React Flow

•
Tailwind CSS

•
Lucide Icons

•
Framer Motion

Backend

•
Node.js

•
TypeScript

•
Express/server layer

Code Analysis

•
ts-morph

•
TypeScript Compiler API

Graph Database

•
Neo4j AuraDB

•
Cypher

AI

•
Google Gemini

Repository Integration

•
GitHub API

•
Local repository analysis




🎯 Product Workflow

1. Add a repository

Paste a GitHub repository URL or analyze a local repository.

2. Analyze the repository

BlastRadius parses the codebase and builds the dependency graph.

3. Explore the graph

Browse functions and dependency relationships through the interactive graph.

4. Select a function

Choose the function you are considering changing.

5. Simulate a change

Select a hypothetical change type.

6. Inspect the blast radius

Review:

•
Direct callers

•
Direct callees

•
Transitive dependencies

•
Impact paths

•
Affected files

•
APIs

•
Database operations

•
Tests

7. Understand the risk

Review graph-derived risk factors and Gemini's explanation.




🖥️ Interface

BlastRadius is designed around a developer-focused workspace:

Plain Text


┌──────────────────────────────────────────────────────────┐
│                    Repository Input                      │
├───────────────┬──────────────────────────┬───────────────┤
│               │                          │               │
│   Function    │       Call Graph         │    Impact     │
│     Index     │                          │   Inspector   │
│               │                          │               │
│   Functions   │    Dependency Nodes      │   Risk        │
│   Search      │    + Relationships       │   Tests       │
│               │                          │   AI Review   │
│               │                          │               │
└───────────────┴──────────────────────────┴───────────────┘






🔐 Environment Variables

Create a .env file in the project root:

Plain Text


NEO4J_URI=your_neo4j_uri
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

GEMINI_API_KEY=your_gemini_api_key



Never commit .env or API credentials to GitHub.

Make sure .gitignore contains:

Plain Text


.env
.env.local
node_modules
dist






⚙️ Installation

Clone the repository:

Bash


git clone https://github.com/Ayushsharma1908/Block--Radius.git



Move into the project:

Bash


cd Block--Radius



Install dependencies:

Bash


pnpm install



Create your environment file:

Bash


.env



Add the required Neo4j and Gemini credentials.




▶️ Development

Start the development server:

Windows PowerShell

Plain Text


$env:NODE_ENV="development"
pnpm exec tsx watch server/_core/index.ts



The application will be available at:

Plain Text


http://localhost:3000






🧪 Testing

Run the test suite:

Bash


pnpm test



Run TypeScript checks:

Bash


pnpm check






🏗️ Production Build

Build the application:

Bash


pnpm build



Start the production server:

Bash


pnpm start






📈 Current Capabilities

BlastRadius currently focuses on:

•
Repository analysis

•
Dependency graph generation

•
Neo4j graph persistence

•
Interactive graph visualization

•
Function exploration

•
Direct dependency analysis

•
Transitive dependency analysis

•
Change simulation

•
Impact paths

•
Risk factor analysis

•
Test impact analysis

•
Gemini-assisted explanations

•
Multiple repository analysis




🗺️ Roadmap

Current




Repository dependency graph




Interactive function graph




Change simulation




Direct impact analysis




Transitive impact analysis




Impact path analysis




Risk factor analysis




Test impact analysis




Gemini-assisted review

Next




Pull Request analysis




Deeper GitHub integration




Dependency hotspots




Architecture smell detection




Before/after architecture simulation




Improved test mapping




Broader language support




🔬 Design Principle

BlastRadius follows a simple principle:


Deterministic graph computation first. AI explanation second.

The system does not rely on an AI model to invent dependency relationships.

Instead:

Plain Text


Source Code
    ↓
Static Analysis
    ↓
Dependency Graph
    ↓
Graph Traversal
    ↓
Impact Facts
    ↓
AI Explanation



This makes the explanation grounded in the actual repository analysis.




⚠️ Limitations

BlastRadius is currently focused primarily on JavaScript/TypeScript repositories.

The accuracy of impact analysis depends on the relationships that can be statically extracted from the analyzed repository.

Dynamic behavior, runtime-generated dependencies, reflection, external systems, and relationships that cannot be inferred statically may not be fully represented.

BlastRadius should therefore be treated as a developer-assistance and analysis tool rather than a guarantee that every possible regression will be detected.




🌟 Vision

Software systems become harder to reason about as they grow.

BlastRadius aims to make dependency relationships visible and change impact understandable before developers ship changes.

The long-term vision is a development workflow where engineers can ask:

Plain Text


"What happens if I change this?"



and immediately explore the affected part of their system.




👨‍💻 Built With

Built as a developer tooling project combining:

React · TypeScript · ts-morph · Neo4j · Cypher · Gemini · React Flow




📄 License

This project is currently provided for demonstration and development purposes.

Add an appropriate open-source license before presenting this repository as an officially licensed open-source project.

