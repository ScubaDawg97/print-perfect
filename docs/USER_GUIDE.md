# Print Perfect — User's Guide
## 3D Print Settings in Minutes

> **Version:** 2.0.0 | **Last updated:** April 18, 2026
>
> Print Perfect analyzes your 3D model and recommends the ideal slicer settings
> for your specific printer, filament, and goals — explained in plain English.
> 
> **New in v2.0:** Adjust settings without re-uploading, three-way print purpose 
> (Decorative/Functional/Structural), shrinkage compensation for precision prints, and 
> session variants for easy comparison.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Uploading Your Model](#2-uploading-your-model)
3. [Configuring Your Print](#3-configuring-your-print)
   - [Print Purpose: Decorative, Functional, or Structural](#print-purpose-three-categories)
   - [Adjusting Settings Without Re-uploading](#adjusting-print-settings-without-re-uploading)
4. [Understanding Your Results](#4-understanding-your-results)
   - [Dimensional Accuracy & Shrinkage Compensation](#dimensional-accuracy--shrinkage-compensation-structural-prints-only)
5. [Saving and Sharing](#5-saving-and-sharing)
   - [Variant Sessions](#variant-sessions-from-settings-re-runs)
   - [Side-by-Side Comparison](#side-by-side-comparison)
6. [Printer Profiles](#6-printer-profiles)
7. [Tips for Beginners](#7-tips-for-beginners)
8. [Tips for Intermediate Users](#8-tips-for-intermediate-users)
9. [Frequently Asked Questions](#9-frequently-asked-questions)
10. [Changelog](#10-changelog)

---

## 1. Getting Started

### What is Print Perfect?

Print Perfect is a free tool that takes the guesswork out of 3D printer slicer settings.
You upload your model file, tell it about your printer and filament, and it gives you a
complete set of recommended settings — layer height, temperatures, speed, cooling, supports,
adhesion — all explained in plain English so you understand *why*, not just *what*.

Most slicer settings guides are one-size-fits-all. Print Perfect is different: it analyzes
the actual geometry of your specific model (its size, overhangs, complexity) and combines
that with your specific filament and printer to give you settings that are tailored to
*your* print.

There's no sign-up required, no account, and nothing is stored on our servers. Your model
file is analyzed in your browser and never uploaded anywhere. It's completely free to use,
powered by real manufacturer filament data from the Open Filament Database and Claude AI.

### What you'll need before you start

- A 3D model file (`.STL`, `.OBJ`, or `.3MF`)
- Your printer model name (e.g. "Bambu Lab X1 Carbon", "Prusa MK4")
- Your filament brand and type (e.g. "Hatchbox PLA", "Bambu PETG")
- A few minutes

### Accessing the site

Print Perfect is currently in **private beta** while we test and refine the tool. To access
it, you'll need a beta access key. If you don't have one yet, contact us at
info@printperfect.app and we'll get you set up.

Once you have your key, enter it on the welcome screen. It's saved in your browser, so
you'll only need to enter it once per device.

---

## 2. Uploading Your Model

### Supported file formats

**STL (.stl)** — The most common 3D printing format. Contains exactly one object. If you
have a choice, prefer STL for the simplest and most reliable results.

**OBJ (.obj)** — Another common format, slightly more complex than STL. Works well for
single objects and is widely supported.

**3MF (.3mf)** — A newer format used by Bambu Studio and PrusaSlicer. Can contain multiple
objects or multiple build plates.

> ⚠️ **Multi-object 3MF files:** If your 3MF file contains more than one object, Print
> Perfect will warn you and results may be less accurate. For best results, export individual
> parts as separate files. In Bambu Studio: right-click the object → Export → Export as STL.

### File size limit

Files up to **50 MB** are supported. For very large or complex files, the geometry analysis
may take a few extra seconds.

### Tips for best results

1. **Single-object files work best.** If your model has multiple parts, analyze each one
   separately for the most accurate settings.
2. **Watch for the multi-object warning.** If you see it, export individual parts as STL
   files for cleaner results.
3. **Your model should be "watertight."** This means the mesh has no holes or open edges.
   Most models from reputable design sites are fine — if you made your own, run it through
   a repair tool (Meshmixer, PrusaSlicer's repair feature) first.
4. **Analyze one part at a time.** Even if you're printing multiple copies, analyze one
   to get the settings, then multiply in your slicer.
5. **Large files may take a moment.** Files over 20 MB or with very high triangle counts
   take 2–3 extra seconds to process.

### What happens when you upload

The moment your file loads, Print Perfect automatically:

- **Analyzes the geometry** — measures exact dimensions (width × depth × height in mm),
  calculates volume, estimates surface area, and counts triangles.
- **Detects overhangs** — identifies faces that overhang more than 45° from vertical,
  which determines whether supports are needed.
- **Scores complexity** — classifies the model as Simple, Moderate, or Complex based on
  geometry, which affects speed recommendations.
- **Auto-orients the model** — rotates it so the flattest face rests on the virtual build
  plate, the same way most slicers would orient it by default.
- **Renders a 3D preview** — shows you a rotatable, zoomable 3D view of your model.

### Understanding the 3D viewer

The viewer shows your model as it would sit on the print bed:

- **Rotate:** Click and drag to spin the model
- **Zoom:** Scroll wheel to zoom in and out
- **Auto-oriented note:** If the model was rotated for you, a small note appears.
  The orientation is purely for analysis — your slicer will orient it how you prefer.

---

## 3. Configuring Your Print

### Selecting your printer

Choose your printer from the dropdown. Over 55 printers are supported, organized by brand —
Bambu Lab, Prusa, Creality, Voron, Bambu, Elegoo, AnkerMake, and many more.

If your exact printer isn't listed, choose the closest model from the same brand, or select
**"Other"** — you'll still get solid generic settings for your filament type.

💡 **Save your setup:** After your first analysis, save your printer as a profile (see
[Section 6](#6-printer-profiles)) so you don't have to re-enter it every time.

### Filament type

| Filament | Best for | Notes |
|---|---|---|
| **PLA** | Everything — the default | Easiest to print. Start here. |
| **PLA+** | Stronger everyday parts | Same ease as PLA, slightly tougher. |
| **PLA Silk** | Display pieces, gifts | Beautiful glossy finish. Slower and more fussy. |
| **PLA-CF** | Stiff structural parts | Carbon fiber reinforced. Abrasive on brass nozzles. |
| **PETG** | Functional parts | Stronger than PLA, slightly flexible, more heat resistant. |
| **PETG-CF** | Very strong structural parts | Carbon fiber PETG. Stiff and tough. |
| **ABS** | Heat-resistant parts | Strong but warps badly — needs an enclosure. |
| **ASA** | Outdoor parts | Like ABS but UV-resistant. |
| **TPU** | Flexible parts | Rubber-like. Great for phone cases and gaskets. |
| **Nylon** | Wear-resistant parts | Tough but absorbs moisture quickly — store carefully. |
| **Polycarbonate (PC)** | High-stress parts | Extremely strong. Needs very high temperatures. |
| **Resin** | SLA/MSLA printers | A completely different type of printer — FDM settings don't apply. |

### Filament brand and the Open Filament Database

💡 **Pro tip:** Enter your exact filament brand name (e.g. "Bambu", "Hatchbox", "Prusament",
"eSUN"). Print Perfect searches the **Open Filament Database** — a community-maintained
registry of real manufacturer filament specifications.

When your brand and filament type are found in the database, a green **Filament Profile**
card appears at the top of your results, showing actual manufacturer-specified temperature
ranges, density, and diameter. Your recommendations will be based on real data for your
specific product, not generic estimates.

If your brand isn't found, Print Perfect falls back to proven generic ranges for your
filament type — the results are still very good.

### Nozzle diameter

| Diameter | Best for |
|---|---|
| **0.2mm** | Ultra-fine detail: miniatures, intricate ornamental parts. Very slow. |
| **0.4mm** | The standard. Best balance of speed and quality. Start here. |
| **0.6mm** | Faster prints with slightly less detail. Great for large functional parts. |
| **0.8mm** | Fast and strong. Draft prints and structural parts. |

Most printers ship with a 0.4mm nozzle. If you haven't changed yours, select 0.4mm.

### Bed surface type

Your bed surface type affects the recommended bed temperature. Common surfaces:

- **PEI Textured** — Excellent adhesion for PLA and PETG. The most popular choice.
- **PEI Smooth** — Better for flexible materials. Slightly lower adhesion than textured.
- **Glass** — Reliable but needs higher temps and sometimes a bit of adhesive.
- **Bambu Cool Plate / Bambu Engineering Plate / Bambu High Temp Plate** — Bambu Lab
  printer-specific surfaces, each optimized for different filament families.

### Room humidity (auto-detected)

If you allow location access, Print Perfect automatically reads your current local humidity
from a weather service and fills it in for you. No personal data is stored.

**Why humidity matters:** Moisture in the air slowly seeps into filament, especially PETG,
Nylon, and ABS. High humidity can cause:

- 🔊 Popping or crackling sounds while printing
- 🕸️ Excessive stringing between parts
- 💧 Weak, brittle layers (moisture turns to steam in the nozzle)

If you print in a humid environment, consider drying your filament before use (see
[Tips for Beginners](#7-tips-for-beginners)).

### Print quality tier

| Tier | Layer Height | Speed | Best for |
|---|---|---|---|
| **Draft** | 0.28mm | Fast | Fit tests, prototypes, things you'll reprint |
| **Standard** | 0.20mm | Moderate | Everyday prints — the sweet spot |
| **Quality** | 0.12mm | Slow | Visible parts where surface finish matters |
| **Ultra** | 0.08mm | Very slow | Display pieces, fine detail, maximum quality |

> ⚠️ **Ultra quality warning:** Ultra is NOT recommended for large models. Print times
> become extreme — a 100mm cube at Ultra can take 20+ hours. Reserve Ultra for small,
> detail-critical pieces.

### Print purpose: Three categories

Instead of a simple on/off toggle, Print Perfect now uses a **three-way classification**
to give you better recommendations:

| Purpose | Best For | Print Overrides |
|---|---|---|
| **🎨 Decorative** | Figurines, decorations, display models, prototypes | Standard settings — focused on appearance and speed |
| **🔧 Functional** | Brackets, hinges, clips, tool holders, everyday parts | +10% infill, +1 wall; slight strength priority |
| **🏗️ Structural** | Load-bearing parts, assemblies, stress-critical components | 35%+ infill, 4+ walls, reduced speed, +5°C temp, enhanced cooling control |

**When to use Structural:**
- Parts that will experience physical stress or vibration
- Load-bearing assemblies (mounts, brackets under load)
- Components with tight mechanical fits or threads
- Parts that must last through repeated use
- Anything that will be post-processed (reinforced, glued, etc.)

**Structural Details:**
When you select "Structural," Print Perfect automatically applies these overrides:
- **Minimum 35% infill** (vs. typical 15–20%)
- **Minimum 4 wall layers** (vs. typical 2–3)
- **-15% print speed** (safer, less stress on extrusion)
- **+5°C print temperature** (better layer bonding)
- **Reduced cooling fan** 60–70% (except PLA at 80% — higher temps reduce strength)
- **0.25mm first layer height** (extra strong foundation)
- **15mm/s first layer speed** (maximum adhesion)

---

### Adjusting print settings without re-uploading

Once you have initial results, you don't need to re-upload your file. Click the 
**⚙️ Adjust Settings** button (appears at the top and bottom of your results) to tweak 
your configuration and re-run the analysis instantly.

#### What the Settings Panel Does

The slide-in settings editor lets you change:
- **Printer model** — Switch printers from your equipment list
- **Nozzle diameter** — 0.2mm, 0.4mm, 0.6mm, or 0.8mm
- **Filament type** — PLA, PETG, ABS, etc.
- **Filament brand** — For Open Filament Database lookup
- **Bed surface** — Your build plate type
- **Quality tier** — Draft, Standard, Quality, or Ultra
- **Print purpose** — Decorative, Functional, or Structural
- **Humidity** — Room humidity level
- **Problem description** — Any issues you want Claude to address

#### How It Works

1. Click **⚙️ Adjust Settings**
2. The panel slides in from the right side
3. Make your changes (sections are collapsible)
4. A "Changes:" list at the bottom shows what you modified
5. Click **[Re-run Analysis]** to generate new recommendations
6. A **new history entry** is created with a variant name (e.g., "model.stl — Quality tier variant")
7. Results update in place, and the panel closes

**Tip:** Use the [Reset] button to discard changes and start over.

#### Why This Matters

Testing different settings is now instant — no file re-upload, no waiting for geometry 
analysis. Change your filament type, bump to Structural, or test Ultra quality in seconds. 
Each re-run saves as a variant so you can compare results side-by-side.

---

## 4. Understanding Your Results

### The filament showcase card

When your filament brand is found in the Open Filament Database, a **Filament Profile**
card appears at the very top of your results — before the settings panels. It shows:

- Manufacturer name and product name
- Material type badge (e.g. "PLA", "PETG")
- Actual manufacturer-specified nozzle and bed temperature ranges
- Filament diameter and density
- A plain-English blurb about this material type

This card is the data your recommendations are based on. Compare it to the spec sheet
that came with your filament — if your spool says something different, trust the physical
spool.

### Estimated print time

The print time estimate appears as a range (e.g. "2h 30m – 3h 15m"). It's calculated
from your model's volume, surface area, and the recommended settings. This is an
approximation — actual times vary based on:

- Your printer's specific acceleration profile
- The exact slicer you use (Bambu Studio, PrusaSlicer, Cura, etc.)
- How the model is oriented in your slicer

Use the estimate for relative comparison ("Draft is 2× faster than Quality for this model")
rather than for precise scheduling. Your slicer will give you the definitive time after slicing.

### Tip jar

Print Perfect is free to use and always will be. Every analysis runs on real AI that costs
real money. If the tool saved your print (or your sanity), a small Ko-fi tip or a free
MakerWorld Boost genuinely helps keep it running. These appear between the print time and
the settings panels — no pressure, always optional.

### Recommended settings panels

Your results are organized into five expandable panels:

#### Temperature

- **Nozzle temperature** — The main print temperature. Calibrated for your filament type
  and brand data where available.
- **Bed temperature** — Calibrated for your bed surface and filament combination.
- **Confidence badges** — Each setting shows a badge: ✓ High, ~ Medium, or ? Low.
  High confidence means the value is well-established (e.g. PLA on PEI is well-understood).
  Low confidence means it depends on factors we can't know (your specific filament batch,
  room temperature, printer calibration).

#### Print Speed

- **Print speed** — The general speed for most of the print.
- **First layer speed** — Always slower than the main speed to ensure good bed adhesion.
  Don't change this — it's critical.

#### Cooling

- **Fan percentage** — How hard the cooling fan works. PLA needs lots of cooling. ABS and
  ASA need almost none (rapid cooling causes warping).
- **Why cooling matters** — Cooling solidifies each layer before the next one is deposited.
  Too little = drooping overhangs. Too much = poor layer bonding for high-temp materials.

#### Supports

- Whether supports are needed, and why, based on your model's actual overhang geometry.
- **Tree supports** — Recommended for models with isolated overhangs. Use less material
  and are easier to remove.
- **Normal supports** — Grid-pattern. More compatible with all slicers.

#### Bed Adhesion

- **None** — The model's footprint is large enough to stick reliably on its own.
- **Brim** — A flat ring of extra plastic around the base. Increases contact area for
  small or tall models.
- **Raft** — A full layer platform underneath the model. Used for materials that warp
  (ABS, ASA) or very small contact footprints.

### Dimensional Accuracy & Shrinkage Compensation (Structural Prints Only)

When you select **🏗️ Structural** as your print purpose, a new section appears below
the Bed & Adhesion settings: **📏 Dimensional Accuracy & Shrinkage Compensation**.

This section helps you account for **material shrinkage** — the fact that most plastics
shrink slightly as they cool after printing. For decorative prints, this is negligible.
For structural parts with tight tolerances or mating surfaces, it's critical.

#### Understanding Shrinkage

Different materials shrink at different rates:

| Material | Shrinkage | Compensation |
|---|---|---|
| **PLA** | 0.3% | Minimal — usually optional |
| **PLA+** | 0.5% | Minimal |
| **PETG** | 1.5–2.0% | Moderate — recommended for fits |
| **ABS** | 2.5–3.0% | Significant — essential for precision |
| **ASA** | 2.0–2.5% | Moderate to significant |
| **Nylon (PA)** | 3–4% | Highest — compensation essential |
| **PC** | 2.0–2.5% | Significant |

#### The Shrinkage Panel Explains

**Scale Compensation:**
- **XY Shrinkage %** — Horizontal shrinkage (width & depth)
- **Scale factor** — What to set in your slicer (e.g., "102.1%") to compensate
- **Z Shrinkage %** — Vertical shrinkage (layer height effect)

**Significance Indicator:**
- ✓ **Minimal** (green) — Compensation usually optional. Good for decorative or loose-fit parts.
- ~ **Moderate** (amber) — Recommended if tolerances are tight (<0.5mm). Optional for looser fits.
- ⚠️ **Significant** (red) — Compensation is essential. Apply the scale factor in your slicer before printing.

**Common Hole Sizes Table:**
Shows compensated diameters for typical bolt holes (M3, M4, M5, etc.). For example:
- Nominal: 5mm → Compensated: 5.1mm (for 2% shrinkage)

This table is a quick reference — type your exact hole size into the compensation formula
if it's not listed.

**Layer Orientation Guidance:**
Tips on whether your model's orientation matters more for X/Y or Z shrinkage, based on
its dimensions.

**Material-Specific Guidance:**
Each filament type has unique tips. For Nylon: "Nylon is hygroscopic (absorbs moisture 
from air). Store in dry environment; use desiccant storage." For ABS: "Enclosed chamber
prevents drafts and reduces variation."

#### How to Use Shrinkage Compensation

1. Note the **scale factor** from the panel (e.g., "102.1%")
2. In your slicer (Bambu Studio, PrusaSlicer, Cura, etc.):
   - Find the model scale/resize tool
   - Set it to the factor shown (102.1%)
   - Apply to your model
3. Slice and print normally
4. The printed part will shrink back to nominal dimensions

**Example:**
- You need a 50mm bolt hole
- Filament shrinkage is 2%
- Panel shows compensated size: 51mm
- Scale your model to 102% in slicer
- Slice and print
- Result: ~50mm hole (within tolerance)

### Advanced settings (expandable panels)

Each settings panel has an **"Advanced settings"** section you can expand. These include:

- Outer/inner wall speeds, top/bottom surface speed
- First layer temperature, standby temperature
- Support Z distance and interface layers
- Elephant foot compensation, brim gap
- Fan ramp-up behavior, minimum layer time

> 💡 **Beginner note:** You don't need to touch advanced settings to get great results.
> The main settings are sufficient for 95% of prints. Advanced settings are for experienced
> users who want fine-grained control.

### Confidence scores

Every setting card shows a confidence badge:

- **✓ High confidence** — Well-established value with little variation. Safe to use as-is.
- **~ Medium confidence** — Good starting point, may need minor tuning for your specific
  printer or filament batch.
- **? Low confidence** — Depends heavily on factors we can't know. Use as a starting point
  and dial in with test prints.

### Watch Out For / Tips for Success / Common Mistakes

Beneath the settings panels you'll find three AI-generated sections specific to your
exact filament type and printer:

- **Watch Out For** — Specific pitfalls for this print (e.g. warping risk, stringing risk)
- **Tips for Success** — Actionable advice tailored to your setup
- **Common Mistakes** — What beginners typically get wrong with this filament on this printer

These are generated fresh by Claude AI for your specific combination — not generic copy-paste advice.

---

## 5. Saving and Sharing

### Your print history

Every successful analysis is automatically saved to your **print history** (accessible via
the clock icon in the navigation bar). The last 5 sessions are stored locally in your
browser — nothing is sent to our servers.

Each saved session stores your complete results: settings, AI explanations, filament data,
and estimated print time. Click any history card to review it.

**Naming your sessions:** Click the session name below the "Your Print Settings" heading
to edit it. The default name is generated from your file name and quality tier. A good
name helps you find results later: "Benchy — Standard PLA — attempt 1".

### Rating your prints

After the print finishes, come back to the session and mark the outcome:

- ✅ **Success** — It printed well
- ⚠️ **Partial** — Printed but had issues
- ❌ **Failed** — Didn't print, or came out unusable

This appears on your share card and helps you build a personal record of what works over time.

### Variant sessions from settings re-runs

When you use the **⚙️ Adjust Settings** panel to re-run analysis, the new session 
is saved as a **variant** of the original with a descriptive name:

- Change quality tier → "model.stl — Quality tier variant"
- Change filament type → "model.stl — Filament type variant"
- Change print purpose → "model.stl — Print purpose variant"
- Change multiple settings → Shows the first change made

This makes it easy to find related sessions in your history and compare different
parameter combinations.

### Side-by-side comparison

On the `/history` page, select any two sessions (including variants) and click **Compare** 
to see them side-by-side. Settings that differ between the two prints are highlighted in 
amber, making it easy to spot what changed.

**What you'll see:**
- Session names and dates at the top (labeled A and B)
- "Key differences at a glance" summary
- Full comparison table with these sections:
  - **Inputs:** Printer, filament, nozzle, bed surface, quality, purpose, humidity
  - **Geometry:** Model dimensions, complexity, overhang severity
  - **Main Settings:** Layer height, temperatures, speeds, infill, cooling, supports, adhesion
  - **Advanced:** Detailed speed/temp settings

**Important:** Printer and bed surface names now display properly (e.g., "Creality Ender 3 V3", 
"PEI Textured") instead of internal IDs. This makes it easy to see exactly which equipment 
configuration you tested.

### Sharing your results

The **Share Card** is a downloadable PNG image summarizing your settings — formatted for
posting on Reddit (`r/3Dprinting`), Discord servers, or Facebook groups. Click
**Download Share Card** on the results page to save it.

The share card includes: your settings at a glance, filament type, printer, quality tier,
and outcome flag (if rated).

---

## 6. Printer Profiles

### Saving your printer setup

Click **Save as Profile** on the configuration form to save your current printer and
filament type as a named profile. Up to 10 profiles can be saved, stored locally in
your browser.

Profiles save: printer model, filament type, nozzle diameter, and bed surface.

### Managing multiple printers

If you have multiple printers, create a profile for each. Switch between them from the
profile dropdown at the top of the configuration form. Set one as your **default** and
it will pre-fill automatically every time you open the site.

> ⚠️ **Private browsing:** Profiles are stored in `localStorage`. They will not save
> in incognito/private browsing windows. Use a regular browser tab to retain profiles.

---

## 7. Tips for Beginners

**1. Your first layer is everything.**
If the first layer doesn't stick, nothing else works. Before chasing slicer settings,
make sure your bed is clean (IPA wipe), level, and your Live Z offset is calibrated.

**2. Calibrate your Live Z offset first.**
If prints are lifting, curling, or being scraped off, your nozzle is too far from the bed.
Adjusting Live Z takes 2 minutes and fixes more problems than any slicer setting change.

**3. Dry your filament if it pops or strings.**
A spool of filament left open for a few weeks absorbs moisture. Signs of wet filament:
popping sounds while printing, excessive stringing, rough surface texture, weak layers.
Dry it in your oven at 50–55°C (for PLA) for 4–6 hours, or use a filament dryer.

**4. Print a temperature tower for new filament brands.**
Every brand is slightly different, even within the same material. A temperature tower
prints a small test at decreasing temperatures — it takes 30 minutes and tells you exactly
where your filament performs best. Search "temperature tower" on Printables.com.

**5. Don't fully trust the spool label.**
Manufacturer temperatures are starting points, not gospel. A spool labelled "190–220°C"
might print best at 210°C on your specific printer. The temperature tower will tell you.

**6. Bed adhesion surface matters more than you think.**
PEI textured sheet + clean nozzle height = almost nothing won't stick. A dirty or worn
PEI surface causes more failures than any slicer setting.

**7. Design supports out where possible.**
Before adding supports, consider: can I orient the model differently to eliminate overhangs?
Can the model be split into two parts that each print without supports? Supports leave marks
on surfaces and are never as clean as printing without them.

**8. Do a small test print first.**
Before committing 8 hours, print a small section of the model (use your slicer's "height
range" feature) or a calibration cube at the same settings. 10 minutes of testing saves
hours of failed prints.

**9. Join r/3Dprinting.**
The community on Reddit is genuinely helpful and has seen every problem you'll ever encounter.
Search before posting — your exact issue has probably already been answered.

**10. Your printer is probably fine.**
Most print failures are settings problems, not hardware problems. Before adjusting your
printer mechanically, exhaust the settings options first.

---

## 8. Tips for Intermediate Users

**Use the Advanced Settings panels strategically.**
The expandable advanced panels contain values that most beginners can ignore — but if you're
tuning for a specific application, they're valuable. Outer wall speed directly affects
surface quality on visible faces. Support Z distance controls how easily supports peel off.

**Understand the confidence scores.**
"High" confidence settings are very unlikely to need changes. Focus your tuning energy on
"Medium" and "Low" confidence settings — those are the ones where your specific printer,
filament batch, and environment make the biggest difference.

**Use the comparison view as a tuning database.**
Run an analysis, print, rate the outcome, then adjust one variable and run again. After
a few cycles you'll have a personal database of what works. The comparison view makes
it easy to see exactly what changed between a good print and a bad one.

**Filament density affects weight/length estimates.**
If your filament brand is found in the Open Filament Database, the density value is used
for calculating filament weight. Different brands of the same material can have density
differences of up to 5%, which adds up on large prints.

**When to ignore the support recommendation.**
The algorithm is conservative — it recommends supports for overhangs over 45°. For short
overhangs in high-temperature materials (ABS, ASA) or when using tree supports, you can
often go bridgeless to 55–60°. Trust the recommendation as a starting point, then
experiment with your specific printer's bridging capability.

**Treat your outcome log as a settings database.**
The print history + outcome flags build a personal record over time. A month in, you'll
have a dataset of what settings work for what models on your specific printer. Use it
to calibrate your intuition before starting a new analysis.

---

## 9. Frequently Asked Questions

**Q: Is my model file stored anywhere?**
A: No. Your file is analyzed entirely in your browser and never uploaded to our servers.
When you close the tab, the file data is gone. The only thing stored (locally, in your
browser) is your print history.

**Q: Why does my print time estimate seem off?**
A: Print time estimates are approximations. Actual times depend on your specific printer's
acceleration profile, the exact slicer you use, and how your printer is calibrated.
Use the estimate for relative comparison (Draft vs. Standard) rather than precise planning.
Your slicer will give you the definitive time after slicing.

**Q: The filament database didn't find my brand. What happens?**
A: Print Perfect falls back to proven generic settings for your filament type. The results
are still very good — we just use general PLA/PETG/etc. temperature ranges rather than
your brand's specific data. You can still get excellent prints.

**Q: My 3MF file showed a multi-object warning. What should I do?**
A: Export the part you want to analyze as a standalone STL from your slicer.
In Bambu Studio: right-click the object → Export → Export as STL.
In PrusaSlicer: right-click → Export → Export as STL (single part).

**Q: Can I use these settings directly in my slicer?**
A: Yes — the recommended values map directly to common slicer fields (Bambu Studio,
PrusaSlicer, Cura, OrcaSlicer). Start with the main settings panel and add the advanced
settings as you become more comfortable. The field names in your slicer may differ slightly,
but they correspond to the same parameters.

**Q: Does Print Perfect work for resin printers?**
A: Currently Print Perfect is designed for FDM (filament-based) printers. Resin printing
uses a completely different parameter set (layer exposure time, lift speed, etc.) and is
not yet supported. Resin is listed as a filament type for users who have both printer types
and want to note the material, but FDM-specific settings won't apply.

**Q: Why do I need an access key?**
A: Print Perfect is currently in private beta while we test and refine the tool. The key
helps us manage access and gather focused feedback. Contact info@printperfect.app to
request one.

**Q: How do I report a problem or suggest a feature?**
A: Email info@printperfect.app with your feedback. We read everything.

**Q: Does Print Perfect cost anything?**
A: No — it's free to use. Every analysis costs real money in AI API fees though, so a
small Ko-fi tip or a free MakerWorld Boost genuinely helps keep it running.

**Q: How accurate are the recommendations?**
A: Very good as a starting point — especially when your filament brand is found in the
Open Filament Database. Think of them as an expert's first guess, not a guaranteed recipe.
Your specific printer may need minor tuning, particularly for first-layer adhesion (Live Z)
and temperature (use a temperature tower for new brands).

**Q: How many analyses can I run per day?**
A: By default, 3 free analyses per day. After that, a prompt appears — a Ko-fi tip
unlocks unlimited analyses for the day as a thank-you. Re-running with adjusted settings
(via the ⚙️ panel) also counts against your daily limit.

**Q: What's the difference between Decorative, Functional, and Structural?**
A: **Decorative** is for non-functional prints where appearance matters most. **Functional** adds strength for parts that perform tasks (brackets, tool holders). **Structural** is for load-bearing or precision-critical parts — it applies 35%+ infill, 4+ walls, slower speeds, and higher temperatures for maximum durability and dimensional accuracy.

**Q: Do I need to use shrinkage compensation?**
A: Only if you're printing **Structural** and your material has moderate to significant shrinkage. If the green panel says "Minimal," compensation is optional. If it says "Moderate" or "Significant," apply the scale factor in your slicer before printing, especially for parts with tight mechanical fits.

**Q: How do I use the Scale Compensation value in my slicer?**
A: The panel shows a scale factor (e.g., "102.1%"). In your slicer:
1. Select your model
2. Find the "Scale" or "Resize" option
3. Set it to the percentage shown
4. Apply and slice normally
Your printed part will shrink back to the original size during cooling.

**Q: Can I adjust settings and re-run analysis without re-uploading?**
A: Yes! Click the **⚙️ Adjust Settings** button on your results page. Change printer, filament, quality, purpose, humidity, or problem description, then click [Re-run Analysis]. A new session is created as a variant so you can compare both versions.

**Q: What are "variant" sessions?**
A: When you use the settings editor to re-run analysis, the new session is saved with a descriptive name (e.g., "model.stl — Quality tier variant"). This makes it easy to find related sessions and compare what changed between settings.

**Q: Do I need to re-upload my file to test different filament types?**
A: No. Use the ⚙️ Adjust Settings panel, change the filament type, and re-run. Your geometry analysis is cached, so it's instant. This is great for testing how PLA vs. PETG vs. ABS recommendations differ for the same model.

**Q: Why are printer and surface names now showing instead of codes?**
A: Previous versions could show internal identifiers. Version 2.0 uses the human-readable names from the equipment database (e.g., "Creality Ender 3 V3", "PEI Textured") consistently everywhere — dropdowns, results, and comparisons.

---

## 10. Changelog

See the Admin Dashboard for full version history.

| Version | Date | Summary |
|---|---|---|
| v2.0.0 | April 2026 | **Adjust Settings panel** — re-run analysis without re-uploading; **Three-way print purpose** (Decorative/Functional/Structural) with rule engine overrides; **Shrinkage Compensation** for structural/precision prints; **Session variants** (auto-named based on changes); **Equipment searchable selects** (no more GUIDs); improved comparison view |
| v1.5.0 | April 2026 | Two-tier KV/local storage; tip jar redesign |
| v1.4.0 | April 2026 | Beta key gate; dynamic admin settings panel |
| v1.3.0 | April 2026 | Filament live preview panel; expanded tip jar |
| v1.2.0 | April 2026 | Print history; share card; outcome flags |

---

*Print Perfect is a free tool built by a maker for makers.*

*[printperfect.app](https://printperfect.app)*
