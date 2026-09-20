import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  FileCode,
  FolderGit2,
  GitBranch,
  Github,
  Layers,
  Network,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

const testimonials = [
  { quote: "Caught a breaking auth change 3 days before it could hit staging.", author: "Elena R.", role: "Staff Platform Eng" },
  { quote: "Saved our engineering team 8 hours of manual grep during our v2 API migration.", author: "Marcus K.", role: "Principal Architect" },
  { quote: "The deterministic call graph makes PR reviews 3x faster and anxiety-free.", author: "Sophia T.", role: "Tech Lead" },
  { quote: "Deterministic Neo4j graph traversal + Gemini risk summary is pure engineering joy.", author: "Devon M.", role: "Senior Backend Eng" },
  { quote: "No more praying that unit tests caught every indirect caller across micro-packages.", author: "Arjun P.", role: "Lead Systems Eng" },
];

const faqs = [
  {
    question: "How is BlastRadius different from searching with grep or IDE 'Find Usages'?",
    answer: "Text grep and standard IDE search rely on string matching or single-file lexical analysis. They frequently miss re-exported modules, aliased imports, higher-order functions, and multi-tier transitive callers. BlastRadius builds a true Abstract Syntax Tree (AST) and models callers, callees, classes, and HTTP route handlers into a directed graph in Neo4j, deterministically traversing Nth-degree blast radius in milliseconds."
  },
  {
    question: "Does BlastRadius require running my code or executing test suites?",
    answer: "No. BlastRadius performs completely static AST analysis. You do not need to compile, run tests, or execute arbitrary code. It parses TypeScript and JavaScript files into syntactic call graphs without runtime overhead or security concerns."
  },
  {
    question: "How does Gemini AI assist without hallucinating dependencies?",
    answer: "Gemini is never asked to guess your codebase relationships. Instead, our deterministic graph engine first computes the exact mathematical call chain and affected APIs. Then, Gemini is given strictly verified graph facts to generate a human-readable risk summary for developers and PR reviewers."
  },
  {
    question: "Can I analyze private repositories or local source folders?",
    answer: "Yes. BlastRadius supports analyzing public GitHub repositories, pasting private Git URLs with personal access tokens, or simply dragging and dropping a local repository folder directly from your machine."
  },
  {
    question: "What kinds of breaking changes can I simulate?",
    answer: "You can simulate 5 distinct mutation types: modifying function implementation, altering parameter signatures, changing return types, renaming symbols, or completely removing a function or method."
  },
  {
    question: "Can BlastRadius be integrated into CI/CD for pull request checks?",
    answer: "Yes! BlastRadius offers an API and automated pipeline checks that can compare PR branches against main, reporting upstream blast radius as a GitHub Action comment."
  }
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [repoInput, setRepoInput] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLaunch = (repo?: string) => {
    if (repo && repo.trim()) {
      setLocation(`/app?repo=${encodeURIComponent(repo.trim())}`);
    } else {
      setLocation("/app");
    }
  };

  const handleCtaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLaunch(repoInput || "expressjs/express");
  };

  return (
    <div className="landing-root">
      <div className="landing-frame">
        {/* Floating Pill Navbar */}
        <div className="landing-nav-wrapper">
          <header className="landing-nav">
            <Link href="/" className="landing-brand">
              <div className="brand-mark">
                <Zap size={16} fill="currentColor" />
              </div>
              <div className="landing-brand-name">
                blast<span>radius</span>
              </div>
            </Link>

            <nav>
              <ul className="landing-links">
                <li><a href="#problem" className="landing-link">Problem</a></li>
                <li><a href="#solution" className="landing-link">Solution</a></li>
                <li><a href="#how-it-works" className="landing-link">How It Works</a></li>
                <li><a href="#features" className="landing-link">Features</a></li>
                <li><a href="#faq" className="landing-link">FAQ</a></li>
              </ul>
            </nav>

            <div className="landing-nav-action">
              <a
                href="https://github.com/Shubhamm-02/BlastRadius"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary-pill"
                style={{ padding: "7px 14px", fontSize: "12px" }}
              >
                <Github size={14} /> Star
              </a>
              <button onClick={() => handleLaunch()} className="landing-cta-pill">
                Launch App <ArrowRight size={14} />
              </button>
            </div>
          </header>
        </div>

        {/* Hero Section */}
        <section className="landing-hero">
          <div className="hero-pill-badge">
            <Zap size={13} fill="currentColor" />
            <span>DEPENDENCY INTELLIGENCE FOR SAFER REFACTORS</span>
          </div>

          <h1>
            Know What Breaks<br />
            <em>Before</em> You Ship.
          </h1>

          <p className="landing-hero-desc">
            Map your repository into a living call graph. Pinpoint direct and transitive blast radius, detect broken API contracts, and verify every refactor with deterministic precision and Gemini AI.
          </p>

          <div className="landing-hero-actions">
            <button onClick={() => handleLaunch()} className="btn-primary-pill">
              Launch Workbench <ArrowRight size={16} />
            </button>
            <button
              onClick={() => handleLaunch("expressjs/express")}
              className="btn-secondary-pill"
            >
              <Play size={14} className="text-amber-500 fill-amber-500" />
              Explore Express.js Demo
            </button>
          </div>

          <div className="hero-micro-note">
            <span>No signup required • Works with public GitHub repositories & local folders</span>
          </div>

          {/* Hero Perspective Visual Stage (Layered Reference-Style Card) */}
          <div className="hero-visual-container">
            <div className="hero-visual-stage">
              {/* Left Column: Cascading Stack of Code Files */}
              <div className="code-cascade">
                <div className="code-card-mini">
                  <div className="code-card-header">
                    <span className="code-filename">
                      <FileCode size={13} className="text-slate-400" />
                      routes/checkout.ts
                    </span>
                    <span className="code-badge caller">Caller #1</span>
                  </div>
                  <div className="code-snippet">
                    const session = await <strong>validateSessionToken</strong>(token);
                  </div>
                </div>

                <div className="code-card-mini">
                  <div className="code-card-header">
                    <span className="code-filename">
                      <FileCode size={13} className="text-slate-400" />
                      services/billing.ts
                    </span>
                    <span className="code-badge caller">Caller #2</span>
                  </div>
                  <div className="code-snippet">
                    if (!<strong>validateSessionToken</strong>(req.auth)) return 401;
                  </div>
                </div>

                {/* Target Function Being Refactored */}
                <div className="code-card-mini target-card">
                  <div className="code-card-header">
                    <span className="code-filename">
                      <Zap size={13} className="text-amber-600" />
                      lib/auth/session.ts
                    </span>
                    <span className="code-badge target">Refactor Target</span>
                  </div>
                  <div className="code-snippet">
                    export function <strong>validateSessionToken</strong>(tok: string)
                  </div>
                </div>
              </div>

              {/* Center Column: Animated Connector Pulse */}
              <div className="visual-connector">
                <div className="connector-line">
                  <div className="connector-pulse" />
                </div>
              </div>

              {/* Right Column: High-Impact Blast Radius Preview Card */}
              <div className="impact-preview-card">
                <div className="impact-preview-header">
                  <div className="impact-header-title">
                    <Activity size={14} />
                    <span>Blast Radius Analysis</span>
                  </div>
                  <div className="impact-header-status">
                    Graph Engine Live
                  </div>
                </div>

                <div className="impact-target-name">
                  validateSessionToken()
                </div>
                <div className="impact-target-file">
                  lib/auth/session.ts:42 • Simulated: Change parameter signature
                </div>

                <div className="impact-metrics-row">
                  <div className="impact-metric-box">
                    <strong>5</strong>
                    <span>Callers</span>
                  </div>
                  <div className="impact-metric-box">
                    <strong>2</strong>
                    <span>API Routes</span>
                  </div>
                  <div className="impact-metric-box">
                    <strong>3</strong>
                    <span>Tests</span>
                  </div>
                </div>

                <div className="impact-ai-bubble">
                  <span>
                    <Sparkles size={13} /> Gemini Risk Review
                  </span>
                  Changing parameter type from string to object cascades into 2 public HTTP endpoints (/api/checkout, /api/webhooks) and breaks 3 downstream test suites. Recommend backwards-compatible overload.
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Developer Ticker */}
          <div className="ticker-wrap">
            <div className="ticker-track">
              {[...testimonials, ...testimonials].map((t, idx) => (
                <div key={idx} className="ticker-item">
                  <div className="ticker-avatar">{t.author[0]}</div>
                  <span>“{t.quote}”</span>
                  <strong>— {t.author}</strong>
                  <span className="text-slate-400 font-mono text-[11px]">({t.role})</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section id="problem" className="problem-section">
          <div className="section-header-center">
            <div className="section-icon-badge">
              <AlertTriangle size={13} />
              <span>THE REFACTORING PARADOX</span>
            </div>
            <h2>Why Refactoring Keeps High-Performing Teams Anxious</h2>
            <p>
              Modern codebases are sprawling webs of inter-dependencies. A seemingly innocent 3-line utility change ripples outward into unmonitored production pathways.
            </p>
          </div>

          <div className="problem-grid">
            <div className="problem-card">
              <div className="problem-card-icon">
                <ShieldAlert size={22} />
              </div>
              <h3>Silent Transitive Breakage</h3>
              <p>
                Local unit tests pass because mocks isolate module A. But module F, 4 layers downstream, silently explodes at runtime because a subtle return contract shifted.
              </p>
            </div>

            <div className="problem-card">
              <div className="problem-card-icon">
                <Search size={22} />
              </div>
              <h3>The Manual Grep Trap</h3>
              <p>
                Developers waste hours searching codebase strings with Ctrl+Shift+F, hoping they didn't miss dynamic calls, aliased imports, or re-exported symbols.
              </p>
            </div>

            <div className="problem-card">
              <div className="problem-card-icon">
                <GitBranch size={22} />
              </div>
              <h3>PR Review Blindspots</h3>
              <p>
                Pull request diffs only reveal lines that changed—never what depends on those lines. Reviewers approve clean diffs without ever seeing the upstream blast radius.
              </p>
            </div>
          </div>
        </section>

        {/* Solution Comparison Section */}
        <section id="solution" className="solution-section">
          <div className="section-header-center">
            <div className="section-icon-badge">
              <ShieldCheck size={13} />
              <span>THE BLAST RADIUS ADVANTAGE</span>
            </div>
            <h2>Deterministic Math Over Hallucinated Guesswork</h2>
            <p>
              We don't ask an LLM to guess what might break. BlastRadius builds a mathematical AST graph, runs Cypher traversals in Neo4j, and uses Gemini strictly to explain the facts.
            </p>
          </div>

          <div className="comparison-box">
            {/* The Old Way */}
            <div className="comparison-card bad">
              <div className="comparison-card-tag">
                Traditional Approach
              </div>
              <h3>Grep & Prayer</h3>
              <p>
                Relying on fragile mocks, manual call-stack hunting, and hoping regression suites catch breaking changes before users do.
              </p>
              <ul className="comparison-list">
                <li>
                  <AlertTriangle size={16} className="text-rose-500" />
                  <span>Misses indirect calls across multiple package boundaries</span>
                </li>
                <li>
                  <AlertTriangle size={16} className="text-rose-500" />
                  <span>No visibility into affected public HTTP endpoints</span>
                </li>
                <li>
                  <AlertTriangle size={16} className="text-rose-500" />
                  <span>Code reviews take days of manual tracing</span>
                </li>
                <li>
                  <AlertTriangle size={16} className="text-rose-500" />
                  <span>Frequent rollback releases caused by unexpected side effects</span>
                </li>
              </ul>
            </div>

            {/* The BlastRadius Way */}
            <div className="comparison-card good">
              <div className="comparison-card-tag">
                BlastRadius Engine
              </div>
              <h3>Living Graph Intelligence</h3>
              <p>
                Full syntactic graph traversal combined with instant impact simulation and grounded AI explanations.
              </p>
              <ul className="comparison-list">
                <li>
                  <Check size={16} className="text-amber-600" />
                  <span>100% deterministic AST graph traversal powered by Neo4j</span>
                </li>
                <li>
                  <Check size={16} className="text-amber-600" />
                  <span>Instant identification of affected APIs, tests, and classes</span>
                </li>
                <li>
                  <Check size={16} className="text-amber-600" />
                  <span>Simulate 5 change types before editing a single line of code</span>
                </li>
                <li>
                  <Check size={16} className="text-amber-600" />
                  <span>Gemini AI provides grounded architectural risk summaries</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="how-section">
          <div className="section-header-center">
            <div className="section-icon-badge">
              <Workflow size={13} />
              <span>4-STEP DETERMINISTIC PIPELINE</span>
            </div>
            <h2>How BlastRadius Empowers Your Workflow</h2>
            <p>
              From raw code to complete dependency transparency in seconds.
            </p>
          </div>

          <div className="pipeline-grid">
            <div className="pipeline-card">
              <div className="pipeline-step-number">01</div>
              <h4>Ingest Repository</h4>
              <p>
                Provide any public GitHub repository URL or drag-and-drop a local folder. Works out of the box with TypeScript & JavaScript.
              </p>
            </div>

            <div className="pipeline-card">
              <div className="pipeline-step-number">02</div>
              <h4>AST Graph Extraction</h4>
              <p>
                The AST parser maps all declarations, classes, exports, and call expressions into an interconnected directed graph.
              </p>
            </div>

            <div className="pipeline-card">
              <div className="pipeline-step-number">03</div>
              <h4>Simulate Change</h4>
              <p>
                Select any function and choose a simulated change (param modification, return type shift, or removal) to compute upstream radius.
              </p>
            </div>

            <div className="pipeline-card">
              <div className="pipeline-step-number">04</div>
              <h4>Gemini Review</h4>
              <p>
                Receive an instant risk assessment explaining affected downstream APIs, test suites, and safe refactoring recommendations.
              </p>
            </div>
          </div>
        </section>

        {/* Core Features 2x2 Grid (Direct Reference Alignment) */}
        <section id="features" className="features-section">
          <div className="section-header-center">
            <div className="section-icon-badge">
              <Layers size={13} />
              <span>CORE CAPABILITIES</span>
            </div>
            <h2>Built for Deep Codebase Understanding</h2>
            <p>
              Everything you need to inspect, trace, and modernize complex software systems.
            </p>
          </div>

          <div className="features-2x2-grid">
            {/* Feature 1 */}
            <div className="feature-large-card">
              <div>
                <div className="feature-card-pill">
                  <Code2 size={12} />
                  <span>AST DEEP DIVE</span>
                </div>
                <h3>Go deeper than text search into actual code structure</h3>
                <p>
                  Our lexical parser understands functions, arrow callbacks, method bindings, and import aliases across your entire directory tree.
                </p>
              </div>

              <div className="feature-mockup-frame">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2 pb-2 border-b border-slate-200">
                  <span className="font-mono">AST Symbols</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-medium">94 Nodes</span>
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="font-semibold text-slate-800">createAppServer()</span>
                    <span className="text-slate-400 text-[10px] ml-auto">server.ts:18</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="font-semibold text-slate-800">handleAuthentication()</span>
                    <span className="text-slate-400 text-[10px] ml-auto">auth.ts:54</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="feature-large-card">
              <div>
                <div className="feature-card-pill">
                  <Network size={12} />
                  <span>BLAST RADIUS ENGINE</span>
                </div>
                <h3>Deterministic upstream traversal via graph engine</h3>
                <p>
                  Instantly compute all 1st, 2nd, and transitive callers. Visualize affected clusters with interactive pan, zoom, and node dragging.
                </p>
              </div>

              <div className="feature-mockup-frame">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2 pb-2 border-b border-slate-200">
                  <span className="font-mono">Traversal Depth</span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-medium">Transitive N=3</span>
                </div>
                <div className="flex items-center justify-around py-3 bg-white rounded border border-slate-100">
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">Direct</div>
                    <div className="text-xs text-amber-600 font-semibold">4 callers</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">Transitive</div>
                    <div className="text-xs text-rose-600 font-semibold">12 callers</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">APIs</div>
                    <div className="text-xs text-purple-600 font-semibold">3 routes</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="feature-large-card">
              <div>
                <div className="feature-card-pill">
                  <Activity size={12} />
                  <span>CHANGE SIMULATION</span>
                </div>
                <h3>Simulate signature mutations before editing code</h3>
                <p>
                  Test the hypothetical impact of parameter edits, return type shifts, symbol renames, or deletions without touching your Git working tree.
                </p>
              </div>

              <div className="feature-mockup-frame">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2 pb-2 border-b border-slate-200">
                  <span className="font-mono">Mutation Mode</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-medium">Active</span>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Change parameters</span>
                  <span className="text-[11px] text-amber-600 font-mono">High Impact Risk</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                  Evaluates argument counts, signature mismatches, and call-site compatibility.
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="feature-large-card">
              <div>
                <div className="feature-card-pill">
                  <Sparkles size={12} />
                  <span>GEMINI AI REVIEW</span>
                </div>
                <h3>Grounded risk assessment with zero hallucinations</h3>
                <p>
                  Gemini analyzes verified mathematical graph results, distilling complex call trees into clear, actionable advice for PR reviewers.
                </p>
              </div>

              <div className="feature-mockup-frame">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2 pb-2 border-b border-slate-200">
                  <span className="font-mono">Gemini 2.5 Flash</span>
                  <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-medium">Grounded</span>
                </div>
                <div className="p-2 bg-slate-900 text-slate-100 rounded text-[11px] leading-relaxed font-mono">
                  “Reviewing callers: 2 public HTTP endpoints at risk. Add fallback adapter to preserve backward compatibility.”
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="faq-section">
          <div className="section-header-center">
            <div className="section-icon-badge">
              <Cpu size={13} />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </div>
            <h2>Everything You Need to Know</h2>
            <p>
              Common questions about AST parsing, language support, privacy, and team workflows.
            </p>
          </div>

          <div className="faq-accordion-wrap">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="faq-card-item">
                  <button
                    className="faq-trigger"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-amber-600" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="faq-content">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Call To Action (CTA) Section */}
        <section className="cta-section">
          <div className="cta-banner">
            <h2>Know Your Blast Radius Today.</h2>
            <p>
              Stop guessing what breaks. Enter any public GitHub repository to map your dependency call graph in seconds.
            </p>

            <form onSubmit={handleCtaSubmit} className="cta-input-box">
              <FolderGit2 size={16} className="text-slate-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="owner/repository or GitHub URL (e.g. expressjs/express)"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
              />
              <button type="submit">
                Analyze Now →
              </button>
            </form>

            <div className="cta-presets">
              <span>Try popular repositories:</span>
              <button
                type="button"
                className="cta-preset-tag"
                onClick={() => handleLaunch("expressjs/express")}
              >
                expressjs/express
              </button>
              <button
                type="button"
                className="cta-preset-tag"
                onClick={() => handleLaunch("trpc/trpc")}
              >
                trpc/trpc
              </button>
              <button
                type="button"
                className="cta-preset-tag"
                onClick={() => handleLaunch("colinhacks/zod")}
              >
                colinhacks/zod
              </button>
            </div>
          </div>
        </section>

        {/* Minimalist Footer */}
        <footer className="landing-footer">
          <div className="footer-brand-lockup">
            <div className="brand-mark" style={{ width: "24px", height: "24px", borderRadius: "7px" }}>
              <Zap size={13} fill="currentColor" />
            </div>
            <div>
              <div className="landing-brand-name" style={{ fontSize: "15px" }}>
                blast<span>radius</span>
              </div>
              <div className="footer-tagline">
                Dependency intelligence for safer refactors.
              </div>
            </div>
          </div>

          <ul className="footer-nav-links">
            <li><a href="#problem">Problem</a></li>
            <li><a href="#solution">Solution</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li>
              <a
                href="https://github.com/Shubhamm-02/BlastRadius"
                target="_blank"
                rel="noreferrer"
              >
                GitHub Source
              </a>
            </li>
          </ul>

          <div className="footer-live-status">
            <span className="footer-live-dot" />
            <span>Graph Engine Online</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
