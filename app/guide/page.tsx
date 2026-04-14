// ─── /guide — User's Guide page ──────────────────────────────────────────────
//
// Public page — no beta key required.
// Server Component with a GuideTOC client sub-component for scroll tracking.

import type { Metadata } from "next";
import GuideTOC from "@/components/GuideTOC";

export const metadata: Metadata = {
  title: "User's Guide — Print Perfect",
  description:
    "Learn how to use Print Perfect to get perfect 3D print settings for your model, printer, and filament in minutes.",
};

// ── Shared callout components ─────────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3">
      <span className="flex-shrink-0 text-base leading-relaxed">💡</span>
      <div className="text-sm text-teal-800 dark:text-teal-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
      <span className="flex-shrink-0 text-base leading-relaxed">⚠️</span>
      <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{children}</div>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="flex-shrink-0 text-emerald-500 font-bold text-sm mt-0.5">✓</span>
      <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{children}</span>
    </div>
  );
}

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <div className="my-5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center h-36">
      <p className="text-sm text-slate-400 dark:text-slate-500 italic text-center px-4">
        [Screenshot: {label}]
      </p>
    </div>
  );
}

function SectionHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <div id={id} className="scroll-mt-24 mb-6 pt-2">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">
          {number}
        </span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="h-px bg-slate-200 dark:bg-slate-700 mt-3" />
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-7 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-[1.75] mb-3">
      {children}
    </p>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[13px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md">
      {children}
    </code>
  );
}

// ── Styled table ──────────────────────────────────────────────────────────────

function GuideTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0
                ? "bg-white dark:bg-slate-900"
                : "bg-slate-50/60 dark:bg-slate-800/30"}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-slate-600 dark:text-slate-300 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Numbered list item ────────────────────────────────────────────────────────

function NumItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start mb-3">
      <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">{children}</span>
    </div>
  );
}

// ── Tip list item (for tips sections) ────────────────────────────────────────

function TipItem({ bold, children }: { bold: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex gap-3 items-start">
      <span className="flex-shrink-0 mt-1 text-primary-500">✦</span>
      <div className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
        <strong className="text-slate-800 dark:text-slate-100">{bold}</strong> {children}
      </div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 last:border-0 last:mb-0 last:pb-0">
      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2 text-[15px]">
        {q}
      </p>
      <div className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">{a}</div>
    </div>
  );
}

// ── Main guide page ───────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <div className="animate-fade-in">

      {/* Page header */}
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
        >
          ← Back to Print Perfect
        </a>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          User&apos;s Guide
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">
          Everything you need to get perfect 3D print settings in minutes.
        </p>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400 dark:text-slate-500">
          <span>Version 1.0.0-alpha</span>
          <span>·</span>
          <span>Updated April 2026</span>
          <span>·</span>
          <a href="/guide" className="text-primary-500 hover:underline">printperfect.app/guide</a>
        </div>
      </div>

      {/* Two-column layout: TOC sidebar + content */}
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">

        {/* Sidebar TOC (client component) */}
        <GuideTOC />

        {/* Main content */}
        <article className="min-w-0">

          {/* ── SECTION 1: Getting Started ── */}
          <SectionHeading id="section-1" number={1} title="Getting Started" />

          <SubHeading>What is Print Perfect?</SubHeading>
          <P>
            Print Perfect is a free tool that takes the guesswork out of 3D printer slicer
            settings. You upload your model file, tell it about your printer and filament, and
            it gives you a complete set of recommended settings — layer height, temperatures,
            speed, cooling, supports, and adhesion — all explained in plain English so you
            understand <em>why</em>, not just <em>what</em>.
          </P>
          <P>
            Most slicer settings guides are one-size-fits-all. Print Perfect is different:
            it analyzes the actual geometry of your specific model and combines that with your
            specific filament and printer to give you settings tailored to <em>your</em> print.
          </P>
          <P>
            There&apos;s no sign-up required, no account, and nothing is stored on our servers.
            Your model file is analyzed in your browser and never uploaded anywhere. It&apos;s
            completely free, powered by real manufacturer filament data from the Open Filament
            Database and Claude AI.
          </P>

          <SubHeading>What you&apos;ll need before you start</SubHeading>
          <div className="space-y-2 mb-4">
            <CheckItem>A 3D model file (.STL, .OBJ, or .3MF)</CheckItem>
            <CheckItem>Your printer model name (e.g. &ldquo;Bambu Lab X1 Carbon&rdquo;, &ldquo;Prusa MK4&rdquo;)</CheckItem>
            <CheckItem>Your filament brand and type (e.g. &ldquo;Hatchbox PLA&rdquo;, &ldquo;Bambu PETG&rdquo;)</CheckItem>
            <CheckItem>A few minutes</CheckItem>
          </div>

          <SubHeading>Accessing the site</SubHeading>
          <P>
            Print Perfect is currently in <strong>private beta</strong> while we test and
            refine the tool. To access it, you&apos;ll need a beta access key. Enter it on the
            welcome screen — it&apos;s saved in your browser, so you&apos;ll only need to enter
            it once per device.
          </P>
          <Tip>
            Don&apos;t have a key yet? Contact us at{" "}
            <strong>info@printperfect.app</strong> and we&apos;ll get you set up.
          </Tip>

          <ScreenshotPlaceholder label="Welcome screen with beta key input" />

          <div className="h-8" />

          {/* ── SECTION 2: Uploading Your Model ── */}
          <SectionHeading id="section-2" number={2} title="Uploading Your Model" />

          <SubHeading>Supported file formats</SubHeading>
          <GuideTable
            headers={["Format", "Description", "Best for"]}
            rows={[
              [".STL", "The most common 3D printing format. One object per file.", "Most prints — start here"],
              [".OBJ", "Common format, slightly more complex than STL.", "Single objects"],
              [".3MF", "Modern format used by Bambu Studio and PrusaSlicer. Can contain multiple objects.", "Modern slicer workflows"],
            ]}
          />

          <Warning>
            <strong>Multi-object 3MF files:</strong> If your .3MF contains more than one
            object, Print Perfect will warn you and results may be less accurate. For best
            results, export individual parts as separate STL files. In Bambu Studio:
            right-click the object → Export → Export as STL.
          </Warning>

          <SubHeading>File size limit</SubHeading>
          <P>
            Files up to <Pill>50 MB</Pill> are supported. For very large or high-polygon
            files, the geometry analysis may take a few extra seconds.
          </P>

          <SubHeading>Tips for best results</SubHeading>
          <div className="mt-2">
            <NumItem n={1}><strong>Single-object files work best.</strong> If your model has multiple parts, analyze each one separately.</NumItem>
            <NumItem n={2}><strong>Watch for the multi-object warning.</strong> If you see it, export individual parts as STL files.</NumItem>
            <NumItem n={3}><strong>Your model should be &ldquo;watertight.&rdquo;</strong> No holes or open edges. Most models from reputable design sites are fine.</NumItem>
            <NumItem n={4}><strong>Analyze one part at a time.</strong> Even if you&apos;re printing multiple copies, analyze one to get the settings.</NumItem>
            <NumItem n={5}><strong>Large files may take a moment.</strong> Files over 20 MB or with very high triangle counts take 2–3 extra seconds.</NumItem>
          </div>

          <SubHeading>What happens when you upload</SubHeading>
          <P>The moment your file loads, Print Perfect automatically:</P>
          <div className="space-y-2 mb-4">
            <CheckItem><strong>Analyzes geometry</strong> — measures exact dimensions, calculates volume, and counts triangles.</CheckItem>
            <CheckItem><strong>Detects overhangs</strong> — identifies faces past 45° to determine if supports are needed.</CheckItem>
            <CheckItem><strong>Scores complexity</strong> — Simple, Moderate, or Complex, which affects speed recommendations.</CheckItem>
            <CheckItem><strong>Auto-orients the model</strong> — rotates it so the flattest face rests on the virtual build plate.</CheckItem>
            <CheckItem><strong>Renders a 3D preview</strong> — an interactive rotatable view of your model.</CheckItem>
          </div>

          <SubHeading>Understanding the 3D viewer</SubHeading>
          <P>
            The viewer shows your model as it would sit on the print bed. <strong>Rotate</strong> by
            clicking and dragging. <strong>Zoom</strong> with the scroll wheel. If the model was
            auto-oriented, a small note appears — this is just for analysis and doesn&apos;t affect
            how you orient it in your slicer.
          </P>

          <ScreenshotPlaceholder label="3D viewer with auto-orientation note and overhang highlighting" />

          <div className="h-8" />

          {/* ── SECTION 3: Configuring Your Print ── */}
          <SectionHeading id="section-3" number={3} title="Configuring Your Print" />

          <SubHeading>Selecting your printer</SubHeading>
          <P>
            Choose your printer from the dropdown — 55+ printers are supported, organized by
            brand. If your exact model isn&apos;t listed, choose the closest variant from the same
            brand, or select <strong>&ldquo;Other&rdquo;</strong> for solid generic settings.
          </P>
          <Tip>
            Save your printer as a profile after your first analysis — see{" "}
            <a href="#section-6" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
              Section 6: Printer Profiles
            </a>.
          </Tip>

          <SubHeading>Filament type</SubHeading>
          <GuideTable
            headers={["Filament", "Best for", "Notes"]}
            rows={[
              ["PLA", "Everything — the default", "Easiest to print. Start here."],
              ["PLA+", "Stronger everyday parts", "Same ease as PLA, slightly tougher."],
              ["PLA Silk", "Display pieces, gifts", "Beautiful glossy finish. Slower and more fussy."],
              ["PLA-CF", "Stiff structural parts", "Carbon fiber reinforced. Abrasive on brass nozzles."],
              ["PETG", "Functional parts", "Stronger than PLA, slightly flexible, more heat resistant."],
              ["PETG-CF", "Very strong structural parts", "Carbon fiber PETG. Stiff and tough."],
              ["ABS", "Heat-resistant parts", "Warps badly — needs an enclosure."],
              ["ASA", "Outdoor parts", "Like ABS but UV-resistant."],
              ["TPU", "Flexible parts", "Rubber-like. Great for phone cases and gaskets."],
              ["Nylon", "Wear-resistant parts", "Tough but absorbs moisture quickly — store carefully."],
              ["PC", "High-stress parts", "Extremely strong. Needs very high temperatures."],
              ["Resin", "SLA/MSLA printers", "Completely different printer type — FDM settings don't apply."],
            ]}
          />

          <SubHeading>Filament brand and the Open Filament Database</SubHeading>
          <P>
            Enter your exact filament brand name (e.g. &ldquo;Bambu&rdquo;, &ldquo;Hatchbox&rdquo;, &ldquo;Prusament&rdquo;, &ldquo;eSUN&rdquo;).
            Print Perfect searches the <strong>Open Filament Database</strong> — a community-maintained
            registry of real manufacturer filament specifications.
          </P>
          <Tip>
            When your brand is found, a green <strong>Filament Profile</strong> card appears at the
            top of your results showing actual manufacturer-specified temperature ranges, density,
            and diameter. Your settings are based on real data for your specific product — not
            generic estimates.
          </Tip>

          <SubHeading>Nozzle diameter</SubHeading>
          <GuideTable
            headers={["Diameter", "Best for"]}
            rows={[
              ["0.2mm", "Ultra-fine detail: miniatures, intricate ornamental parts. Very slow."],
              ["0.4mm", "The standard. Best balance of speed and quality. Start here."],
              ["0.6mm", "Faster prints with slightly less detail. Great for large functional parts."],
              ["0.8mm", "Fast and strong. Draft prints and structural parts."],
            ]}
          />
          <P>Most printers ship with a 0.4mm nozzle. If you haven&apos;t changed yours, select <Pill>0.4mm</Pill>.</P>

          <SubHeading>Bed surface type</SubHeading>
          <P>
            Your bed surface affects the recommended bed temperature and adhesion settings.
            Common surfaces include PEI Textured (excellent all-round adhesion), PEI Smooth
            (better for flexible materials), Glass (reliable, needs slightly higher temps), and
            Bambu Lab&apos;s printer-specific plates — each optimized for different filament families.
          </P>

          <SubHeading>Room humidity (auto-detected)</SubHeading>
          <P>
            If you share your location, Print Perfect reads your current local humidity from a
            weather service and fills it in automatically. No personal data is stored.
          </P>
          <Warning>
            <strong>High humidity warning:</strong> Moisture in the air seeps into filament,
            especially PETG, Nylon, and ABS. Signs of wet filament: popping sounds while printing,
            excessive stringing, or weak/brittle layers. Dry your filament at 50–55°C for 4–6
            hours if you suspect moisture.
          </Warning>

          <SubHeading>Print quality tier</SubHeading>
          <GuideTable
            headers={["Tier", "Layer Height", "Speed", "Best for"]}
            rows={[
              ["Draft", "0.28mm", "Fast", "Fit tests, prototypes, things you'll reprint"],
              ["Standard", "0.20mm", "Moderate", "Everyday prints — the sweet spot"],
              ["Quality", "0.12mm", "Slow", "Visible parts where surface finish matters"],
              ["Ultra", "0.08mm", "Very slow", "Display pieces, fine detail, maximum quality"],
            ]}
          />
          <Warning>
            <strong>Ultra quality warning:</strong> Ultra is NOT recommended for large models.
            A 100mm cube at Ultra can take 20+ hours. Reserve it for small, detail-critical pieces.
          </Warning>

          <SubHeading>Functional vs. decorative</SubHeading>
          <P>
            Checking <strong>&ldquo;Functional part&rdquo;</strong> tells Print Perfect to
            prioritize strength. This adds +10% infill density and +1 wall count, making the part
            tougher at the cost of slightly more filament and time.
          </P>
          <P>
            Use this for brackets, hinges, clips, tool holders — anything that will be stressed or
            under load. Leave it unchecked for figurines, decorations, and display models.
          </P>

          <ScreenshotPlaceholder label="Configuration form with printer, filament, and quality tier selected" />

          <div className="h-8" />

          {/* ── SECTION 4: Understanding Your Results ── */}
          <SectionHeading id="section-4" number={4} title="Understanding Your Results" />

          <SubHeading>The filament showcase card</SubHeading>
          <P>
            When your filament brand is found in the Open Filament Database, a{" "}
            <strong>Filament Profile</strong> card appears at the very top of your results.
            It shows the actual manufacturer-specified nozzle and bed temperature ranges,
            filament diameter, density, and a plain-English blurb about the material.
            This is the data your recommendations are based on.
          </P>

          <SubHeading>Estimated print time</SubHeading>
          <P>
            The print time estimate shows as a range (e.g. &ldquo;2h 30m – 3h 15m&rdquo;). Use it for
            relative comparison — Draft vs. Standard — rather than precise scheduling.
            Your slicer will give you the definitive time after slicing.
          </P>

          <SubHeading>Recommended settings panels</SubHeading>
          <P>Your results are organized into five expandable panels:</P>

          <div className="space-y-4 mt-4 mb-4">
            {[
              { icon: "🌡️", title: "Temperature", desc: "Nozzle temp and bed temp calibrated for your filament type and brand data. Each setting shows a confidence badge." },
              { icon: "⚡", title: "Print Speed", desc: "General print speed plus a slower first-layer speed. The first layer speed is critical — don't change it." },
              { icon: "❄️", title: "Cooling Fan", desc: "Fan percentage for your material. PLA needs lots of cooling; ABS and ASA need almost none to avoid warping." },
              { icon: "🌳", title: "Supports", desc: "Whether supports are needed based on your model's actual overhangs. Tree supports use less material and are easier to remove." },
              { icon: "🧲", title: "Bed Adhesion", desc: "None, Brim, or Raft — chosen based on your model's footprint and the material's warping tendency." },
            ].map((p) => (
              <div key={p.title} className="flex gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-xl flex-shrink-0">{p.icon}</span>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{p.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <SubHeading>Confidence scores</SubHeading>
          <div className="space-y-2 mb-4">
            <div className="flex gap-2 items-center text-sm">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px] font-semibold">✓ High</span>
              <span className="text-slate-600 dark:text-slate-300">Well-established value — safe to use as-is.</span>
            </div>
            <div className="flex gap-2 items-center text-sm">
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] font-semibold">~ Medium</span>
              <span className="text-slate-600 dark:text-slate-300">Good starting point — may need minor tuning.</span>
            </div>
            <div className="flex gap-2 items-center text-sm">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[11px] font-semibold">? Low</span>
              <span className="text-slate-600 dark:text-slate-300">Depends on factors we can&apos;t know — dial in with test prints.</span>
            </div>
          </div>

          <SubHeading>Advanced settings</SubHeading>
          <P>
            Each panel has an expandable <strong>Advanced settings</strong> section with values
            like outer/inner wall speeds, support Z distance, elephant foot compensation, and fan
            ramp-up behavior.
          </P>
          <Tip>
            You don&apos;t need to touch advanced settings to get great results. The main settings
            are sufficient for 95% of prints. Advanced settings are for experienced users who want
            fine-grained control.
          </Tip>

          <ScreenshotPlaceholder label="Results page showing settings panels and confidence badges" />

          <div className="h-8" />

          {/* ── SECTION 5: Saving and Sharing ── */}
          <SectionHeading id="section-5" number={5} title="Saving and Sharing" />

          <SubHeading>Your print history</SubHeading>
          <P>
            Every successful analysis is automatically saved to your <strong>print history</strong>{" "}
            (click the clock icon in the nav bar). The last 5 sessions are stored locally in your
            browser — nothing is sent to our servers. Click any history card to review the full results.
          </P>
          <Tip>
            Give your sessions meaningful names. Click the session name below &ldquo;Your Print Settings&rdquo;
            to edit it. A good name like &ldquo;Benchy — Standard PLA — attempt 1&rdquo; makes it easy to
            find results later.
          </Tip>

          <SubHeading>Rating your prints</SubHeading>
          <P>
            After the print finishes, come back to the session (via History) and mark the outcome:
            ✅ <strong>Success</strong>, ⚠️ <strong>Partial</strong>, or ❌ <strong>Failed</strong>.
            This builds a personal record of what works for your printer over time.
          </P>

          <SubHeading>Side-by-side comparison</SubHeading>
          <P>
            On the <Pill>/history</Pill> page, select <strong>Compare</strong> on any two sessions
            to see them side-by-side. Settings that differ are highlighted in amber — making it easy
            to spot what changed between a successful print and a failed one.
          </P>

          <SubHeading>Sharing your results</SubHeading>
          <P>
            The <strong>Share Card</strong> is a downloadable PNG image summarizing your settings,
            formatted for posting on Reddit (<Pill>r/3Dprinting</Pill>), Discord servers, or
            Facebook groups. Click <strong>Download Share Card</strong> on the results page to save it.
          </P>

          <ScreenshotPlaceholder label="Share card download and history comparison view" />

          <div className="h-8" />

          {/* ── SECTION 6: Printer Profiles ── */}
          <SectionHeading id="section-6" number={6} title="Printer Profiles" />

          <SubHeading>Saving your printer setup</SubHeading>
          <P>
            Click <strong>Save as Profile</strong> on the configuration form to save your current
            printer and filament setup as a named profile. Up to 10 profiles can be saved, stored
            locally in your browser.
          </P>
          <P>
            Profiles save: printer model, filament type, nozzle diameter, and bed surface.
            Set one as your <strong>default</strong> and it pre-fills automatically every time
            you open the site.
          </P>

          <Warning>
            Profiles are stored in your browser&apos;s <Pill>localStorage</Pill>. They will not
            save in incognito/private browsing windows. Use a regular browser tab to retain profiles.
          </Warning>

          <div className="h-8" />

          {/* ── SECTION 7: Tips for Beginners ── */}
          <SectionHeading id="section-7" number={7} title="Tips for Beginners" />

          <TipItem bold="Your first layer is everything.">
            If the first layer doesn&apos;t stick, nothing works. Before chasing slicer settings, make
            sure your bed is clean (IPA wipe), level, and your Live Z offset is calibrated.
          </TipItem>
          <TipItem bold="Calibrate your Live Z offset first.">
            If prints are lifting, curling, or being scraped off, your nozzle is too far from the
            bed. Adjusting Live Z takes 2 minutes and fixes more problems than any slicer setting.
          </TipItem>
          <TipItem bold="Dry your filament if it pops or strings.">
            A spool left open for a few weeks absorbs moisture. Signs: popping sounds, excessive
            stringing, rough surface texture, weak layers. Dry at 50–55°C (for PLA) for 4–6 hours,
            or use a filament dryer.
          </TipItem>
          <TipItem bold="Print a temperature tower for new brands.">
            Every brand is slightly different. A temperature tower tests a range of temperatures in
            one 30-minute print — it tells you exactly where your filament performs best. Search
            &ldquo;temperature tower&rdquo; on Printables.com.
          </TipItem>
          <TipItem bold="Don't fully trust the spool label.">
            Manufacturer temperatures are starting points. A spool labelled &ldquo;190–220°C&rdquo; might print
            best at 210°C on your specific printer. Use a temperature tower to find the sweet spot.
          </TipItem>
          <TipItem bold="Bed adhesion surface matters more than you think.">
            PEI textured sheet + correct nozzle height = almost nothing won&apos;t stick. A dirty or
            worn PEI surface causes more failures than any slicer setting.
          </TipItem>
          <TipItem bold="Design supports out where possible.">
            Before adding supports, consider: can I orient the model differently to eliminate overhangs?
            Can it be split into two parts? Supports leave marks on surfaces.
          </TipItem>
          <TipItem bold="Do a small test print first.">
            Before committing 8 hours, print a small section or a calibration cube at the same
            settings. 10 minutes of testing saves hours of failed prints.
          </TipItem>
          <TipItem bold="Join r/3Dprinting.">
            The community is genuinely helpful and has seen every problem you&apos;ll encounter.
            Search before posting — your exact issue has probably already been answered.
          </TipItem>
          <TipItem bold="Your printer is probably fine.">
            Most print failures are settings problems, not hardware problems. Before adjusting your
            printer mechanically, exhaust the settings options first.
          </TipItem>

          <div className="h-8" />

          {/* ── SECTION 8: Tips for Intermediate Users ── */}
          <SectionHeading id="section-8" number={8} title="Tips for Intermediate Users" />

          <TipItem bold="Use the Advanced Settings panels strategically.">
            Outer wall speed directly affects surface quality on visible faces. Support Z distance
            controls how easily supports peel off. These are the knobs worth tuning once you have
            the basics dialed in.
          </TipItem>
          <TipItem bold="Understand the confidence scores.">
            &ldquo;High&rdquo; confidence settings are very unlikely to need changes. Focus your tuning
            energy on &ldquo;Medium&rdquo; and &ldquo;Low&rdquo; settings — those are where your specific printer,
            filament batch, and environment make the biggest difference.
          </TipItem>
          <TipItem bold="Use the comparison view as a tuning database.">
            Run an analysis, print, rate the outcome, adjust one variable, run again. After a few
            cycles you&apos;ll have a personal database of what works. The comparison view shows exactly
            what changed between sessions.
          </TipItem>
          <TipItem bold="Filament density affects weight and length estimates.">
            When your brand is found in the Open Filament Database, the real density value is used
            for calculations. Different brands of the same material can differ by up to 5% in
            density — this adds up on large prints.
          </TipItem>
          <TipItem bold="When to override the support recommendation.">
            The algorithm is conservative — it recommends supports for overhangs over 45°. For short
            overhangs in high-temperature materials or when using capable tree support slicers, you
            can often go bridgeless to 55–60°. Use the recommendation as a starting point.
          </TipItem>
          <TipItem bold="Treat your outcome log as a settings database.">
            The print history + outcome flags build a personal record over time. A month in, you&apos;ll
            have data on what settings work for what models on your specific printer.
          </TipItem>

          <div className="h-8" />

          {/* ── SECTION 9: FAQs ── */}
          <SectionHeading id="section-9" number={9} title="Frequently Asked Questions" />

          <div className="mt-2">
            <FaqItem
              q="Is my model file stored anywhere?"
              a="No. Your file is analyzed entirely in your browser and never uploaded to our servers. When you close the tab, the file data is gone. The only thing stored (locally, in your browser) is your print history."
            />
            <FaqItem
              q="Why does my print time estimate seem off?"
              a="Print time estimates are approximations. Actual times depend on your printer's acceleration profile, the exact slicer you use, and how your printer is calibrated. Use the estimate for relative comparison (Draft vs. Standard) rather than precise planning. Your slicer will give you the definitive time after slicing."
            />
            <FaqItem
              q="The filament database didn't find my brand. What happens?"
              a="Print Perfect falls back to proven generic settings for your filament type. The results are still very good — we just use general PLA/PETG/etc. ranges rather than your brand's specific data. You can still get excellent prints."
            />
            <FaqItem
              q="My 3MF file showed a multi-object warning. What should I do?"
              a={<>Export the part you want to analyze as a standalone STL. In Bambu Studio: right-click the object → Export → Export as STL. In PrusaSlicer: right-click → Export → Export as STL (single part).</>}
            />
            <FaqItem
              q="Can I use these settings directly in my slicer?"
              a="Yes — the recommended values map directly to common slicer fields in Bambu Studio, PrusaSlicer, Cura, and OrcaSlicer. Start with the main settings panel and add the advanced settings as you become more comfortable."
            />
            <FaqItem
              q="Does Print Perfect work for resin printers?"
              a="Currently Print Perfect is designed for FDM (filament-based) printers. Resin printing uses a completely different parameter set and is not yet supported."
            />
            <FaqItem
              q="Why do I need an access key?"
              a={<>Print Perfect is currently in private beta. Contact <strong>info@printperfect.app</strong> to request a key.</>}
            />
            <FaqItem
              q="Does Print Perfect cost anything?"
              a="No — it's free to use. Every analysis costs real money in AI API fees though, so a small Ko-fi tip or a free MakerWorld Boost genuinely helps keep it running."
            />
            <FaqItem
              q="How accurate are the recommendations?"
              a="Very good as a starting point — especially when your filament brand is found in the Open Filament Database. Think of them as an expert's first guess, not a guaranteed recipe. Your specific printer may need minor tuning, particularly for first-layer adhesion and temperature."
            />
            <FaqItem
              q="How many analyses can I run per day?"
              a="By default, 3 free analyses per day. After that, a prompt appears — a Ko-fi tip unlocks unlimited analyses for the day as a thank-you."
            />
          </div>

          <div className="h-8" />

          {/* ── SECTION 10: Changelog ── */}
          <SectionHeading id="section-10" number={10} title="Changelog" />

          <GuideTable
            headers={["Version", "Date", "Summary"]}
            rows={[
              ["v1.5.0", "April 2026", "Two-tier KV/local storage; tip jar side-by-side redesign"],
              ["v1.4.0", "April 2026", "Beta key gate; dynamic admin settings panel"],
              ["v1.3.0", "April 2026", "Filament live preview panel; expanded tip jar"],
              ["v1.2.0", "April 2026", "Print history; share card; outcome flags; comparison view"],
            ]}
          />

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Print Perfect is a free tool built by a maker for makers.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              ← Back to Print Perfect
            </a>
          </div>

        </article>
      </div>
    </div>
  );
}
