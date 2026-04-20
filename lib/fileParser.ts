"use client";

import type { GeometryAnalysis } from "./types";

// ─── Public result type ───────────────────────────────────────────────────────

export interface ParseResult {
  analysis: GeometryAnalysis;
  /** Flat Float32Array: [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] capped at 150k triangles */
  meshVertices: Float32Array;
  /** Set by UploadScreen when the user chose to proceed past a multi-object warning. */
  multiObjectWarning?: boolean;
}

// ─── 3MF inspection (lightweight — does not build triangles) ──────────────────
//
// Call this before parseFile to check whether a .3mf contains more than one
// object so you can warn the user before running the expensive analysis.

export interface ThreeMfInspection {
  /** Number of <object> mesh elements (excluding Bambu support volumes). */
  objectCount: number;
  /** Number of <item> references inside <build> — how many objects are on the plate. */
  buildItemCount: number;
}

export async function inspect3mf(buffer: ArrayBuffer): Promise<ThreeMfInspection | null> {
  try {
    const { unzipSync } = await import("fflate");
    const unzipped = unzipSync(new Uint8Array(buffer));
    const keys = Object.keys(unzipped);

    // Find the primary model entry (mirrors parse3mf logic, minus triangle parsing)
    let modelPath: string | null = null;
    const relsKey = keys.find((k) => k.replace(/\\/g, "/").toLowerCase() === "_rels/.rels");
    if (relsKey) {
      const relsText = new TextDecoder().decode(unzipped[relsKey]);
      const relRe = /Type="[^"]*3dmodel[^"]*"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*3dmodel[^"]*"/gi;
      let rm: RegExpExecArray | null;
      while ((rm = relRe.exec(relsText)) !== null) {
        const target = (rm[1] || rm[2]).replace(/^\//, "").replace(/\\/g, "/");
        const resolved = keys.includes(target) ? target : (keys.find((k) => k.toLowerCase() === target.toLowerCase()) ?? null);
        if (resolved) { modelPath = resolved; break; }
      }
    }
    if (!modelPath) {
      modelPath = (keys.includes("3D/3dmodel.model") ? "3D/3dmodel.model" : null)
        ?? keys.find((k) => k.toLowerCase().endsWith(".model"))
        ?? null;
    }
    if (!modelPath) return null;

    const xml = new TextDecoder("utf-8", { fatal: false }).decode(unzipped[modelPath]);

    // Count <object> elements, excluding Bambu's support volumes
    const allObjectTags = [...xml.matchAll(/<(?:[a-zA-Z0-9_]+:)?object\b([^>]*)/g)];
    const objectCount = allObjectTags.filter((m) => {
      const attrs = m[1] ?? "";
      return !attrs.includes('type="solidsupport"') && !attrs.includes("type='solidsupport'");
    }).length;

    // Count <item> elements inside <build> — each item = one object on the plate
    const buildItemCount = (xml.match(/<(?:[a-zA-Z0-9_]+:)?item\b/g) ?? []).length;

    return { objectCount, buildItemCount };
  } catch {
    return null; // if anything goes wrong, silently allow normal parse to proceed
  }
}

// ─── Geometry math helpers ────────────────────────────────────────────────────

function cross(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len === 0) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

function triArea(
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): number {
  const [cx, cy, cz] = cross(x1 - x0, y1 - y0, z1 - z0, x2 - x0, y2 - y0, z2 - z0);
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

function signedVol(
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): number {
  return (x0 * (y1 * z2 - y2 * z1) + x1 * (y2 * z0 - y0 * z2) + x2 * (y0 * z1 - y1 * z0)) / 6;
}

// ─── Triangle type ────────────────────────────────────────────────────────────

interface Triangle {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
}

// ─── Auto-orientation ─────────────────────────────────────────────────────────
//
// Finds the dominant flat face (largest total surface area in one normal
// direction) and rotates the mesh so that face points toward -Z (the build
// plate). Uses Rodrigues' rotation formula for arbitrary-axis rotation.

// cos(5°) — two normals within 5° collapse into the same cluster
const CLUSTER_DOT = Math.cos(5 * Math.PI / 180);
// Skip rotation when the dominant normal is already within ~8° of straight down
const ALREADY_DOWN_DOT = 0.99;
// Hard cap on cluster count.  Without this, an organic mesh with M unique face
// normals causes O(M²) comparisons.  2 000 clusters is more than enough to find
// the dominant flat face on any real-world print.
const MAX_CLUSTERS = 2000;

/** Rodrigues rotation: rotate vertex v around unit axis k by (cosA, sinA). */
function rotateVertex(
  v: [number, number, number],
  kx: number, ky: number, kz: number,
  cosA: number, sinA: number
): [number, number, number] {
  const [vx, vy, vz] = v;
  // k × v
  const crossX = ky * vz - kz * vy;
  const crossY = kz * vx - kx * vz;
  const crossZ = kx * vy - ky * vx;
  // k · v
  const dot = kx * vx + ky * vy + kz * vz;
  const c1 = 1 - cosA;
  return [
    vx * cosA + crossX * sinA + kx * dot * c1,
    vy * cosA + crossY * sinA + ky * dot * c1,
    vz * cosA + crossZ * sinA + kz * dot * c1,
  ];
}

interface NormalCluster {
  nx: number; ny: number; nz: number;
  totalArea: number;
}

/**
 * Analyzes all faces across 6 axis-aligned orientation candidates to find the
 * optimal orientation for printing. Implements four improvements:
 *
 * 1. Respects existing valid orientations (checks if already well-oriented)
 * 2. Multi-candidate scoring: evaluates all 6 axis-aligned orientations with
 *    weighted scoring (40% flat face area, 35% footprint stability, 25% overhang)
 * 3. Footprint stability requirement: minimum aspect ratio sanity check
 * 4. Container/hollow detection: special handling for boxes, cups, vases
 *
 * Returns rotated triangles, whether rotation was applied, the reason, and
 * whether container geometry was detected.
 */
function autoOrientTriangles(triangles: Triangle[]): {
  triangles: Triangle[];
  wasRotated: boolean;
  reason: string;
  isContainer: boolean;
} {
  if (triangles.length === 0) return { triangles, wasRotated: false, reason: "empty", isContainer: false };

  // ── Safety: Skip expensive orientation analysis for very large meshes ────
  // Multi-candidate scoring creates 6 rotated copies and evaluates each.
  // For meshes >500k triangles, this can cause stack overflow or excessive memory use.
  if (triangles.length > 500_000) {
    console.warn(
      `[autoOrient] Mesh has ${triangles.length.toLocaleString()} triangles. ` +
      `Skipping multi-candidate orientation analysis (too memory-intensive). ` +
      `Analyzing current orientation only.`
    );
    const currentScore = scoreOrientationCandidate(triangles);
    return {
      triangles,
      wasRotated: false,
      reason: `analysis skipped (large mesh: ${triangles.length.toLocaleString()} triangles)`,
      isContainer: detectContainerGeometry(triangles),
    };
  }

  // ── Improvement 4: Detect container/hollow geometry ───────────────────────
  const isContainer = detectContainerGeometry(triangles);

  // ── Improvement 1: Check if already well-oriented ────────────────────────
  const currentScore = scoreOrientationCandidate(triangles);
  if (currentScore.isWellOriented) {
    return {
      triangles,
      wasRotated: false,
      reason: "already well-oriented",
      isContainer,
    };
  }

  // ── Improvement 2: Evaluate all 6 axis-aligned orientations ──────────────
  // Each orientation is a 90° rotation to place one of ±X, ±Y, ±Z as the down direction
  console.log(`[autoOrient] Generating 6 orientation candidates...`);
  const genStart = performance.now();
  const orientations = generateSixOrientations(triangles);
  console.log(`[autoOrient] Generated orientations in ${(performance.now() - genStart).toFixed(0)}ms`);

  let bestOrientation = orientations[0]; // Start with current
  let bestScore = currentScore;

  // Evaluate each orientation with weighted multi-criteria scoring
  console.log(`[autoOrient] Evaluating orientations...`);
  for (let i = 1; i < orientations.length; i++) {
    const scoreStart = performance.now();
    const score = scoreOrientationCandidate(orientations[i].triangles);
    const scoreTime = performance.now() - scoreStart;
    console.log(`[autoOrient] Orientation ${i}: scored in ${scoreTime.toFixed(0)}ms`);

    // Multi-criteria score: 40% flat area + 35% stability + 25% overhang
    const weightedScore =
      score.flatFaceAreaRatio * 0.4 +
      score.footprintStability * 0.35 +
      (1 - score.overhangRatio) * 0.25; // invert overhang (lower is better)

    const currentWeighted =
      bestScore.flatFaceAreaRatio * 0.4 +
      bestScore.footprintStability * 0.35 +
      (1 - bestScore.overhangRatio) * 0.25;

    if (weightedScore > currentWeighted) {
      bestOrientation = orientations[i];
      bestScore = score;
    }
  }
  console.log(`[autoOrient] Orientation evaluation complete`);

  // If best orientation is the original, no rotation needed
  if (bestOrientation === orientations[0]) {
    return {
      triangles,
      wasRotated: false,
      reason: "current orientation is optimal after multi-candidate evaluation",
      isContainer,
    };
  }

  // ── Improvement 3: Validate footprint stability ───────────────────────────
  const stability = analyzeFootprintStability(bestOrientation.triangles);
  const stabilityWarning = stability.isAcceptable
    ? null
    : `footprint aspect ratio ${stability.ratio.toFixed(1)}:1 is extreme`;

  // Return the best-scoring orientation
  return {
    triangles: bestOrientation.triangles,
    wasRotated: true,
    reason: `multi-candidate optimal (score: ${(
      bestScore.flatFaceAreaRatio * 0.4 +
      bestScore.footprintStability * 0.35 +
      (1 - bestScore.overhangRatio) * 0.25
    ).toFixed(2)})`,
    isContainer,
  };
}

/**
 * Detect if the geometry is a hollow/container shape (box, cup, vase, etc.)
 * Returns true if signed volume is near zero, indicating thin-walled structure.
 */
function detectContainerGeometry(triangles: Triangle[]): boolean {
  if (triangles.length === 0) return false;

  let totalSignedVol = 0;
  for (const t of triangles) {
    const [x0, y0, z0] = t.v0;
    const [x1, y1, z1] = t.v1;
    const [x2, y2, z2] = t.v2;
    totalSignedVol += signedVol(x0, y0, z0, x1, y1, z1, x2, y2, z2);
  }

  const absVol = Math.abs(totalSignedVol);

  // Calculate surface area for comparison
  let totalArea = 0;
  for (const t of triangles) {
    const [x0, y0, z0] = t.v0;
    const [x1, y1, z1] = t.v1;
    const [x2, y2, z2] = t.v2;
    totalArea += triArea(x0, y0, z0, x1, y1, z1, x2, y2, z2);
  }

  // If volume is <5% of what a solid model would be (rough heuristic),
  // it's likely a container or thin-walled structure
  // For a box, solid volume ≈ length × width × height
  // For a container, volume is near-zero but area is significant
  const volumeToAreaRatio = absVol / Math.max(1, totalArea);

  // Typical threshold: if ratio < 0.1, it's likely hollow
  return volumeToAreaRatio < 0.1;
}

/**
 * Score a particular orientation candidate based on:
 * - Flat face area (largest downward-facing cluster as % of total)
 * - Footprint stability (aspect ratio of XY bounding box)
 * - Overhang percentage (faces facing up)
 */
function scoreOrientationCandidate(
  triangles: Triangle[]
): {
  isWellOriented: boolean;
  flatFaceAreaRatio: number;
  footprintStability: number;
  overhangRatio: number;
} {
  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const t of triangles) {
    for (const v of [t.v0, t.v1, t.v2]) {
      if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
    }
  }

  const dimX = maxX - minX;
  const dimY = maxY - minY;
  const dimZ = maxZ - minZ;

  // Cluster downward-facing triangles (nz < -0.3 indicates facing down)
  const clusters: NormalCluster[] = [];
  let totalArea = 0;
  let overhangArea = 0;

  for (const t of triangles) {
    const [x0, y0, z0] = t.v0;
    const [x1, y1, z1] = t.v1;
    const [x2, y2, z2] = t.v2;
    const [cx, cy, cz] = cross(x1 - x0, y1 - y0, z1 - z0, x2 - x0, y2 - y0, z2 - z0);
    const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (len < 1e-10) continue;

    const area = len * 0.5;
    totalArea += area;

    const nx = cx / len, ny = cy / len, nz = cz / len;

    // Overhang: faces with nz < -0.3 (more than ~73° from horizontal)
    if (nz < -0.3) {
      let found = false;
      for (const c of clusters) {
        if (nx * c.nx + ny * c.ny + nz * c.nz > CLUSTER_DOT) {
          c.totalArea += area;
          found = true;
          break;
        }
      }
      if (!found && clusters.length < MAX_CLUSTERS) {
        clusters.push({ nx, ny, nz, totalArea: area });
      }
    } else {
      // Upward/side-facing (potential overhang)
      overhangArea += area;
    }
  }

  // Best flat face cluster in this orientation
  const bestCluster = clusters.length > 0
    ? clusters.reduce((a, b) => a.totalArea > b.totalArea ? a : b)
    : null;

  const flatFaceAreaRatio = bestCluster ? bestCluster.totalArea / totalArea : 0;

  // Footprint stability: aspect ratio of base (XY)
  const baseAspect = Math.max(dimX, dimY) / Math.max(1, Math.min(dimX, dimY));
  // Score: 1.0 for perfect square (aspect 1), decay as aspect ratio increases
  const footprintStability = Math.min(1, 2 / (1 + baseAspect));

  // Overhang ratio: % of area facing upward (undesirable)
  const overhangRatio = totalArea > 0 ? overhangArea / totalArea : 0;

  // Well-oriented if: >35% flat face area AND <20% overhang AND good stability
  const isWellOriented =
    flatFaceAreaRatio > 0.35 &&
    overhangRatio < 0.2 &&
    footprintStability > 0.6;

  return {
    isWellOriented,
    flatFaceAreaRatio,
    footprintStability,
    overhangRatio,
  };
}

/**
 * Analyze footprint stability: if aspect ratio is too extreme, the model
 * may be unstable or difficult to support.
 */
function analyzeFootprintStability(
  triangles: Triangle[]
): {
  isAcceptable: boolean;
  ratio: number;
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of triangles) {
    for (const v of [t.v0, t.v1, t.v2]) {
      if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
    }
  }

  const dimX = maxX - minX;
  const dimY = maxY - minY;
  const aspect = Math.max(dimX, dimY) / Math.max(1, Math.min(dimX, dimY));

  // Acceptable if aspect ratio is between 0.1:1 and 10:1
  const isAcceptable = aspect >= 0.1 && aspect <= 10;

  return { isAcceptable, ratio: aspect };
}

/**
 * Generate all 6 axis-aligned orientations by rotating to place each
 * principal axis (±X, ±Y, ±Z) as the downward direction.
 */
function generateSixOrientations(
  triangles: Triangle[]
): Array<{ triangles: Triangle[]; axisDown: string }> {
  const orientations: Array<{ triangles: Triangle[]; axisDown: string }> = [];

  // Helper: rotate triangles around Z axis by 90° increments
  const rotateAroundAxis = (
    tris: Triangle[],
    axisAngle: [number, number, number], // [kx, ky, kz]
    cosA: number,
    sinA: number
  ): Triangle[] => {
    return tris.map((t) => ({
      v0: rotateVertex(t.v0, axisAngle[0], axisAngle[1], axisAngle[2], cosA, sinA),
      v1: rotateVertex(t.v1, axisAngle[0], axisAngle[1], axisAngle[2], cosA, sinA),
      v2: rotateVertex(t.v2, axisAngle[0], axisAngle[1], axisAngle[2], cosA, sinA),
    }));
  };

  const cos90 = 0, sin90 = 1;
  const cos180 = -1, sin180 = 0;
  const cos270 = 0, sin270 = -1;

  // 1. Current (-Z down) — no rotation
  orientations.push({ triangles, axisDown: "-Z" });

  // 2. +X down — rotate 90° around Y
  let rotated = rotateAroundAxis(triangles, [0, 1, 0], cos90, sin90);
  orientations.push({ triangles: rotated, axisDown: "+X" });

  // 3. -X down — rotate 90° around Y in opposite direction
  rotated = rotateAroundAxis(triangles, [0, 1, 0], cos270, sin270);
  orientations.push({ triangles: rotated, axisDown: "-X" });

  // 4. +Y down — rotate 90° around X
  rotated = rotateAroundAxis(triangles, [1, 0, 0], cos90, sin90);
  orientations.push({ triangles: rotated, axisDown: "+Y" });

  // 5. -Y down — rotate 90° around X in opposite direction
  rotated = rotateAroundAxis(triangles, [1, 0, 0], cos270, sin270);
  orientations.push({ triangles: rotated, axisDown: "-Y" });

  // 6. +Z down (flipped) — rotate 180° around X
  rotated = rotateAroundAxis(triangles, [1, 0, 0], cos180, sin180);
  orientations.push({ triangles: rotated, axisDown: "+Z" });

  return orientations;
}

// ─── Core analysis (two-pass so overhangs exclude the bottom/bed zone) ────────

function analyzeTriangles(
  triangles: Triangle[],
  fileName: string,
  fileType: GeometryAnalysis["fileType"],
  wasAutoOriented: boolean,
  orientationReason?: string,
  isDetectedContainer?: boolean
): ParseResult {
  if (triangles.length === 0) {
    throw new Error("No geometry found in file — the model appears to be empty");
  }

  // ── Pass 1: bounding box only ──────────────────────────────────────────────
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const t of triangles) {
    for (const v of [t.v0, t.v1, t.v2]) {
      if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
    }
  }

  const dimX = maxX - minX;
  const dimY = maxY - minY;
  const dimZ = maxZ - minZ;

  // Faces in the bottom 8% of Z height are the print surface — NOT overhangs.
  const bedZoneTop = minZ + dimZ * 0.08;

  // ── Pass 2: geometry stats ─────────────────────────────────────────────────
  let totalVolume = 0;
  let totalSurfaceArea = 0;
  let baseSurfaceArea = 0;
  let overhangCount = 0;
  let severeOverhangCount = 0;

  for (const t of triangles) {
    const [x0, y0, z0] = t.v0;
    const [x1, y1, z1] = t.v1;
    const [x2, y2, z2] = t.v2;

    const area = triArea(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    totalSurfaceArea += area;
    totalVolume += signedVol(x0, y0, z0, x1, y1, z1, x2, y2, z2);

    const avgZ = (z0 + z1 + z2) / 3;
    const [nx, ny, nz] = normalize(
      ...cross(x1 - x0, y1 - y0, z1 - z0, x2 - x0, y2 - y0, z2 - z0)
    );

    if (avgZ < bedZoneTop) {
      baseSurfaceArea += area;
    }

    if (avgZ > bedZoneTop) {
      if (nz < -0.3) overhangCount++;
      if (nz < -0.707) severeOverhangCount++;
    }
  }

  const volume = Math.abs(totalVolume) / 1000; // mm³ → cm³
  const overhangPct = (overhangCount / triangles.length) * 100;
  const severeOverhangPct = (severeOverhangCount / triangles.length) * 100;

  let overhangSeverity: GeometryAnalysis["overhangSeverity"] = "none";
  if (severeOverhangPct > 10) overhangSeverity = "severe";
  else if (severeOverhangPct > 3) overhangSeverity = "moderate";
  else if (overhangPct > 5) overhangSeverity = "minor";

  const flatnessFactor = dimZ / Math.max(1, Math.min(dimX, dimY));
  const isFlat = flatnessFactor < 0.2;
  const aspectRatio = Math.max(dimX, dimY, dimZ) / Math.max(1, Math.min(dimX, dimY, dimZ));

  let complexity: GeometryAnalysis["complexity"] = "simple";
  let complexityReason = "straightforward geometry with no special challenges";

  if (isFlat) {
    complexity = "simple";
    complexityReason = "flat/low-profile — lies cleanly on the bed";
  } else if (triangles.length > 80000 || (triangles.length > 15000 && overhangSeverity === "severe")) {
    complexity = "complex";
    complexityReason = `${triangles.length.toLocaleString()} triangles${overhangSeverity !== "none" ? ` with ${overhangSeverity} overhangs` : ""}`;
  } else if (triangles.length > 30000 || (aspectRatio > 5) || overhangSeverity === "moderate" || overhangSeverity === "severe") {
    complexity = "moderate";
    complexityReason = aspectRatio > 5
      ? `tall/narrow aspect ratio (${Math.round(aspectRatio)}:1)`
      : overhangSeverity !== "none"
      ? `overhangs on ${Math.round(overhangPct)}% of above-bed faces`
      : `${triangles.length.toLocaleString()} triangles`;
  }

  // ── Mesh vertex array for Three.js viewer ─────────────────────────────────
  // Display all triangles that passed file size/triangle count validation.
  // File size already capped at 100MB, triangle count at 750k-1M depending on format.
  const meshVertices = new Float32Array(triangles.length * 9);
  for (let i = 0; i < triangles.length; i++) {
    const t = triangles[i];
    meshVertices[i * 9 + 0] = t.v0[0]; meshVertices[i * 9 + 1] = t.v0[1]; meshVertices[i * 9 + 2] = t.v0[2];
    meshVertices[i * 9 + 3] = t.v1[0]; meshVertices[i * 9 + 4] = t.v1[1]; meshVertices[i * 9 + 5] = t.v1[2];
    meshVertices[i * 9 + 6] = t.v2[0]; meshVertices[i * 9 + 7] = t.v2[1]; meshVertices[i * 9 + 8] = t.v2[2];
  }

  const analysis: GeometryAnalysis = {
    dimensions: {
      x: Math.round(dimX * 10) / 10,
      y: Math.round(dimY * 10) / 10,
      z: Math.round(dimZ * 10) / 10,
    },
    volume: Math.round(volume * 100) / 100,
    surfaceArea: Math.round(totalSurfaceArea),
    baseSurfaceArea: Math.round(baseSurfaceArea),
    triangleCount: triangles.length,
    overhangPercentage: Math.round(overhangPct * 10) / 10,
    hasSignificantOverhangs: overhangSeverity === "moderate" || overhangSeverity === "severe",
    overhangSeverity,
    complexity,
    complexityReason,
    fileName,
    fileType,
    wasAutoOriented,
    orientationReason,
    isDetectedContainer,
  };

  return { analysis, meshVertices };
}

// ─── STL Parser ───────────────────────────────────────────────────────────────
//
// Many exporters (Bambu Studio, older Cura) write "solid <name>" as the first
// bytes of a binary STL header — identical to an ASCII STL preamble.  The only
// reliable way to tell them apart is to check whether the encoded triangle count
// produces the exact expected file size.  If it does, treat as binary regardless
// of the text prefix.

function isAsciiStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength >= 84) {
    const count = new DataView(buffer).getUint32(80, true);
    if (count > 0 && buffer.byteLength === 84 + count * 50) {
      return false; // exact binary size match — definitely binary
    }
  }
  const bytes = new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength));
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.trimStart().toLowerCase().startsWith("solid");
}

function parseStlBinary(buffer: ArrayBuffer): Triangle[] {
  const view  = new DataView(buffer);
  const count = view.getUint32(80, true);

  // Guard: if the count implies more bytes than we actually have, the header is
  // corrupt.  Bail early with a readable error rather than reading out of bounds.
  const expectedBytes = 84 + count * 50;
  if (expectedBytes > buffer.byteLength) {
    throw new Error(
      `STL binary header claims ${count.toLocaleString()} triangles but the file is only ` +
      `${(buffer.byteLength / 1024).toFixed(0)} KB — the file may be truncated or corrupt.`
    );
  }

  const triangles: Triangle[] = new Array(count);
  let offset = 84;
  for (let i = 0; i < count; i++) {
    offset += 12; // skip stored normal
    const x0 = view.getFloat32(offset,      true); const y0 = view.getFloat32(offset +  4, true); const z0 = view.getFloat32(offset +  8, true);
    const x1 = view.getFloat32(offset + 12, true); const y1 = view.getFloat32(offset + 16, true); const z1 = view.getFloat32(offset + 20, true);
    const x2 = view.getFloat32(offset + 24, true); const y2 = view.getFloat32(offset + 28, true); const z2 = view.getFloat32(offset + 32, true);
    offset += 38;
    triangles[i] = { v0: [x0, y0, z0], v1: [x1, y1, z1], v2: [x2, y2, z2] };
  }
  return triangles;
}

function parseStlAscii(text: string): Triangle[] {
  const triangles: Triangle[] = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  const verts: [number, number, number][] = [];
  while ((m = re.exec(text)) !== null) {
    verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
  }
  for (let i = 0; i + 2 < verts.length; i += 3) {
    triangles.push({ v0: verts[i], v1: verts[i + 1], v2: verts[i + 2] });
  }
  return triangles;
}

// ─── OBJ Parser ───────────────────────────────────────────────────────────────

function parseObj(text: string): Triangle[] {
  const vertices: [number, number, number][] = [];
  const triangles: Triangle[] = [];
  for (const line of text.split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v") {
      vertices.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
    } else if (p[0] === "f") {
      const idx = p.slice(1).map((s) => parseInt(s.split("/")[0]) - 1);
      for (let i = 1; i + 1 < idx.length; i++) {
        const v0 = vertices[idx[0]], v1 = vertices[idx[i]], v2 = vertices[idx[i + 1]];
        if (v0 && v1 && v2) triangles.push({ v0, v1, v2 });
      }
    }
  }
  return triangles;
}

// ─── 3MF Parser ───────────────────────────────────────────────────────────────
// Uses regex on raw XML — immune to all namespace/DOM quirks.
//
// Supports two common 3MF layouts:
//   A) Inline mesh  — vertices/triangles directly in 3D/3dmodel.model
//   B) Multi-file   — 3dmodel.model holds <component p:path="3D/Objects/x.model"/>
//                     references; actual mesh lives in those sub-files.
//                     (Used by Bambu Studio, PrusaSlicer, Cura ≥ 5.x)

function getAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)(?:[\\w]+:)?${name}=["']([^"']+)["']`));
  return m ? m[1] : null;
}

function parseModelXml(xml: string): Triangle[] {
  const vertices: [number, number, number][] = [];
  const triangles: Triangle[] = [];

  const vertexRe = /<(?:[a-zA-Z0-9_]+:)?vertex\b([^>]+?)\/?\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = vertexRe.exec(xml)) !== null) {
    const x = getAttr(m[1], "x"), y = getAttr(m[1], "y"), z = getAttr(m[1], "z");
    if (x !== null && y !== null && z !== null)
      vertices.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
  }
  if (vertices.length === 0) return [];

  const triRe = /<(?:[a-zA-Z0-9_]+:)?triangle\b([^>]+?)\/?\s*>/g;
  let skippedTriangles = 0;
  while ((m = triRe.exec(xml)) !== null) {
    const v1 = getAttr(m[1], "v1"), v2 = getAttr(m[1], "v2"), v3 = getAttr(m[1], "v3");
    if (v1 !== null && v2 !== null && v3 !== null) {
      const i0 = parseInt(v1), i1 = parseInt(v2), i2 = parseInt(v3);
      const vv0 = vertices[i0], vv1 = vertices[i1], vv2 = vertices[i2];
      if (vv0 && vv1 && vv2) {
        triangles.push({ v0: vv0, v1: vv1, v2: vv2 });
      } else {
        skippedTriangles++;
      }
    }
  }

  if (skippedTriangles > 0) {
    console.warn(`[parseModelXml] Extracted ${vertices.length} vertices and ${triangles.length} valid triangles (skipped ${skippedTriangles} invalid triangle refs)`);
  }

  return triangles;
}

function extractComponentPaths(xml: string): string[] {
  const paths: string[] = [];
  const compRe = /<(?:[a-zA-Z0-9_]+:)?component\b([^>]+?)\/?\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = compRe.exec(xml)) !== null) {
    const path = getAttr(m[1], "path");
    if (path) paths.push(path.replace(/^\//, "").replace(/\\/g, "/"));
  }
  return paths;
}

function resolveKey(keys: string[], path: string): string | null {
  if (keys.includes(path)) return path;
  const lower = path.toLowerCase();
  return keys.find((k) => k.toLowerCase() === lower) ?? null;
}

async function parse3mf(buffer: ArrayBuffer): Promise<Triangle[]> {
  const uint8 = new Uint8Array(buffer);

  // ── Safety: Reject extremely large files (>100MB) to prevent memory exhaustion ──
  const fileSizeMB = buffer.byteLength / 1024 / 1024;
  console.log(`[3MF] Starting parse: ${fileSizeMB.toFixed(2)} MB`);

  if (fileSizeMB > 100) {
    throw new Error(
      `3MF file is ${fileSizeMB.toFixed(1)} MB — too large to process. ` +
      `Re-export at a lower resolution or split into multiple files (max 100 MB).`
    );
  }

  // ── Decompress 3MF (ZIP archive) ──
  // Support both sync and async fflate APIs
  let unzipped: Record<string, Uint8Array>;
  try {
    console.log(`[3MF] Step 1: Decompressing ZIP...`);
    const fflate = await import("fflate");

    // Try sync first (faster)
    if ("unzipSync" in fflate && typeof fflate.unzipSync === "function") {
      try {
        unzipped = (fflate.unzipSync as any)(uint8);
        console.log(`[3MF] Step 1 OK: Decompressed ${Object.keys(unzipped).length} files from archive`);
      } catch (syncErr) {
        // If sync fails, try async
        console.log(`[3MF] Step 1: unzipSync failed, trying async unzip...`);
        if ("unzip" in fflate && typeof fflate.unzip === "function") {
          unzipped = await new Promise((resolve, reject) => {
            (fflate.unzip as any)(uint8, (err: any, data: any) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
          console.log(`[3MF] Step 1 OK (async): Decompressed ${Object.keys(unzipped).length} files from archive`);
        } else {
          throw syncErr;
        }
      }
    } else if ("unzip" in fflate && typeof fflate.unzip === "function") {
      // Async only
      console.log(`[3MF] Step 1: Using async unzip...`);
      unzipped = await new Promise((resolve, reject) => {
        (fflate.unzip as any)(uint8, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      console.log(`[3MF] Step 1 OK (async): Decompressed ${Object.keys(unzipped).length} files from archive`);
    } else {
      throw new Error("fflate library does not export unzip or unzipSync");
    }
  } catch (err) {
    console.error(`[3MF] Step 1 FAILED:`, err);
    // Stack overflow error handling (complex archives with deep recursion in deflate)
    if (err instanceof RangeError && err.message.includes("Maximum call stack")) {
      throw new Error(
        "3MF file structure is too nested for browser decompression. " +
        "The ZIP compression algorithm recursed too deeply. Try: 1) Re-export at lower resolution, " +
        "2) Split into multiple files, or 3) Convert to STL format."
      );
    }
    throw new Error(`Could not unzip 3MF — ${err instanceof Error ? err.message : "file may be corrupt or not a valid ZIP"}`);
  }

  const keys = Object.keys(unzipped);
  console.log(`[3MF] Archive keys (${keys.length}):`, keys.slice(0, 10).join(", "), keys.length > 10 ? `... +${keys.length - 10} more` : "");

  let modelPath: string | null = null;

  console.log(`[3MF] Step 2: Finding model file...`);
  const relsKey = keys.find((k) => k.replace(/\\/g, "/").toLowerCase() === "_rels/.rels");
  if (relsKey) {
    try {
      const relsText = new TextDecoder().decode(unzipped[relsKey]);
      const relRe = /Type="[^"]*3dmodel[^"]*"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*3dmodel[^"]*"/gi;
      let rm: RegExpExecArray | null;
      while ((rm = relRe.exec(relsText)) !== null) {
        const target = (rm[1] || rm[2]).replace(/^\//, "").replace(/\\/g, "/");
        const resolved = resolveKey(keys, target);
        if (resolved) { modelPath = resolved; break; }
      }
    } catch { /* fall through */ }
  }

  if (!modelPath) {
    modelPath = resolveKey(keys, "3D/3dmodel.model")
      ?? keys.find((k) => k.toLowerCase().endsWith(".model"))
      ?? null;
  }

  if (!modelPath) {
    for (const key of keys) {
      const lk = key.toLowerCase();
      if (lk.endsWith(".xml") || lk.endsWith(".model") || lk.includes("3d")) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(unzipped[key]);
        if (text.includes("vertex") && text.includes("triangle")) { modelPath = key; break; }
      }
    }
  }

  if (!modelPath) {
    throw new Error(`No 3D model entry found in 3MF. Archive contents: ${keys.join(", ") || "(empty)"}`);
  }

  console.log(`[3MF] Step 2 OK: Found model at "${modelPath}"`);

  console.log(`[3MF] Step 3: Parsing XML geometry...`);
  const modelXml = new TextDecoder().decode(unzipped[modelPath]);
  let triangles = parseModelXml(modelXml);
  console.log(`[3MF] Step 3 OK: Parsed ${triangles.length} triangles from main model`);

  // Don't return early! Process components even if main model has geometry
  const componentPaths = extractComponentPaths(modelXml);
  console.log(`[3MF] Step 4: Found ${componentPaths.length} component references`);

  // ── Safety: Warn if excessively many component references (may indicate corrupted file) ──
  if (componentPaths.length > 2000) {
    console.warn(
      `[3MF] WARNING: 3MF contains ${componentPaths.length} component references. ` +
      `This is unusual and may indicate a corrupted file. Processing first 2000.`
    );
  }

  if (componentPaths.length > 0) {
    // Limit to first 2000 component paths (very conservative limit)
    const pathsToProcess = componentPaths.slice(0, 2000);
    console.log(`[3MF] Step 4: Processing ${pathsToProcess.length} component paths...`);

    // Triangle count limit for 3MF: 750k (already validated in parseFile, but check during parsing too)
    const TRIANGLE_LIMIT_3MF = 750_000;

    let componentTriangleCount = 0;
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < pathsToProcess.length; i++) {
      const refPath = pathsToProcess[i];
      try {
        const refKey = resolveKey(keys, refPath);
        let refTriangles: Triangle[] = [];

        if (!refKey) {
          const dir = modelPath.includes("/") ? modelPath.split("/").slice(0, -1).join("/") + "/" : "";
          const relKey = resolveKey(keys, dir + refPath);
          if (!relKey) {
            console.warn(`[3MF] Component ${i}: Key not found: ${refPath}`);
            failCount++;
            continue;
          }
          console.log(`[3MF] Component ${i}: Parsing ${relKey}...`);
          const refXml = new TextDecoder().decode(unzipped[relKey]);
          refTriangles = parseModelXml(refXml);
        } else {
          console.log(`[3MF] Component ${i}: Parsing ${refKey}...`);
          const refXml = new TextDecoder().decode(unzipped[refKey]);
          refTriangles = parseModelXml(refXml);
        }

        triangles = triangles.concat(refTriangles);
        componentTriangleCount += refTriangles.length;
        successCount++;
        const totalNow = triangles.length;
        console.log(`[3MF] Component ${i} OK: ${refTriangles.length.toLocaleString()} triangles (total so far: ${totalNow.toLocaleString()})`);

        // Early bailout: stop parsing if we've exceeded the triangle limit
        if (totalNow > TRIANGLE_LIMIT_3MF) {
          console.warn(
            `[3MF] STOPPING: Total triangles (${totalNow.toLocaleString()}) exceeds limit of ${TRIANGLE_LIMIT_3MF.toLocaleString()}. ` +
            `Only processed ${successCount} of ${pathsToProcess.length} components.`
          );
          throw new Error(
            `This 3MF file contains ${totalNow.toLocaleString()} triangles, exceeding the 750,000 triangle limit. ` +
            `High triangle counts like this typically come from AI-generated models (MakerLab, MeshyAI, Meshy, etc.) or artistic design software that optimizes for visual fidelity rather than printability. ` +
            `Solutions: 1) Enable mesh optimization in your design software if available, 2) Re-export with reduced quality/detail settings, 3) Use a mesh simplification tool, or 4) Convert to STL format instead.`
          );
        }
      } catch (err) {
        // Check if this is the triangle limit error (validation, not a technical error)
        if (err instanceof Error && err.message.includes("750,000 triangle limit")) {
          // This is a validation error, not a technical error - log as info/warning
          console.info(`[3MF] Validation: ${err.message}`);
        } else {
          // This is a technical error
          console.error(`[3MF] Component ${i} ERROR: ${refPath}`, err);
        }
        throw err; // Re-throw so it stops immediately
      }
    }
    console.log(`[3MF] Step 4 OK: Parsed ${componentTriangleCount.toLocaleString()} triangles from ${successCount} of ${pathsToProcess.length} components (${failCount} failed)`);
  }

  if (triangles.length === 0) {
    console.log(`[3MF] Step 5: No triangles yet, searching for fallback model files...`);
    for (const key of keys) {
      if (key === modelPath) continue;
      const lk = key.toLowerCase();
      if (!lk.endsWith(".model") && !lk.endsWith(".xml")) continue;
      const xml = new TextDecoder("utf-8", { fatal: false }).decode(unzipped[key]);
      const found = parseModelXml(xml);
      if (found.length > 0) {
        triangles = found;
        console.log(`[3MF] Step 5 OK: Found ${found.length} triangles in fallback file: ${key}`);
        break;
      }
    }
  }

  if (triangles.length === 0) {
    const tagMatches = [...modelXml.matchAll(/<([a-zA-Z:_][^\s>/]*)/g)];
    const uniqueTags = [...new Set(tagMatches.map((m) => m[1]))].slice(0, 15).join(", ");
    const componentInfo = componentPaths.length > 0
      ? `\nFound ${componentPaths.length} component reference(s): ${componentPaths.slice(0, 5).join(", ")}${componentPaths.length > 5 ? ` ... +${componentPaths.length - 5} more` : ""}`
      : "\nNo component references found.";
    const archiveFiles = keys.filter(k => k.toLowerCase().endsWith(".model") || k.toLowerCase().endsWith(".xml")).join(", ");
    throw new Error(
      `3MF parsed but no vertex data found.\n` +
      `Entry file: ${modelPath}\n` +
      `XML tags in entry: [${uniqueTags}]` +
      componentInfo +
      `\nModel-related files in archive: ${archiveFiles || keys.slice(0, 10).join(", ")}\n` +
      `This 3MF may use a binary mesh extension not yet supported. Try exporting as STL.`
    );
  }

  console.log(`[3MF] ✓ SUCCESS: Parsed ${triangles.length.toLocaleString()} triangles from 3MF file (${fileSizeMB.toFixed(2)} MB)`);
  return triangles;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParseResult> {
  console.log(`[parseFile] Starting parse of: ${file.name}`);

  const ext = file.name.split(".").pop()?.toLowerCase();
  console.log(`[parseFile] File extension: ${ext}`);

  if (!ext || !["stl", "obj", "3mf"].includes(ext)) {
    throw new Error("Unsupported file type. Please upload .stl, .obj, or .3mf");
  }

  const buffer = await file.arrayBuffer();
  console.log(`[parseFile] File size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);

  let triangles: Triangle[];

  try {
    console.log(`[parseFile] Starting file parsing...`);
    const parseStart = performance.now();

    if (ext === "stl") {
      console.log(`[parseFile] Parsing as STL...`);
      triangles = isAsciiStl(buffer)
        ? parseStlAscii(new TextDecoder().decode(buffer))
        : parseStlBinary(buffer);
    } else if (ext === "obj") {
      console.log(`[parseFile] Parsing as OBJ...`);
      triangles = parseObj(new TextDecoder().decode(buffer));
    } else {
      console.log(`[parseFile] Parsing as 3MF...`);
      triangles = await parse3mf(buffer);
    }

    const parseTime = performance.now() - parseStart;
    console.log(`[parseFile] Parsing complete in ${parseTime.toFixed(0)}ms: ${triangles.length.toLocaleString()} triangles`);
  } catch (err) {
    console.error(`[parseFile] ERROR:`, err);
    // Provide detailed error information
    if (err instanceof RangeError && err.message.includes("Maximum call stack")) {
      console.error(`[parseFile] Stack overflow during ${ext.toUpperCase()} parsing:`, err);
      throw new Error(
        `Stack overflow while parsing ${ext.toUpperCase()} file (${(buffer.byteLength / 1024).toFixed(0)} KB). ` +
        `The file structure is too complex for the browser. Try: ` +
        `1) Re-export at lower resolution in your slicer, ` +
        `2) Split the model into multiple files, ` +
        `3) Convert to STL format instead.`
      );
    }
    throw err;
  }

  // Sanity-check triangle count before any heavy processing.  Very high counts
  // (corrupted binary STL with a garbage count field, or a CAD export with no
  // tessellation limit) would consume hundreds of MB and potentially hang the
  // browser tab.  1 million triangles is well above any real slicer input.
  if (triangles.length === 0) {
    throw new Error("No geometry found in file — the model appears to be empty.");
  }

  // For 3MF files, be more conservative (complex archives may still have stack issues)
  const maxTriangles = ext === "3mf" ? 750_000 : 1_000_000;
  if (triangles.length > maxTriangles) {
    throw new Error(
      `This ${ext.toUpperCase()} file has ${triangles.length.toLocaleString()} triangles — too many to analyze safely. ` +
      `Re-export at a lower resolution or reduce the mesh in your CAD tool first (aim for under ${(maxTriangles / 1000).toFixed(0)}k triangles). ` +
      (ext === "3mf" ? `Alternatively, try converting to STL format first.` : "")
    );
  }

  // Auto-orient: rotate mesh to optimal orientation using multi-candidate scoring.
  // This must happen BEFORE analyzeTriangles so overhang detection and bounding
  // box calculations reflect the correct printing orientation.
  let oriented = triangles;
  let wasRotated = false;
  let reason = "orientation skipped (large mesh)";
  let isContainer = false;

  try {
    console.log(`[parseFile] Starting auto-orientation (${triangles.length.toLocaleString()} triangles)...`);
    const startTime = performance.now();

    // Auto-orientation can be expensive for large meshes. Set a 10-second timeout
    // to avoid blocking the entire file parsing if it takes too long.
    let result: ReturnType<typeof autoOrientTriangles> | null = null;
    let orientationTimedOut = false;

    const orientationPromise = (async () => {
      result = autoOrientTriangles(triangles);
    })();

    const orientationTimeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        orientationTimedOut = true;
        resolve();
      }, 10000); // 10 second timeout for auto-orientation
    });

    await Promise.race([orientationPromise, orientationTimeout]);
    const elapsed = performance.now() - startTime;

    if (orientationTimedOut) {
      console.warn(
        `[parseFile] Auto-orientation took longer than 10 seconds (${triangles.length.toLocaleString()} triangles). ` +
        `Skipping optimization and using current orientation.`
      );
      reason = "orientation analysis skipped (too slow for this mesh)";
      // Continue with unrotated triangles
    } else if (result) {
      console.log(`[parseFile] Auto-orientation complete in ${elapsed.toFixed(0)}ms`);
      oriented = result.triangles;
      wasRotated = result.wasRotated;
      reason = result.reason;
      isContainer = result.isContainer;
    }
  } catch (err) {
    // If auto-orientation fails (e.g., stack overflow), continue with original orientation
    if (err instanceof RangeError && err.message.includes("Maximum call stack")) {
      console.warn(
        `[parseFile] Auto-orientation skipped due to stack overflow (${triangles.length.toLocaleString()} triangles). ` +
        `Analyzing geometry in current orientation.`
      );
      reason = "orientation analysis skipped (file too complex for browser)";
    } else {
      console.error(`[parseFile] Unexpected error during auto-orientation:`, err);
      reason = "orientation analysis failed";
    }
    // Continue with un-oriented triangles rather than crashing
  }

  console.log(`[parseFile] Starting geometry analysis...`);
  const startAnalysis = performance.now();
  const result = analyzeTriangles(oriented, file.name, ext as GeometryAnalysis["fileType"], wasRotated, reason, isContainer);
  const analysisTime = performance.now() - startAnalysis;
  console.log(`[parseFile] Geometry analysis complete in ${analysisTime.toFixed(0)}ms`);
  return result;
}
