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
 * Analyzes all faces to find the orientation that places the largest flat
 * surface on the build plate, then rotates all triangles accordingly.
 *
 * Returns the (possibly rotated) triangle array and whether a rotation was
 * actually applied.
 */
function autoOrientTriangles(triangles: Triangle[]): {
  triangles: Triangle[];
  wasRotated: boolean;
} {
  if (triangles.length === 0) return { triangles, wasRotated: false };

  // ── Build normal-direction clusters ───────────────────────────────────────
  const clusters: NormalCluster[] = [];

  for (const t of triangles) {
    const [x0, y0, z0] = t.v0;
    const [x1, y1, z1] = t.v1;
    const [x2, y2, z2] = t.v2;
    const [cx, cy, cz] = cross(x1 - x0, y1 - y0, z1 - z0, x2 - x0, y2 - y0, z2 - z0);
    const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (len < 1e-10) continue;
    const area = len * 0.5;
    const nx = cx / len, ny = cy / len, nz = cz / len;

    let found = false;
    for (const c of clusters) {
      if (nx * c.nx + ny * c.ny + nz * c.nz > CLUSTER_DOT) {
        c.totalArea += area;
        found = true;
        break;
      }
    }
    if (!found && clusters.length < MAX_CLUSTERS) clusters.push({ nx, ny, nz, totalArea: area });
  }

  if (clusters.length === 0) return { triangles, wasRotated: false };

  // ── Pick cluster with the most area ───────────────────────────────────────
  const best = clusters.reduce((a, b) => a.totalArea > b.totalArea ? a : b);

  // We want best.normal → [0, 0, -1] (face toward build plate = normal down).
  // dot = best.normal · [0,0,-1] = -best.nz
  const dot = -best.nz;

  // Already pointing straight down?
  if (dot > ALREADY_DOWN_DOT) return { triangles, wasRotated: false };

  // ── Compute rotation axis and angle via Rodrigues ─────────────────────────
  // Axis = best.normal × [0,0,-1] = [-ny, nx, 0]
  let kx = -best.ny;
  let ky = best.nx;
  const kz = 0;
  const axisLen = Math.sqrt(kx * kx + ky * ky);

  let cosA: number, sinA: number;

  if (axisLen < 1e-6) {
    // Normal is [0,0,1] (straight up) — flip 180° around X axis
    kx = 1; ky = 0;
    cosA = -1; sinA = 0;
  } else {
    kx /= axisLen; ky /= axisLen;
    cosA = dot;
    sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  }

  // ── Apply rotation to every vertex ────────────────────────────────────────
  const rotated: Triangle[] = triangles.map((t) => ({
    v0: rotateVertex(t.v0, kx, ky, kz, cosA, sinA),
    v1: rotateVertex(t.v1, kx, ky, kz, cosA, sinA),
    v2: rotateVertex(t.v2, kx, ky, kz, cosA, sinA),
  }));

  return { triangles: rotated, wasRotated: true };
}

// ─── Core analysis (two-pass so overhangs exclude the bottom/bed zone) ────────

function analyzeTriangles(
  triangles: Triangle[],
  fileName: string,
  fileType: GeometryAnalysis["fileType"],
  wasAutoOriented: boolean
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
  const MAX_VIS = 150000;
  const visTris = Math.min(triangles.length, MAX_VIS);
  const meshVertices = new Float32Array(visTris * 9);
  for (let i = 0; i < visTris; i++) {
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
  while ((m = triRe.exec(xml)) !== null) {
    const v1 = getAttr(m[1], "v1"), v2 = getAttr(m[1], "v2"), v3 = getAttr(m[1], "v3");
    if (v1 !== null && v2 !== null && v3 !== null) {
      const i0 = parseInt(v1), i1 = parseInt(v2), i2 = parseInt(v3);
      const vv0 = vertices[i0], vv1 = vertices[i1], vv2 = vertices[i2];
      if (vv0 && vv1 && vv2) triangles.push({ v0: vv0, v1: vv1, v2: vv2 });
    }
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
  const { unzipSync } = await import("fflate");
  const uint8 = new Uint8Array(buffer);

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(uint8);
  } catch {
    throw new Error("Could not unzip 3MF — file may be corrupt or not a valid ZIP");
  }

  const keys = Object.keys(unzipped);

  let modelPath: string | null = null;

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

  const modelXml = new TextDecoder().decode(unzipped[modelPath]);

  let triangles = parseModelXml(modelXml);
  if (triangles.length > 0) return triangles;

  const componentPaths = extractComponentPaths(modelXml);

  if (componentPaths.length > 0) {
    for (const refPath of componentPaths) {
      const refKey = resolveKey(keys, refPath);
      if (!refKey) {
        const dir = modelPath.includes("/") ? modelPath.split("/").slice(0, -1).join("/") + "/" : "";
        const relKey = resolveKey(keys, dir + refPath);
        if (!relKey) continue;
        const refXml = new TextDecoder().decode(unzipped[relKey]);
        triangles.push(...parseModelXml(refXml));
      } else {
        const refXml = new TextDecoder().decode(unzipped[refKey]);
        triangles.push(...parseModelXml(refXml));
      }
    }
  }

  if (triangles.length === 0) {
    for (const key of keys) {
      if (key === modelPath) continue;
      const lk = key.toLowerCase();
      if (!lk.endsWith(".model") && !lk.endsWith(".xml")) continue;
      const xml = new TextDecoder("utf-8", { fatal: false }).decode(unzipped[key]);
      const found = parseModelXml(xml);
      if (found.length > 0) { triangles = found; break; }
    }
  }

  if (triangles.length === 0) {
    const tagMatches = [...modelXml.matchAll(/<([a-zA-Z:_][^\s>/]*)/g)];
    const uniqueTags = [...new Set(tagMatches.map((m) => m[1]))].slice(0, 15).join(", ");
    const componentInfo = componentPaths.length > 0
      ? `\nFound ${componentPaths.length} component reference(s): ${componentPaths.join(", ")}`
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

  return triangles;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["stl", "obj", "3mf"].includes(ext)) {
    throw new Error("Unsupported file type. Please upload .stl, .obj, or .3mf");
  }

  const buffer = await file.arrayBuffer();
  let triangles: Triangle[];

  if (ext === "stl") {
    triangles = isAsciiStl(buffer)
      ? parseStlAscii(new TextDecoder().decode(buffer))
      : parseStlBinary(buffer);
  } else if (ext === "obj") {
    triangles = parseObj(new TextDecoder().decode(buffer));
  } else {
    triangles = await parse3mf(buffer);
  }

  // Sanity-check triangle count before any heavy processing.  Very high counts
  // (corrupted binary STL with a garbage count field, or a CAD export with no
  // tessellation limit) would consume hundreds of MB and potentially hang the
  // browser tab.  1 million triangles is well above any real slicer input.
  if (triangles.length === 0) {
    throw new Error("No geometry found in file — the model appears to be empty.");
  }
  if (triangles.length > 1_000_000) {
    throw new Error(
      `This model has ${triangles.length.toLocaleString()} triangles — too many to analyze in the browser. ` +
      `Re-export at a lower resolution or reduce the mesh in your CAD tool first (aim for under 500 000 triangles).`
    );
  }

  // Auto-orient: rotate mesh so the largest flat face faces the build plate.
  // This must happen BEFORE analyzeTriangles so overhang detection and bounding
  // box calculations reflect the correct printing orientation.
  const { triangles: oriented, wasRotated } = autoOrientTriangles(triangles);

  return analyzeTriangles(oriented, file.name, ext as GeometryAnalysis["fileType"], wasRotated);
}
