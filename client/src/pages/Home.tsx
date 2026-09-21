import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  FileCode2,
  Github,
  Layers3,
  Loader2,
  Minus,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { ChangeType, FunctionNode, GraphLink, ImpactResult, ProjectGraph } from "../../../server/analysis";

type ViewMode = "blast" | "full";
const accents = ["#ffb449", "#75d8ff", "#c8a6ff", "#73e5b2", "#ff7d92"];
const changeOptions: Array<{ value: ChangeType; label: string }> = [
  { value: "modify_implementation", label: "Modify implementation" },
  { value: "change_parameters", label: "Change parameters" },
  { value: "change_return_type", label: "Change return type" },
  { value: "rename", label: "Rename function" },
  { value: "remove", label: "Remove function" },
];

function shortFile(file: string) { return file.split("/").slice(-2).join("/"); }
function isFunction(node: FunctionNode) { return node.label === "Function" || ["function", "method", "route", "handler", "job", "utility"].includes(node.kind); }

interface NodePos {
  x: number;
  y: number;
}

interface NodeKindMeta {
  tag: string;
  category: string;
  accentColor: string;
  bgLight: string;
  tagWidth: number;
}

function getNodeKindMeta(node: FunctionNode): NodeKindMeta {
  const file = node.file.toLowerCase();
  const name = node.name.toLowerCase();
  const kind = (node.kind || "").toLowerCase();

  if (kind === "route" || file.includes("routes/") || file.includes("api/") || file.includes("controller")) {
    return { tag: "ROUTE", category: "API Route", accentColor: "#38bdf8", bgLight: "rgba(56, 189, 248, 0.16)", tagWidth: 44 };
  }
  if (file.includes("db/") || file.includes("model") || file.includes("repository") || file.includes("queries")) {
    return { tag: "DB OP", category: "Database Operation", accentColor: "#34d399", bgLight: "rgba(52, 211, 153, 0.16)", tagWidth: 42 };
  }
  if (name.includes("risk") || name.includes("auth") || name.includes("token") || name.includes("perm") || file.includes("risk") || file.includes("auth")) {
    return { tag: "SECURITY", category: "Auth & Risk Control", accentColor: "#fbbf24", bgLight: "rgba(251, 191, 36, 0.16)", tagWidth: 54 };
  }
  if (kind === "job" || file.includes("jobs/") || file.includes("worker") || file.includes("cron")) {
    return { tag: "WORKER", category: "Background Task", accentColor: "#fb7185", bgLight: "rgba(251, 113, 133, 0.16)", tagWidth: 52 };
  }
  if (kind === "handler" || file.includes("ui/") || file.includes("components/")) {
    return { tag: "HANDLER", category: "UI Event Handler", accentColor: "#818cf8", bgLight: "rgba(129, 140, 248, 0.16)", tagWidth: 52 };
  }
  if (file.includes("services/") || file.includes("service")) {
    return { tag: "SERVICE", category: "Domain Service", accentColor: "#c084fc", bgLight: "rgba(192, 132, 252, 0.16)", tagWidth: 50 };
  }
  return { tag: "UTIL", category: "Utility Function", accentColor: "#94a3b8", bgLight: "rgba(148, 163, 184, 0.16)", tagWidth: 36 };
}

interface GraphCanvasProps {
  graph: ProjectGraph;
  selectedId: string | null;
  affectedIds: Set<string>;
  viewMode: ViewMode;
  onSelect: (id: string) => void;
  onToggleViewMode: (mode: ViewMode) => void;
  selectedNodeName?: string;
}

function GraphCanvas({
  graph,
  selectedId,
  affectedIds,
  viewMode,
  onSelect,
  onToggleViewMode,
  selectedNodeName,
}: GraphCanvasProps) {
  const width = 1180;
  const height = 620;
  const centerX = width / 2;
  const centerY = height / 2;
  const CARD_W = 186;
  const CARD_H = 58;

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState("");

  // Manual draggable positions
  const [customPositions, setCustomPositions] = useState<Map<string, NodePos>>(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
    hasMoved: boolean;
  } | null>(null);

  // Clear manual positions when repository changes
  useEffect(() => {
    setCustomPositions(new Map());
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [graph.slug]);

  // Direct callers and callees for the selected node
  const directCallers = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(graph.links.filter((l) => l.to === selectedId).map((l) => l.from));
  }, [graph.links, selectedId]);

  const directCallees = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(graph.links.filter((l) => l.from === selectedId).map((l) => l.to));
  }, [graph.links, selectedId]);

  // Transitive affected nodes
  const transitiveAffected = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const res = new Set<string>();
    affectedIds.forEach((id) => {
      if (id !== selectedId && !directCallers.has(id) && !directCallees.has(id)) {
        res.add(id);
      }
    });
    return res;
  }, [affectedIds, directCallees, directCallers, selectedId]);

  // Calculate default deterministic positions
  const defaultPositions = useMemo(() => {
    const pos = new Map<string, NodePos>();
    const allNodes = graph.nodes;
    if (allNodes.length === 0) return pos;

    if (viewMode === "blast" && selectedId) {
      // 1. Center the selected node
      pos.set(selectedId, { x: centerX, y: centerY - 15 });

      // 2. Direct callers on the left (x = centerX - 260)
      const callersArr = Array.from(directCallers);
      callersArr.forEach((id, idx) => {
        const total = callersArr.length;
        const spread = (idx - (total - 1) / 2) * Math.min(74, 460 / Math.max(1, total));
        pos.set(id, { x: centerX - 260, y: centerY - 15 + spread });
      });

      // 3. Direct callees on the right (x = centerX + 260)
      const calleesArr = Array.from(directCallees);
      calleesArr.forEach((id, idx) => {
        const total = calleesArr.length;
        const spread = (idx - (total - 1) / 2) * Math.min(74, 460 / Math.max(1, total));
        pos.set(id, { x: centerX + 260, y: centerY - 15 + spread });
      });

      // 4. Transitive affected nodes further left (x = centerX - 470)
      const transArr = Array.from(transitiveAffected);
      transArr.forEach((id, idx) => {
        const total = transArr.length;
        const spread = (idx - (total - 1) / 2) * Math.min(72, 460 / Math.max(1, total));
        pos.set(id, { x: centerX - 470, y: centerY - 15 + spread });
      });

      // 5. Unrelated nodes arranged neatly along the bottom tray so the blast flow remains clean
      const placed = new Set([selectedId, ...callersArr, ...calleesArr, ...transArr]);
      const unrelated = allNodes.filter((n) => !placed.has(n.id));
      unrelated.forEach((node, idx) => {
        const total = unrelated.length;
        const xStep = (width - 240) / Math.max(1, total - 1);
        const xPos = total === 1 ? centerX : 120 + idx * xStep;
        pos.set(node.id, { x: xPos, y: height - 32 });
      });
    } else {
      // Full graph mode: 4 clean architectural tiers based on in/out degrees & roles
      const inDeg = new Map<string, number>();
      const outDeg = new Map<string, number>();
      allNodes.forEach((n) => {
        inDeg.set(n.id, 0);
        outDeg.set(n.id, 0);
      });
      graph.links.forEach((l) => {
        outDeg.set(l.from, (outDeg.get(l.from) || 0) + 1);
        inDeg.set(l.to, (inDeg.get(l.to) || 0) + 1);
      });

      const tier0: string[] = []; // Routes & Handlers & Root callers
      const tier1: string[] = []; // Core Services
      const tier2: string[] = []; // Domain Modules
      const tier3: string[] = []; // Leaf callees & Utilities

      allNodes.forEach((n) => {
        const i = inDeg.get(n.id) || 0;
        const o = outDeg.get(n.id) || 0;
        const kind = (n.kind || "").toLowerCase();
        const file = n.file.toLowerCase();

        if (kind === "route" || kind === "handler" || file.includes("routes/") || (i === 0 && o > 0)) {
          tier0.push(n.id);
        } else if (kind === "job" || (o === 0 && i > 0) || file.includes("db/") || kind === "utility") {
          tier3.push(n.id);
        } else if (o > i) {
          tier1.push(n.id);
        } else {
          tier2.push(n.id);
        }
      });

      const assignColumn = (nodes: string[], xCol: number) => {
        const total = nodes.length;
        nodes.forEach((id, idx) => {
          const spread = (idx - (total - 1) / 2) * Math.min(74, 500 / Math.max(1, total));
          pos.set(id, { x: xCol, y: centerY + spread });
        });
      };

      assignColumn(tier0, 155);
      assignColumn(tier1, 445);
      assignColumn(tier2, 735);
      assignColumn(tier3, 1025);
    }

    return pos;
  }, [centerX, centerY, directCallees, directCallers, graph.links, graph.nodes, height, selectedId, transitiveAffected, viewMode, width]);

  // Helper to get active position (custom or default)
  const getNodePos = useCallback((id: string): NodePos => {
    return customPositions.get(id) || defaultPositions.get(id) || { x: centerX, y: centerY };
  }, [centerX, centerY, customPositions, defaultPositions]);

  // Window mouse event listeners for smooth dragging and panning with rAF throttling
  useEffect(() => {
    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current && !isPanning) return;
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (dragRef.current) {
          const dx = (e.clientX - dragRef.current.startMouseX) / zoom;
          const dy = (e.clientY - dragRef.current.startMouseY) / zoom;
          if (Math.hypot(dx, dy) > 4) {
            dragRef.current.hasMoved = true;
          }
          const newX = dragRef.current.startNodeX + dx;
          const newY = dragRef.current.startNodeY + dy;
          const targetId = dragRef.current.nodeId;
          setCustomPositions((prev) => {
            const next = new Map(prev);
            next.set(targetId, { x: newX, y: newY });
            return next;
          });
        } else if (isPanning) {
          setPan({
            x: e.clientX - panStartRef.current.x,
            y: e.clientY - panStartRef.current.y,
          });
        }
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (dragRef.current) {
        if (!dragRef.current.hasMoved) {
          onSelect(dragRef.current.nodeId);
        }
        dragRef.current = null;
        setDraggingNodeId(null);
      }
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, onSelect, zoom]);

  // Canvas background mousedown (start panning)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  // Node mousedown (start dragging)
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const currentPos = getNodePos(nodeId);
    dragRef.current = {
      nodeId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: currentPos.x,
      startNodeY: currentPos.y,
      hasMoved: false,
    };
    setDraggingNodeId(nodeId);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setZoom((z) => Math.min(2.5, Math.max(0.4, Number((z + delta).toFixed(2)))));
  };

  // Toolbar controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
  const handleFit = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };
  const handleReset = () => {
    setCustomPositions(new Map());
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSpotlight("");
  };

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return graph.nodes.find((n) => n.id === hoveredNodeId) ?? null;
  }, [graph.nodes, hoveredNodeId]);

  return (
    <>
      <div className="graph-toolbar">
        <div>
          <span className="panel-kicker">CALL GRAPH</span>
          <h2>
            {viewMode === "blast" && selectedNodeName
              ? `Blast radius: ${selectedNodeName}`
              : "Full repository architecture"}
          </h2>
        </div>
        <div className="graph-toolbar-actions">
          <div className="graph-spotlight-wrap" title="Highlight nodes matching name or file">
            <Search size={12} />
            <input
              value={spotlight}
              onChange={(e) => setSpotlight(e.target.value)}
              placeholder="Highlight nodes…"
              aria-label="Highlight nodes"
            />
            {spotlight && (
              <button
                onClick={() => setSpotlight("")}
                style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}
                title="Clear filter"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div className="view-toggle">
            <button
              className={viewMode === "blast" ? "active" : ""}
              onClick={() => onToggleViewMode("blast")}
            >
              <CircleDot size={13} /> blast radius
            </button>
            <button
              className={viewMode === "full" ? "active" : ""}
              onClick={() => onToggleViewMode("full")}
            >
              <Network size={13} /> full graph
            </button>
          </div>

          <div className="graph-controls-group">
            <button className="graph-control-btn" title="Zoom out" onClick={handleZoomOut} aria-label="Zoom out">
              <Minus size={13} />
            </button>
            <button className="graph-control-btn" title="Zoom in" onClick={handleZoomIn} aria-label="Zoom in">
              <Plus size={13} />
            </button>
            <div className="graph-control-sep" />
            <button className="graph-control-btn" title="Fit to view" onClick={handleFit} aria-label="Fit to viewport">
              Fit
            </button>
            <button className="graph-control-btn" title="Reset layout" onClick={handleReset} aria-label="Reset layout">
              Reset
            </button>
          </div>
        </div>
      </div>

      <div
        className="graph-canvas"
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        aria-label="Interactive function call graph"
      >
        <div className="graph-grid" />

        <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} role="img">
          <defs>
            <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7 Z" fill="#3b526d" />
            </marker>
            <marker id="arrow-amber" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7 Z" fill="#ffb449" />
            </marker>
            <marker id="arrow-cyan" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7 Z" fill="#38bdf8" />
            </marker>
            <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7 Z" fill="#34d399" />
            </marker>
            <marker id="arrow-danger" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7 Z" fill="#fb7185" />
            </marker>
            <marker id="arrow-quiet" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7 Z" fill="#1b2a3d" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Architectural Swimlanes / Stage Guides in Background */}
            {viewMode === "blast" && selectedId && (
              <g className="swimlanes">
                {/* Upstream Callers Lane */}
                <rect
                  x={20}
                  y={22}
                  width={430}
                  height={height - 90}
                  rx="12"
                  fill="rgba(56, 189, 248, 0.02)"
                  stroke="rgba(56, 189, 248, 0.12)"
                  strokeDasharray="5 5"
                  className="swimlane-rect"
                />
                <text x={35} y={44} fill="#38bdf8" fontSize="10" fontWeight="700" letterSpacing="0.1em" className="swimlane-title">
                  UPSTREAM BLAST RADIUS (AFFECTED CALLERS)
                </text>
                <text x={35} y={58} fill="#546b86" fontSize="8.5" className="swimlane-desc">
                  Functions broken if signature or return type changes
                </text>

                {/* Center Target Lane */}
                <rect
                  x={490}
                  y={22}
                  width={200}
                  height={height - 90}
                  rx="12"
                  fill="rgba(255, 180, 73, 0.03)"
                  stroke="rgba(255, 180, 73, 0.22)"
                  strokeDasharray="5 5"
                  className="swimlane-rect"
                />
                <text x={590} y={44} textAnchor="middle" fill="var(--amber)" fontSize="10" fontWeight="700" letterSpacing="0.1em" className="swimlane-title">
                  ORIGIN / TARGET
                </text>
                <text x={590} y={58} textAnchor="middle" fill="#717f91" fontSize="8.5" className="swimlane-desc">
                  Refactor candidate
                </text>

                {/* Downstream Callees Lane */}
                <rect
                  x={730}
                  y={22}
                  width={430}
                  height={height - 90}
                  rx="12"
                  fill="rgba(52, 211, 153, 0.02)"
                  stroke="rgba(52, 211, 153, 0.12)"
                  strokeDasharray="5 5"
                  className="swimlane-rect"
                />
                <text x={745} y={44} fill="#34d399" fontSize="10" fontWeight="700" letterSpacing="0.1em" className="swimlane-title">
                  DOWNSTREAM CALLEES (DEPENDENCIES)
                </text>
                <text x={745} y={58} fill="#546b86" fontSize="8.5" className="swimlane-desc">
                  Internal subroutines called by the target
                </text>

                {/* Unrelated Nodes Bottom Tray */}
                <rect
                  x={20}
                  y={height - 56}
                  width={width - 40}
                  height={48}
                  rx="8"
                  fill="rgba(255, 255, 255, 0.015)"
                  stroke="rgba(255, 255, 255, 0.05)"
                />
                <text x={35} y={height - 28} fill="#475569" fontSize="8.5" fontWeight="600" letterSpacing="0.06em">
                  OTHER REPOSITORY FUNCTIONS (CLICK ANY CARD TO FOCUS)
                </text>
              </g>
            )}

            {viewMode === "full" && (
              <g className="swimlanes">
                <rect x={30} y={22} width={250} height={height - 44} rx="12" fill="rgba(56,189,248,0.015)" stroke="rgba(56,189,248,0.08)" strokeDasharray="5 5" />
                <text x={45} y={44} fill="#38bdf8" fontSize="10" fontWeight="700" letterSpacing="0.08em">1. ENTRYPOINTS & ROUTES</text>
                <text x={45} y={58} fill="#546b86" fontSize="8.5">Public HTTP endpoints & event handlers</text>

                <rect x={320} y={22} width={250} height={height - 44} rx="12" fill="rgba(192,132,252,0.015)" stroke="rgba(192,132,252,0.08)" strokeDasharray="5 5" />
                <text x={335} y={44} fill="#c084fc" fontSize="10" fontWeight="700" letterSpacing="0.08em">2. CORE SERVICES</text>
                <text x={335} y={58} fill="#546b86" fontSize="8.5">Business domain orchestrators</text>

                <rect x={610} y={22} width={250} height={height - 44} rx="12" fill="rgba(129,140,248,0.015)" stroke="rgba(129,140,248,0.08)" strokeDasharray="5 5" />
                <text x={625} y={44} fill="#818cf8" fontSize="10" fontWeight="700" letterSpacing="0.08em">3. DOMAIN MODULES</text>
                <text x={625} y={58} fill="#546b86" fontSize="8.5">Specialized helpers & security</text>

                <rect x={900} y={22} width={250} height={height - 44} rx="12" fill="rgba(52,211,153,0.015)" stroke="rgba(52,211,153,0.08)" strokeDasharray="5 5" />
                <text x={915} y={44} fill="#34d399" fontSize="10" fontWeight="700" letterSpacing="0.08em">4. DATA & STORAGE</text>
                <text x={915} y={58} fill="#546b86" fontSize="8.5">Database access & utilities</text>
              </g>
            )}

            {/* Smooth Bézier Curved Dependency Connectors */}
            {graph.links.map((link) => {
              const srcPos = getNodePos(link.from);
              const tgtPos = getNodePos(link.to);
              if (!srcPos || !tgtPos) return null;

              const isDirectCall = link.from === selectedId || link.to === selectedId;
              const isAffectedLink = affectedIds.has(link.from) && affectedIds.has(link.to);
              const isHoveredLink = hoveredNodeId && (link.from === hoveredNodeId || link.to === hoveredNodeId);

              const isQuiet =
                viewMode === "blast" &&
                selectedId &&
                !isDirectCall &&
                !affectedIds.has(link.from) &&
                !affectedIds.has(link.to);

              let x1: number, y1: number, x2: number, y2: number;
              let pathD: string;

              if (tgtPos.x > srcPos.x + 30) {
                // Left-to-right flow
                x1 = srcPos.x + CARD_W / 2;
                y1 = srcPos.y;
                x2 = tgtPos.x - CARD_W / 2;
                y2 = tgtPos.y;
                const dx = Math.abs(x2 - x1);
                const curvature = Math.max(30, dx * 0.45);
                pathD = `M ${x1} ${y1} C ${x1 + curvature} ${y1}, ${x2 - curvature} ${y2}, ${x2} ${y2}`;
              } else if (tgtPos.x < srcPos.x - 30) {
                // Right-to-left backward call
                x1 = srcPos.x - CARD_W / 2;
                y1 = srcPos.y;
                x2 = tgtPos.x + CARD_W / 2;
                y2 = tgtPos.y;
                const dx = Math.abs(x2 - x1);
                const curvature = Math.max(30, dx * 0.45);
                pathD = `M ${x1} ${y1} C ${x1 - curvature} ${y1}, ${x2 + curvature} ${y2}, ${x2} ${y2}`;
              } else {
                // Same column loop
                x1 = srcPos.x + CARD_W / 2;
                y1 = srcPos.y;
                x2 = tgtPos.x + CARD_W / 2;
                y2 = tgtPos.y;
                const dy = Math.abs(y2 - y1);
                const loopWidth = Math.max(35, Math.min(65, dy * 0.45));
                pathD = `M ${x1} ${y1} C ${x1 + loopWidth} ${y1}, ${x2 + loopWidth} ${y2}, ${x2} ${y2}`;
              }

              let linkClass = "graph-link";
              let markerId = "url(#arrow-default)";
              let streamClass = "";

              if (isDirectCall) {
                linkClass += " active";
                markerId = "url(#arrow-amber)";
                streamClass = "flow-stream";
              } else if (isAffectedLink) {
                linkClass += " affected-path";
                markerId = "url(#arrow-cyan)";
                streamClass = "flow-stream cyan-stream";
              } else if (link.from === selectedId) {
                linkClass += " callee-path";
                markerId = "url(#arrow-green)";
              } else if (transitiveAffected.has(link.from) || transitiveAffected.has(link.to)) {
                linkClass += " transitive-path";
                markerId = "url(#arrow-danger)";
                streamClass = "flow-stream danger-stream";
              } else if (isQuiet) {
                linkClass += " quiet";
                markerId = "url(#arrow-quiet)";
              }

              return (
                <g key={`${link.from}->${link.to}`}>
                  <path
                    d={pathD}
                    className={linkClass}
                    markerEnd={markerId}
                    style={isHoveredLink ? { stroke: "var(--amber)", strokeWidth: 2.2, strokeOpacity: 1 } : undefined}
                  />
                  {streamClass && !isQuiet && (
                    <path d={pathD} className={streamClass} />
                  )}
                </g>
              );
            })}

            {/* Professional Interactive Node Cards */}
            {graph.nodes.map((node) => {
              const pos = getNodePos(node.id);
              if (!pos) return null;

              const isSelected = node.id === selectedId;
              const isAffected = affectedIds.has(node.id);
              const isCaller = directCallers.has(node.id);
              const isCallee = directCallees.has(node.id);
              const isTransitive = transitiveAffected.has(node.id);
              const isDragging = draggingNodeId === node.id;

              const isQuiet =
                viewMode === "blast" &&
                selectedId !== null &&
                !isSelected &&
                !isAffected &&
                !isCaller &&
                !isCallee;

              const meta = getNodeKindMeta(node);
              const isMatchSpotlight = spotlight
                ? node.name.toLowerCase().includes(spotlight.toLowerCase()) || node.file.toLowerCase().includes(spotlight.toLowerCase())
                : true;

              let borderColor = "rgba(165, 183, 208, 0.16)";
              let statusBadge: { label: string; bg: string; color: string; width: number } | null = null;

              if (isSelected) {
                borderColor = "#ffb449";
                statusBadge = { label: "TARGET", bg: "rgba(255, 180, 73, 0.22)", color: "#ffb449", width: 48 };
              } else if (isCaller) {
                borderColor = "#38bdf8";
                statusBadge = { label: "CALLER", bg: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", width: 48 };
              } else if (isCallee) {
                borderColor = "#34d399";
                statusBadge = { label: "CALLEE", bg: "rgba(52, 211, 153, 0.2)", color: "#34d399", width: 48 };
              } else if (isTransitive) {
                borderColor = "#fb7185";
                statusBadge = { label: "AFFECTED", bg: "rgba(251, 113, 133, 0.2)", color: "#fb7185", width: 56 };
              }

              const truncatedName = node.name.length > 21 ? `${node.name.slice(0, 19)}…` : node.name;

              return (
                <g
                  key={node.id}
                  className={`graph-node-card ${isSelected ? "is-selected" : ""} ${isCaller ? "is-caller" : ""} ${isCallee ? "is-callee" : ""} ${isTransitive ? "is-transitive" : ""} ${isQuiet || !isMatchSpotlight ? "is-quiet" : ""} ${isDragging ? "is-dragging" : ""}`}
                  transform={`translate(${pos.x - CARD_W / 2} ${pos.y - CARD_H / 2})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Function ${node.name}`}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(node.id)}
                >
                  {/* Selected Halo Pulse */}
                  {isSelected && (
                    <rect
                      x="-5"
                      y="-5"
                      width={CARD_W + 10}
                      height={CARD_H + 10}
                      rx="13"
                      className="card-glow-halo"
                    />
                  )}

                  {/* Card Base Container */}
                  <rect
                    width={CARD_W}
                    height={CARD_H}
                    rx="9"
                    className="card-base"
                    stroke={borderColor}
                    strokeWidth={isSelected ? 2 : isCaller || isCallee || isTransitive ? 1.5 : 1}
                  />

                  {/* Left Category Accent Strip */}
                  <rect
                    x="0"
                    y="0"
                    width="4"
                    height={CARD_H}
                    rx="2"
                    fill={meta.accentColor}
                  />

                  {/* Category Pill on Top Left */}
                  <rect
                    x="10"
                    y="8"
                    width={meta.tagWidth}
                    height="14"
                    rx="3"
                    fill={meta.accentColor}
                    fillOpacity="0.16"
                  />
                  <text
                    x={10 + meta.tagWidth / 2}
                    y="18.5"
                    textAnchor="middle"
                    fill={meta.accentColor}
                    fontSize="8"
                    fontWeight="700"
                    letterSpacing="0.06em"
                  >
                    {meta.tag}
                  </text>

                  {/* Status Badge on Top Right */}
                  {statusBadge && (
                    <>
                      <rect
                        x={CARD_W - 10 - statusBadge.width}
                        y="8"
                        width={statusBadge.width}
                        height="14"
                        rx="3"
                        fill={statusBadge.bg}
                      />
                      <text
                        x={CARD_W - 10 - statusBadge.width / 2}
                        y="18.5"
                        textAnchor="middle"
                        fill={statusBadge.color}
                        fontSize="7.5"
                        fontWeight="700"
                        letterSpacing="0.05em"
                      >
                        {statusBadge.label}
                      </text>
                    </>
                  )}

                  {/* Function Symbol Name */}
                  <text
                    x="12"
                    y="36"
                    className="card-title"
                    fontSize="12"
                    fontWeight="600"
                    fill={isSelected ? "var(--amber)" : "#f8fafc"}
                  >
                    {truncatedName}
                  </text>

                  {/* File & Line subtitle */}
                  <text
                    x="12"
                    y="49"
                    className="card-subtitle"
                    fontSize="9"
                    fill="#64748b"
                  >
                    {shortFile(node.file)}:{node.line}
                  </text>

                  {/* Left Input Port */}
                  <circle
                    cx="0"
                    cy={CARD_H / 2}
                    r="3.5"
                    className="port-dot"
                    fill={isAffected ? "#38bdf8" : "#475569"}
                  />

                  {/* Right Output Port */}
                  <circle
                    cx={CARD_W}
                    cy={CARD_H / 2}
                    r="3.5"
                    className="port-dot"
                    fill={isSelected ? "var(--amber)" : "#475569"}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover Inspector HUD Micro-Card */}
        {hoveredNode && (
          <div
            className="graph-hover-hud"
            style={{
              left: Math.min(
                width - 270,
                Math.max(20, getNodePos(hoveredNode.id).x * zoom + pan.x - 100)
              ),
              top: Math.max(16, getNodePos(hoveredNode.id).y * zoom + pan.y - 120),
            }}
          >
            <div className="hud-header">
              <span className="hud-tag" style={{ color: getNodeKindMeta(hoveredNode).accentColor }}>
                {getNodeKindMeta(hoveredNode).category}
              </span>
              <span className="hud-status">
                {hoveredNode.id === selectedId
                  ? "Target Origin"
                  : directCallers.has(hoveredNode.id)
                  ? "Direct Caller"
                  : directCallees.has(hoveredNode.id)
                  ? "Direct Callee"
                  : affectedIds.has(hoveredNode.id)
                  ? "In Blast Radius"
                  : "Unaffected"}
              </span>
            </div>
            <div className="hud-title">{hoveredNode.name}()</div>
            <div className="hud-file">{hoveredNode.file}:{hoveredNode.line}</div>
            <div className="hud-stats">
              <span>
                <strong>{graph.links.filter((l) => l.to === hoveredNode.id).length}</strong> callers
              </span>
              <span>•</span>
              <span>
                <strong>{graph.links.filter((l) => l.from === hoveredNode.id).length}</strong> callees
              </span>
              {affectedIds.has(hoveredNode.id) && (
                <span className="hud-danger-badge">Impacted</span>
              )}
            </div>
          </div>
        )}

        {graph.nodes.length === 0 && (
          <div className="graph-empty">
            <Network size={30} />
            <strong>No graph nodes found</strong>
            <span>Analyze a repository or upload a folder to populate the graph.</span>
          </div>
        )}

        <div className="graph-legend">
          <span><i className="legend-dot selected-dot" /> Target</span>
          <span><i className="legend-dot affected-dot" /> Caller (Impacted)</span>
          <span><i className="legend-dot callee-dot" /> Callee</span>
          <span><i className="legend-dot idle-dot" /> Neutral</span>
        </div>

        <div className="graph-hud">
          <span><CircleDot size={13} /> {graph.nodes.length} nodes</span>
          <span><ArrowUpRight size={13} /> {graph.links.length} relationships</span>
        </div>
      </div>
    </>
  );
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="stat-pill">
      <div className="stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function emptyImpact(selectedId: string, changeType: ChangeType): ImpactResult {
  return {
    selectedId,
    selected: null,
    changeType,
    directCallers: [],
    directCallees: [],
    directImpactIds: [],
    transitiveImpactIds: [],
    affectedIds: [],
    affectedFunctions: [],
    affectedFiles: [],
    affectedClasses: [],
    affectedApis: [],
    affectedDatabases: [],
    affectedTests: [],
    impactPaths: [],
    riskFactors: {
      affectedFunctions: 0,
      affectedFiles: 0,
      dependencyDepth: 0,
      fanIn: 0,
      fanOut: 0,
      apiExposure: 0,
      databaseUsage: 0,
      testRelationships: 0,
      testCoverageRatio: 0,
    },
    before: { nodes: [], links: [], note: "" },
    after: { nodes: [], links: [], note: "" },
    noTestsDetected: true,
    totals: { functions: 0, files: 0, classes: 0, apis: 0, databases: 0, tests: 0 },
    deterministicSummary: "",
  };
}

function ImpactList({ nodes, onFocus, empty }: { nodes: FunctionNode[]; onFocus: (id: string) => void; empty: string }) {
  return (
    <div className="affected-list">
      {nodes.slice(0, 8).map((node) => (
        <button key={node.id} onClick={() => onFocus(node.id)}>
          <span className="caller-dot" />
          <span>
            <strong>{node.name}</strong>
            <small>{shortFile(node.file)} · {node.label}</small>
          </span>
          <ArrowDownRight size={14} />
        </button>
      ))}
      {!nodes.length && <span className="no-callers">{empty}</span>}
    </div>
  );
}

function ImpactDetails({ result, onFocus }: { result: ImpactResult; onFocus: (id: string) => void }) {
  const [pathId, setPathId] = useState<string | null>(result.impactPaths[0]?.id ?? null);
  useEffect(() => { setPathId(result.impactPaths[0]?.id ?? null); }, [result.impactPaths]);
  const activePath = result.impactPaths.find((path) => path.id === pathId) ?? result.impactPaths[0] ?? null;
  const factors = result.riskFactors;

  return (
    <>
      <div className="impact-section">
        <div className="section-title">
          <span>Direct impact</span>
          <span className="muted-count">{result.directCallers.length} callers · {result.directCallees.length} callees</span>
        </div>
        <div className="impact-dual">
          <div>
            <small>DIRECT CALLERS</small>
            <ImpactList nodes={result.directCallers} onFocus={onFocus} empty="No direct callers detected." />
          </div>
          <div>
            <small>DIRECT CALLEES</small>
            <ImpactList nodes={result.directCallees} onFocus={onFocus} empty="No direct callees detected." />
          </div>
        </div>
      </div>

      <div className="impact-section">
        <div className="section-title">
          <span>Transitive impact</span>
          <span className="muted-count">{result.transitiveImpactIds.length} nodes</span>
        </div>
        <p>All upstream functions reached by the Neo4j <code>CALLS*</code> traversal, beyond the direct caller boundary.</p>
        <ImpactList
          nodes={result.affectedFunctions.filter((node) => result.transitiveImpactIds.includes(node.id))}
          onFocus={onFocus}
          empty="No transitive callers detected."
        />
      </div>

      <div className="impact-section">
        <div className="section-title">
          <span>Impact path</span>
          <span className="muted-count">{result.impactPaths.length}</span>
        </div>
        {result.impactPaths.length ? (
          <>
            <div className="path-list">
              {result.impactPaths.slice(0, 5).map((path) => (
                <button
                  key={path.id}
                  className={path.id === (activePath?.id ?? pathId) ? "active" : ""}
                  onClick={() => setPathId(path.id)}
                  title={path.label}
                >
                  {path.label || path.nodes.map((n) => n.name).join(" → ") || `Path ${path.id}`}
                </button>
              ))}
            </div>
            {activePath && activePath.nodes && activePath.nodes.length > 0 && (
              <div className="path-detail">
                <span>WHY AFFECTED</span>
                <div>
                  {activePath.nodes.map((node, index) => (
                    <span key={node.id || index}>
                      <button onClick={() => onFocus(node.id)}>{node.name || "Unknown"}</button>
                      {index < activePath.nodes.length - 1 && <b>→</b>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <span className="no-callers">No transitive path was detected.</span>
        )}
      </div>

      <div className="impact-section">
        <div className="section-title">
          <span>Surface area</span>
          <span className="muted-count">{result.totals.files + result.totals.classes + result.totals.apis + result.totals.databases}</span>
        </div>
        <div className="surface-grid">
          <span><strong>{result.totals.files}</strong>files</span>
          <span><strong>{result.totals.classes}</strong>classes</span>
          <span><strong>{result.totals.apis}</strong>APIs</span>
          <span><strong>{result.totals.databases}</strong>DB ops</span>
        </div>
      </div>

      <div className="impact-section">
        <div className="section-title">
          <span>Test impact</span>
          <span className={result.noTestsDetected ? "warning-pill" : "success-pill"}>
            {result.noTestsDetected ? "none detected" : `${result.totals.tests} rerun`}
          </span>
        </div>
        <p>
          {result.noTestsDetected
            ? "No TESTED_BY relationship was detected for the affected functions. Add or verify coverage before shipping."
            : "Recommended tests to rerun after this change:"}
        </p>
        <ImpactList nodes={result.affectedTests} onFocus={onFocus} empty="No connected tests to rerun." />
      </div>

      <div className="impact-section">
        <div className="section-title">
          <span>Why is this risky?</span>
          <span className="warning-pill"><Activity size={12} /> graph facts</span>
        </div>
        <div className="risk-grid">
          <span><strong>{factors.fanIn}</strong>fan-in</span>
          <span><strong>{factors.fanOut}</strong>fan-out</span>
          <span><strong>{factors.dependencyDepth}</strong>depth</span>
          <span><strong>{Math.round(factors.testCoverageRatio * 100)}%</strong>test ratio</span>
          <span><strong>{factors.apiExposure}</strong>API exposure</span>
          <span><strong>{factors.databaseUsage}</strong>DB usage</span>
        </div>
      </div>

      <div className="impact-section">
        <div className="section-title">
          <span>Before vs after</span>
          <span className="muted-count">{result.changeType.replaceAll("_", " ")}</span>
        </div>
        <div className="snapshot-grid">
          <div>
            <small>BEFORE</small>
            <strong>{result.before.nodes.length} nodes</strong>
            <span>{result.before.links.length} relationships</span>
          </div>
          <div>
            <small>AFTER</small>
            <strong>{result.after.nodes.length} nodes</strong>
            <span>{result.after.links.length} relationships</span>
          </div>
        </div>
        <p>{result.after.note}</p>
      </div>

      <div className="run-tests-card">
        <div>
          <Check size={14} />
          <strong>Run tests before shipping</strong>
        </div>
        <p>
          {result.noTestsDetected
            ? "No test relationship is available; run the repository test suite manually."
            : `Rerun ${result.totals.tests} connected test${result.totals.tests === 1 ? "" : "s"} plus any broader suite required by your CI policy.`}
        </p>
      </div>
    </>
  );
}

export default function Home() {
  const [repoInput, setRepoInput] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("blast");
  const [changeType, setChangeType] = useState<ChangeType>("modify_implementation");
  const [mobilePanel, setMobilePanel] = useState<"functions" | "impact" | null>(null);
  const [repositories, setRepositories] = useState<Array<{ id: string; name: string }>>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const initialRepoRef = useRef<boolean>(
    typeof window !== "undefined" && Boolean(new URLSearchParams(window.location.search).get("repo"))
  );

  const demoQuery = trpc.blast.demo.useQuery(undefined, { staleTime: Infinity });
  const analyzeMutation = trpc.blast.analyze.useMutation({
    onSuccess: (data) => {
      initialRepoRef.current = false;
      setProjectId(data.projectId);
      setRepositories((current) => [
        { id: data.projectId, name: data.graph.slug },
        ...current.filter((repo) => repo.id !== data.projectId),
      ]);
      setSelectedId(null);
      setViewMode("blast");
      toast.success(`Mapped ${data.graph.stats.functions} functions from ${data.graph.slug}`);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("repo");
        url.searchParams.set("projectId", data.projectId);
        window.history.replaceState({}, "", url.toString());
      }
    },
    onError: (error) => {
      initialRepoRef.current = false;
      toast.error(error.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("projectId");
    const repoFromUrl = params.get("repo");
    if (fromUrl) {
      setProjectId(fromUrl);
    } else if (repoFromUrl) {
      setRepoInput(repoFromUrl);
      analyzeMutation.mutate({ repo: repoFromUrl });
    }
  }, []);

  useEffect(() => {
    if (initialRepoRef.current && (analyzeMutation.isPending || !analyzeMutation.isError)) {
      return;
    }
    if (!projectId && demoQuery.data?.projectId) {
      setProjectId(demoQuery.data.projectId);
      if (demoQuery.data.graph.slug) {
        setRepositories([{ id: demoQuery.data.projectId, name: demoQuery.data.graph.slug }]);
      }
    }
  }, [demoQuery.data, projectId, analyzeMutation.isPending, analyzeMutation.isError]);

  const graphQuery = trpc.blast.graph.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId), staleTime: Infinity }
  );
  const graph = graphQuery.data ?? demoQuery.data?.graph;

  const simulationQuery = trpc.blast.simulate.useQuery(
    { projectId: projectId ?? "", selectedId: selectedId ?? "", changeType },
    { enabled: Boolean(projectId && selectedId), staleTime: Infinity }
  );
  const simulationResult = simulationQuery.data;
  const affectedIds = useMemo(
    () => new Set<string>(simulationResult?.affectedIds ?? []),
    [simulationResult?.affectedIds]
  );
  const explanationInput = simulationResult ?? emptyImpact(selectedId ?? "", changeType);
  const explanationQuery = trpc.blast.explain.useQuery(
    { result: explanationInput },
    { enabled: Boolean(simulationResult), staleTime: Infinity }
  );
  const selectedNode = graph?.nodes.find((node) => node.id === selectedId);

  const functionNodes = useMemo(() => graph?.nodes.filter(isFunction) ?? [], [graph?.nodes]);
  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    return functionNodes
      .filter((node) => !value || node.name.toLowerCase().includes(value) || node.file.toLowerCase().includes(value))
      .slice(0, 100);
  }, [functionNodes, query]);

  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
    setViewMode("blast");
    setMobilePanel("impact");
  }, []);

  function analyzeRepo() {
    if (!repoInput.trim() || analyzeMutation.isPending) return;
    analyzeMutation.mutate({ repo: repoInput.trim() });
  }

  async function handleFolder(fileList: FileList) {
    try {
      const files = Array.from(fileList).filter(
        (file) => /\.(tsx?|jsx?|mts|cts|mjs|cjs)$/i.test(file.name) && !file.name.endsWith(".d.ts")
      );
      if (!files.length) return toast.error("No TypeScript or JavaScript files found.");
      const sourceFiles = await Promise.all(
        files.slice(0, 160).map(async (file) => ({
          path: file.webkitRelativePath.split("/").slice(1).join("/") || file.name,
          content: await file.text(),
        }))
      );
      analyzeMutation.mutate({
        files: sourceFiles,
        slug: fileList[0]?.webkitRelativePath.split("/")[0] || "uploaded-repo",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the selected folder.");
    }
  }

  if (demoQuery.isLoading || (graphQuery.isLoading && !graph)) {
    return (
      <div className="loading-shell">
        <Loader2 className="spin" size={28} />
        <span>Loading your graph workspace…</span>
      </div>
    );
  }

  if (demoQuery.error || graphQuery.error) {
    return (
      <div className="loading-shell">
        <CircleDot size={28} />
        <strong>Graph unavailable</strong>
        <span>{demoQuery.error?.message || graphQuery.error?.message}</span>
        <button
          className="retry-button"
          onClick={() => {
            void demoQuery.refetch();
            if (projectId) void graphQuery.refetch();
          }}
        >
          Retry analysis
        </button>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="loading-shell">
        <Network size={28} />
        <strong>No repository analyzed</strong>
        <span>Analyze a public repository or upload a local folder to begin.</span>
      </div>
    );
  }

  const totals = simulationResult?.totals ?? { functions: 0, files: 0, classes: 0, apis: 0, databases: 0, tests: 0 };

  return (
    <main className="app-shell">
      {/* Top Bar */}
      <header className="topbar">
        <Link href="/" className="brand-lockup cursor-pointer hover:opacity-90 transition-opacity" title="Back to Landing Page">
          <div className="brand-mark">
            <Zap size={17} fill="currentColor" />
          </div>
          <div>
            <div className="brand-name">
              blast<span>radius</span>
            </div>
            <div className="brand-subtitle">dependency intelligence</div>
          </div>
        </Link>

        <div className="topbar-meta">
          <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-100 text-xs transition-colors" style={{ textTransform: "none", letterSpacing: 0 }}>
            <ArrowLeft size={13} /> Landing Page
          </Link>
          <span className="meta-divider" />
          <span className="live-dot" /> graph engine online
          <span className="meta-divider" />
          <span className="model-chip">
            <Sparkles size={13} /> Gemini assisted
          </span>
        </div>

        <a
          className="github-link"
          href="https://github.com/Shubhamm-02/BlastRadius"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={16} /> source <ArrowUpRight size={13} />
        </a>
      </header>

      {/* Command & Repository Input Row */}
      <section className="command-row">
        <div className="command-copy">
          <span className="eyebrow">CHANGE IMPACT ANALYSIS</span>
          <h1>
            Know what breaks<br />
            <em>before</em> you ship.
          </h1>
          <p>Map your repository into a living call graph. Pick any function to trace its upstream blast radius.</p>
        </div>

        <div className="repo-command">
          <div className="command-label">
            <span>Start with a repository</span>
            <span className="command-hint">⌘ K</span>
          </div>

          <div className="repo-input-wrap">
            <Github size={17} />
            <input
              value={repoInput}
              onChange={(event) => setRepoInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && analyzeRepo()}
              placeholder="owner / repository or GitHub URL"
              aria-label="GitHub repository"
            />
            <button onClick={analyzeRepo} disabled={analyzeMutation.isPending}>
              {analyzeMutation.isPending ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <>
                  <span>Analyze repo</span>
                  <ArrowUpRight size={15} />
                </>
              )}
            </button>
          </div>

          <div className="command-foot">
            <button className="upload-button" onClick={() => folderInputRef.current?.click()}>
              <Upload size={14} /> upload local folder
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) void handleFolder(event.target.files);
                event.target.value = "";
              }}
            />
            <span>{graph.source === "neo4j" ? "Neo4j AuraDB graph active" : "demo fallback · configure Neo4j for persistence"}</span>
          </div>
        </div>
      </section>

      {/* Main Workspace Container */}
      <section className="workspace-shell">
        <div className="workspace-header">
          <div className="repo-summary">
            <div className="repo-avatar">
              <Layers3 size={17} />
            </div>
            <div>
              <strong>{graph.slug || "repository graph"}</strong>
              <span>main · TypeScript / JavaScript · {graph.source === "neo4j" ? "Neo4j AuraDB" : "demo graph"}</span>
            </div>
            <span className="analyzed-badge">
              <Check size={12} /> {graph.source === "neo4j" ? "persisted" : "demo"}
            </span>
            {repositories.length > 1 && (
              <select
                className="repo-selector"
                aria-label="Switch analyzed repository"
                value={projectId ?? ""}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setSelectedId(null);
                }}
              >
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="workspace-stats">
            <StatPill icon={<FileCode2 size={15} />} value={graph.stats.files} label="files" />
            <StatPill icon={<CircleDot size={15} />} value={graph.stats.functions} label="functions" />
            <StatPill icon={<ArrowUpRight size={15} />} value={graph.stats.calls} label="calls" />
            <button
              className="icon-button"
              aria-label="Reset graph selection"
              onClick={() => {
                setSelectedId(null);
                setViewMode("blast");
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Mobile View Navigation Tabs */}
        <div className="mobile-tabs">
          <button
            className={mobilePanel === "functions" ? "active" : ""}
            onClick={() => setMobilePanel(mobilePanel === "functions" ? null : "functions")}
          >
            Functions
          </button>
          <button
            className={mobilePanel === "impact" ? "active" : ""}
            onClick={() => setMobilePanel(mobilePanel === "impact" ? null : "impact")}
          >
            Impact {selectedNode && <span>{totals.functions}</span>}
          </button>
        </div>

        {/* 3-Column Fixed Workspace: 640px height */}
        <div className="workspace-grid">
          {/* Column 1: Function Index */}
          <aside className={`panel function-panel ${mobilePanel === "functions" ? "mobile-open" : ""}`}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">FUNCTION INDEX</span>
                <h2>
                  Functions <span>{functionNodes.length}</span>
                </h2>
              </div>
              <button className="panel-close" onClick={() => setMobilePanel(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="search-wrap">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search functions…"
              />
              {query && (
                <button
                  className="search-clear-btn"
                  onClick={() => setQuery("")}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="function-list">
              {matches.map((node, index) => (
                <button
                  key={node.id}
                  className={`function-row ${selectedId === node.id ? "selected" : ""}`}
                  onClick={() => selectNode(node.id)}
                >
                  <span className="function-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="function-copy">
                    <strong>{node.name}</strong>
                    <small>
                      {shortFile(node.file)} <span>:{node.line}</span>
                    </small>
                  </span>
                  <ChevronRight size={14} className="row-chevron" />
                </button>
              ))}

              {!matches.length && (
                <div className="empty-list">
                  <Search size={20} />
                  <span>No functions match “{query}”</span>
                </div>
              )}
            </div>

            <div className="panel-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> inspect</span>
            </div>
          </aside>

          {/* Column 2: Call Graph Canvas */}
          <section className="graph-panel">
            <GraphCanvas
              graph={graph}
              selectedId={selectedId}
              affectedIds={affectedIds}
              viewMode={viewMode}
              onSelect={selectNode}
              onToggleViewMode={setViewMode}
              selectedNodeName={selectedNode?.name}
            />
          </section>

          {/* Column 3: Impact Inspector */}
          <aside className={`panel impact-panel ${mobilePanel === "impact" ? "mobile-open" : ""}`}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">IMPACT INSPECTOR</span>
                <h2>Selected function</h2>
              </div>
              <button className="panel-close" onClick={() => setMobilePanel(null)}>
                <X size={16} />
              </button>
            </div>

            {selectedNode ? (
              <div className="impact-content">
                <div className="selected-function">
                  <div className="selected-symbol">
                    <CircleDot size={19} />
                  </div>
                  <div>
                    <strong>{selectedNode.name}</strong>
                    <span>{selectedNode.file}:{selectedNode.line}</span>
                  </div>
                </div>

                <div className="simulator-control">
                  <div className="section-title">
                    <span>Simulate change</span>
                    <span className="simulator-badge">Cypher</span>
                  </div>
                  <select
                    aria-label="Change type"
                    value={changeType}
                    onChange={(event) => setChangeType(event.target.value as ChangeType)}
                  >
                    {changeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p>Deterministic upstream traversal from the persisted graph.</p>
                </div>

                {simulationQuery.isLoading && (
                  <div className="inline-state">
                    <Loader2 className="spin" size={14} /> Traversing Neo4j relationships…
                  </div>
                )}

                {simulationQuery.error && (
                  <div className="inline-state error-state">
                    <CircleDot size={14} /> {simulationQuery.error.message}
                    <button onClick={() => void simulationQuery.refetch()}>Retry</button>
                  </div>
                )}

                {simulationResult && (
                  <>
                    <div className="impact-number">
                      <strong>{totals.functions}</strong>
                      <span>all affected upstream functions</span>
                      <div className="impact-bar">
                        <i
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(8, (totals.functions / Math.max(graph.stats.functions, 1)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="impact-metrics">
                      <div>
                        <strong>{totals.files}</strong>
                        <span>files</span>
                      </div>
                      <div>
                        <strong>{totals.classes}</strong>
                        <span>classes</span>
                      </div>
                      <div>
                        <strong>{totals.apis}</strong>
                        <span>APIs</span>
                      </div>
                      <div>
                        <strong>{totals.tests}</strong>
                        <span>tests</span>
                      </div>
                    </div>

                    <div className="impact-section">
                      <div className="section-title">
                        <span>Change impact</span>
                        <span className="warning-pill">
                          <Activity size={12} /> {totals.functions ? "review" : "clear"}
                        </span>
                      </div>
                      <p>{simulationResult.deterministicSummary}</p>
                    </div>

                    <ImpactDetails result={simulationResult} onFocus={selectNode} />

                    <div className="ai-card">
                      <div className="ai-card-title">
                        <span className="ai-spark">
                          <Sparkles size={14} />
                        </span>
                        <span>Gemini review</span>
                        <span className="ai-label">
                          {explanationQuery.data?.provider === "gemini" ? "LIVE" : "READY"}
                        </span>
                      </div>
                      {explanationQuery.isLoading ? (
                        <div className="ai-loading">
                          <Loader2 className="spin" size={15} /> writing a risk summary…
                        </div>
                      ) : (
                        <p>{explanationQuery.data?.text || "Gemini will explain only the deterministic graph facts above."}</p>
                      )}
                      <div className="ai-card-foot">
                        <span>grounded in deterministic graph results</span>
                        <Sparkles size={12} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="inspector-empty">
                <div className="empty-orbit">
                  <CircleDot size={25} />
                </div>
                <strong>Pick a function</strong>
                <p>
                  Click any node or choose a function from the index to simulate a change and inspect direct, transitive, test, and API impact.
                </p>
                <div className="empty-shortcut">
                  <kbd>⌘</kbd>
                  <span>search from the function index</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <span>Built for safer refactors.</span>
        <span>TS / JS today <i /> language-agnostic tomorrow</span>
        <span className="footer-right">
          Gemini explains deterministic results <Sparkles size={13} />
        </span>
      </footer>
    </main>
  );
}

