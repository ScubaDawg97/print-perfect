"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

interface Props {
  meshVertices: Float32Array;
  className?: string;
}

export default function ModelViewer({ meshVertices, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglError, setWebglError] = useState(false);
  const [hint, setHint] = useState(true);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (meshVertices.length === 0) return;

    let animId: number;
    let disposed = false;

    async function init() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const THREE = await import("three");
        const { OrbitControls } = await import(
          "three/addons/controls/OrbitControls.js"
        );

        const w = canvas.clientWidth || 400;
        const h = canvas.clientHeight || 280;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
        });
        renderer.setSize(w, h, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 1e7);

        // ── Build geometry ──────────────────────────────────────────────
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(meshVertices, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        const box = geometry.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);

        geometry.translate(-center.x, -center.y, -center.z);

        const material = new THREE.MeshStandardMaterial({
          color: 0x14b8a6,
          roughness: 0.45,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // ── Lights ──────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const sun = new THREE.DirectionalLight(0xffffff, 0.9);
        sun.position.set(1, 2, 2);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0xffffff, 0.25);
        fill.position.set(-2, -1, -1);
        scene.add(fill);

        // ── Camera ──────────────────────────────────────────────────────
        // Position camera directly above (top-down view) so the Z=0 plane
        // (the build plate) is clearly visible at the bottom of the screen.
        const dist = maxDim * 2.2;
        camera.position.set(0, 0, dist);
        camera.near = maxDim * 0.001;
        camera.far = maxDim * 200;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // ── Controls ────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
        controls.addEventListener("start", () => {
          controls.autoRotate = false;
          setHint(false);
        });

        resetRef.current = () => {
          camera.position.set(0, 0, dist);
          camera.lookAt(0, 0, 0);
          controls.reset();
          controls.autoRotate = true;
        };

        // ── Resize observer ─────────────────────────────────────────────
        const ro = new ResizeObserver(() => {
          if (!canvas || disposed) return;
          const cw = canvas.clientWidth;
          const ch = canvas.clientHeight;
          renderer.setSize(cw, ch, false);
          camera.aspect = cw / ch;
          camera.updateProjectionMatrix();
        });
        ro.observe(canvas);

        // ── Render loop ─────────────────────────────────────────────────
        function animate() {
          if (disposed) return;
          animId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        // Cleanup
        return () => {
          disposed = true;
          cancelAnimationFrame(animId);
          ro.disconnect();
          controls.dispose();
          renderer.dispose();
          geometry.dispose();
          material.dispose();
        };
      } catch (err) {
        console.error("Three.js init failed:", err);
        setWebglError(true);
      }
    }

    let cleanup: (() => void) | undefined;
    init().then((fn) => { cleanup = fn; });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [meshVertices]);

  if (webglError) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 text-sm ${className}`}
      >
        3D preview not available (WebGL required)
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`relative bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl overflow-hidden ${className}`}>
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Reset button */}
        <button
          onClick={() => { resetRef.current(); setHint(false); }}
          title="Reset view"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors"
        >
          <RotateCcw size={13} />
        </button>

        {/* Interaction hint */}
        {hint && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-400 bg-white/70 dark:bg-slate-800/70 rounded-full px-2.5 py-1 pointer-events-none whitespace-nowrap">
            Auto-rotating · drag to take control
          </div>
        )}
      </div>

      {/* Orientation disclaimer */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold">Orientation note:</span> The above view is a top-down view orientation by default. Always verify in your slicer before printing, as your specific needs may require adjustments.
      </p>
    </div>
  );
}
