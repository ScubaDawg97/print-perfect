# PrintPerfect — User Acceptance Testing (UAT) Scenarios

## Overview
This document contains step-by-step testing scenarios to validate the recent enhancements:
1. **Slide-In Settings Editor** — Adjust print settings without re-uploading files
2. **Structural Category** — Three-way print purpose (Decorative/Functional/Structural) with rule engine overrides and shrinkage compensation
3. **Equipment Selection UI** — Searchable dropdowns with proper name display (no GUIDs)
4. **History & Comparison** — Session saving and variant comparison

---

## FEATURE 1: Slide-In Settings Editor

### Scenario 1.1: Open Settings Editor from Results Page
**Objective:** Verify settings editor panel opens from both top and bottom "Adjust Settings" buttons

**Steps:**
1. Upload a 3D model file (STL, OBJ, or 3MF)
2. Wait for analysis to complete and see results
3. Locate the "⚙️ Adjust Settings" button at the **top** of the results (below geometry visualizer)
4. Click it

**Expected Results:**
- Slide-in panel appears from the right side
- Panel shows "⚙️ Adjust Settings" header with X close button
- Four collapsible sections visible: "Printer & Nozzle", "Filament", "Print Settings", "Problem Description"
- "Print Settings" section is expanded by default
- Overlay darkens the background behind the panel
- Panel is scrollable if content exceeds viewport

**Notes:**
- Repeat step 3 but click the "⚙️ Adjust Settings" button at the **bottom** of results
- Should behave identically

---

### Scenario 1.2: Collapse/Expand Sections
**Objective:** Verify collapsible sections work smoothly

**Steps:**
1. Open the settings editor (from Scenario 1.1)
2. Click on "Printer & Nozzle" section header
3. Observe the chevron icon next to the title
4. Click again to expand

**Expected Results:**
- Section smoothly collapses/expands with animation
- Chevron rotates 180° when open/closed
- Content inside section is hidden when collapsed
- Other sections remain unaffected

---

### Scenario 1.3: Change Quality Tier
**Objective:** Verify quality tier buttons work and reflect change

**Steps:**
1. Open settings editor with "Print Settings" expanded
2. Note the current "Quality Tier" selection (likely "Standard" if not changed)
3. Click "Ultra" button (💎 icon)

**Expected Results:**
- "Ultra" button highlights with blue border and blue background
- Previously selected button (e.g., "Standard") returns to unselected appearance
- A "Changes:" summary appears at the bottom showing "Quality tier"
- The change is tracked immediately

---

### Scenario 1.4: Change Print Purpose (Decorative/Functional/Structural)
**Objective:** Verify three-way print purpose selector

**Steps:**
1. Open settings editor with "Print Settings" expanded
2. Locate "Print Purpose" section with three buttons: 🎨 Decorative, 🔧 Functional, 🏗️ Structural
3. Click "🏗️ Structural"

**Expected Results:**
- "Structural" button highlights
- "Changes:" list updates to include "Print purpose"
- (Verify in next scenario that Structural provides shrinkage info)

---

### Scenario 1.5: Change Bed Surface with Equipment Dropdown
**Objective:** Verify SearchableSelect shows proper surface names (not GUIDs)

**Steps:**
1. Open settings editor with "Print Settings" expanded
2. Scroll down to "Bed Surface" field
3. Click the bed surface dropdown

**Expected Results:**
- Dropdown opens showing a list of surfaces **grouped by category**
- Each surface shows a **human-readable name** (e.g., "PEI Textured", "Bambu Cool Plate", "Borosilicate Glass")
- **NO UUIDs are visible** in the dropdown list
- Grouping shows category headers like "PEI (most common)", "Bambu Lab plates", "Glass", etc.
4. Type "pei" in the search box

**Expected Results:**
- List filters to show only surfaces matching "pei"
- Search highlighting shows "pei" in bold/yellow
- "Other / Unknown" option always remains visible even when searching

---

### Scenario 1.6: Current Selection Display Below Dropdown
**Objective:** Verify selected surface name is properly resolved

**Steps:**
1. In the bed surface dropdown, select "Bambu Cool Plate"
2. Close the dropdown (click elsewhere or press Escape)

**Expected Results:**
- Selected value shows "Bambu Cool Plate" in the input field
- Below the dropdown, text displays: "Current: Bambu Cool Plate"
- **NOT a UUID or undefined value**

---

### Scenario 1.7: Change Printer Model
**Objective:** Verify printer selection dropdown and resolution

**Steps:**
1. Collapse "Print Settings" and expand "Printer & Nozzle"
2. Click the "Printer Model" dropdown

**Expected Results:**
- Dropdown shows printers **grouped by vendor** (Creality, Bambu Lab, Prusa, etc.)
- Each printer shows **human-readable name** (e.g., "Ender 3 V3", "A1 Mini", "MK4S")
- **NO UUIDs visible**
3. Type "ender" to search

**Expected Results:**
- List filters to Creality printers with "Ender" in the name
- Previous searches show vendor name → printer model (e.g., "Creality Ender 3 V3")
4. Select a printer

**Expected Results:**
- Selected value shows in input (e.g., "Ender 3 V3")
- Below dropdown: "Current: Creality Ender 3 V3"

---

### Scenario 1.8: Changes Summary Footer
**Objective:** Verify footer shows all tracked changes

**Steps:**
1. Open settings editor
2. Make multiple changes:
   - Change Quality Tier to "Ultra"
   - Change Print Purpose to "Structural"
   - Change Bed Surface to "PEI Smooth"
   - Type a problem description: "Warping on edges"
3. Scroll to the bottom of the panel

**Expected Results:**
- "Changes:" section shows amber background
- Lists all changes in bullet points:
  - Quality tier
  - Print purpose
  - Bed surface
  - Problem description
- **[Reset]** button is enabled (not grayed out)
- **[Re-run Analysis]** button is enabled

---

### Scenario 1.9: Reset Button
**Objective:** Verify reset clears all changes

**Steps:**
1. Make several changes (from Scenario 1.8)
2. Click **[Reset]** button

**Expected Results:**
- All fields revert to original values
- Changes summary disappears
- [Reset] and [Re-run Analysis] buttons become disabled (grayed out)
- No error messages

---

### Scenario 1.10: Re-run Analysis
**Objective:** Verify re-analysis with new settings creates a variant session

**Prerequisites:**
- Complete Scenario 1.8 (make changes, verify summary)
- Ensure you have remaining analyses available (check rate limit warning)

**Steps:**
1. With changes pending, click **[Re-run Analysis]**

**Expected Results:**
- Loading state: button shows "Re-running..." and is disabled
- Panel stays open during analysis
- After ~5-10 seconds, results update in place
- Panel closes automatically
- Success toast appears (brief notification)
- New session entry in history shows **variant name**: e.g., "Model.stl — Quality tier variant" or "Model.stl — Bed surface variant"

**Next Steps:**
- Go to history page to verify variant was saved

---

### Scenario 1.11: Escape Key Closes Panel
**Objective:** Verify keyboard shortcut

**Steps:**
1. Open settings editor
2. Press **Escape** key

**Expected Results:**
- Panel closes immediately
- Overlay disappears
- Panel can be reopened from buttons

---

### Scenario 1.12: Clicking Overlay Closes Panel
**Objective:** Verify overlay click dismisses panel

**Steps:**
1. Open settings editor
2. Click the dark overlay (semi-transparent area to the left of the panel)

**Expected Results:**
- Panel closes
- User returns to results view

---

### Scenario 1.13: Rate Limit Warning
**Objective:** Verify warning displays when approaching limit

**Prerequisites:**
- Have already used 7 or 8 analyses today (out of 10 daily free)

**Steps:**
1. Open settings editor
2. Make a change
3. Scroll to footer

**Expected Results:**
- ⚠️ Warning box appears: "Last free analysis today"
- Text explains: "After this, you'll need to unlock for more analyses"
- [Re-run Analysis] button is still enabled but warning is prominent

---

## FEATURE 2: Structural Category & Shrinkage Compensation

### Scenario 2.1: Select Structural Print Purpose
**Objective:** Verify structural category triggers rule engine overrides and UI changes

**Steps:**
1. Upload a 3D model that could be functional (e.g., a bracket or mount)
2. Open settings editor
3. In "Print Settings" section, click "🏗️ Structural" button
4. Click [Re-run Analysis]

**Expected Results:**
- Results update with new recommendations
- In the **Print Settings** section of results, observe these values:
  - **Infill:** ≥35% (minimum)
  - **Wall Count:** ≥4 (minimum)
  - **Print Speed:** reduced by ~15% from standard
  - **Cooling Fan:** reduced to 60-70% (or 80% for PLA)
  - **Print Temp:** +5°C higher than non-structural
  - **First Layer Height:** 0.25mm
  - **First Layer Speed:** 15mm/s

---

### Scenario 2.2: Shrinkage Compensation Displays for Structural
**Objective:** Verify DimensionalAccuracy component appears only for structural prints

**Steps:**
1. Complete Scenario 2.1 (structural print analysis complete)
2. Scroll results page to find "📏 Dimensional Accuracy & Shrinkage Compensation" section

**Expected Results:**
- Section appears **below Bed & Adhesion settings** (if results show one)
- Section shows:
  - **Scale Compensation** subsection:
    - XY Shrinkage percentage (e.g., "2.1%")
    - Scale factor to use in slicer (e.g., "102.1%")
    - Z Shrinkage percentage
  - **Significance indicator:**
    - Green if minimal: "✓ Minimal shrinkage"
    - Amber if moderate: "~ Moderate shrinkage"
    - Red if significant: "⚠️ Significant shrinkage"
  - **Common Hole Sizes** table with nominal and compensated sizes
  - **Layer Orientation** guidance based on model shape
  - **Material-Specific Guidance** (e.g., for PETG: "Moderate shrinkage — account for this...")

**Notes:**
- Try changing filament type and re-running to see different shrinkage values
- Example: PLA has minimal shrinkage; Nylon has significant shrinkage

---

### Scenario 2.3: Shrinkage Compensation Hides for Decorative
**Objective:** Verify shrinkage section only appears for structural

**Steps:**
1. Upload a model
2. Open settings editor
3. Select "🎨 Decorative"
4. Click [Re-run Analysis]
5. Scroll results page

**Expected Results:**
- "📏 Dimensional Accuracy & Shrinkage Compensation" section is **NOT visible**
- Section reappears if you:
   - Open settings editor
   - Switch to "Structural"
   - Re-run analysis

---

### Scenario 2.4: Different Filament, Different Shrinkage
**Objective:** Verify shrinkage values change with filament type

**Steps:**
1. Complete a structural analysis with PLA
2. Note the shrinkage percentages (e.g., "0.3% XY")
3. Open settings editor
4. In "Filament" section, change "Material Type" to "Nylon"
5. Click [Re-run Analysis]
6. Find the shrinkage section again

**Expected Results:**
- XY shrinkage increases significantly (Nylon ≈ 2-3% vs PLA ≈ 0.3%)
- Z shrinkage also increases
- Hole compensation table values change
- Material-specific guidance mentions Nylon is "Highest shrinkage of all FDM materials"
- Warning appears: "⚠️ Significant shrinkage: Compensation is essential"

---

## FEATURE 3: Equipment Selection (No More GUIDs!)

### Scenario 3.1: Printer Dropdown Shows Names, Not IDs
**Objective:** Core fix validation — printers display properly

**Steps:**
1. Open settings editor
2. Expand "Printer & Nozzle"
3. Click "Printer Model" dropdown
4. Scroll through the list

**Expected Results:**
- All entries show human-readable names:
  - "Ender 3 V3" (not a UUID)
  - "A1 Mini" (not a UUID)
  - "Prusa MK4S" (not a UUID)
- **NO UUIDs like "a1b2c3d4-..." visible**
- Printers are grouped by vendor (Creality, Bambu Lab, Prusa, etc.)

---

### Scenario 3.2: Bed Surface Dropdown Shows Names, Not IDs
**Objective:** Core fix validation — surfaces display properly

**Steps:**
1. Open settings editor
2. Scroll to "Bed Surface" in Print Settings
3. Click the dropdown
4. Scroll through surfaces

**Expected Results:**
- All entries show human-readable names:
  - "PEI Textured" (not a UUID)
  - "Bambu Cool Plate" (not a UUID)
  - "Borosilicate Glass" (not a UUID)
- **NO UUIDs visible**
- Surfaces grouped by category (PEI, Bambu Lab plates, Glass, Specialty)

---

### Scenario 3.3: Search Filtering Works
**Objective:** Verify search filters both dropdowns correctly

**Steps:**
1. Open settings editor
2. Click bed surface dropdown
3. Type "cool" in search box

**Expected Results:**
- List filters to show only surfaces with "cool" in the name
- "Bambu Cool Plate" remains visible
- "Borosilicate Glass" and others are hidden
- "Other / Unknown" option always visible
- Search text is highlighted in yellow/bold

**Repeat for printers:**
1. Click printer dropdown
2. Type "bambu"

**Expected Results:**
- Shows only Bambu Lab printers
- Vendor grouping still works
- All Bambu models visible

---

### Scenario 3.4: Select Surface and Verify Display
**Objective:** Verify selected value displays correctly (not GUID)

**Steps:**
1. Open settings editor
2. Click bed surface dropdown
3. Select "Bambu Engineering Plate"
4. Close dropdown (click elsewhere)

**Expected Results:**
- Input field shows: "Bambu Engineering Plate"
- Below dropdown shows: "Current: Bambu Engineering Plate"
- **NOT a UUID**

---

### Scenario 3.5: Keyboard Navigation in Dropdown
**Objective:** Verify arrow keys and Enter work

**Steps:**
1. Open settings editor
2. Click printer dropdown
3. Press **Down arrow** key 3 times

**Expected Results:**
- Highlight moves down the list
- First item gets highlighted (visual background change)

4. Press **Enter**

**Expected Results:**
- Selected printer is chosen and dropdown closes

**Additional test:**
1. Open dropdown again
2. Press **Escape**

**Expected Results:**
- Dropdown closes without selecting

---

## FEATURE 4: History & Session Comparison

### Scenario 4.1: Analysis Saved to History
**Objective:** Verify each analysis creates a history entry

**Steps:**
1. Upload a model and complete analysis
2. Go to **History** page (from main menu or results page)
3. Look for your session

**Expected Results:**
- Session appears with:
  - Session name (e.g., "model.stl")
  - Date/time saved
  - Thumbnail of geometry (if 3D viewer worked)
- Session is clickable to view previous results

---

### Scenario 4.2: Variant Sessions Named Correctly
**Objective:** Verify re-run analysis creates properly named variants

**Steps:**
1. Upload a model and complete initial analysis
2. Open settings editor
3. Change **Quality Tier** to "Ultra"
4. Re-run analysis
5. Go to History page

**Expected Results:**
- Two sessions exist:
  - Original: "model.stl"
  - Variant: "model.stl — Quality tier variant"
- Both are clickable and show their respective results

**Repeat with different changes:**
1. Open settings editor on results
2. Change **Bed Surface** to something different
3. Re-run
4. Check history

**Expected Results:**
- New session: "model.stl — Bed surface variant"

---

### Scenario 4.3: Compare Two Sessions
**Objective:** Verify session comparison page displays correct data without GUIDs

**Steps:**
1. History page shows at least 2 sessions
2. Select two sessions using checkboxes
3. Click **Compare** button

**Expected Results:**
- Comparison page loads
- Two sessions shown at top with labels (A) and (B)
- "Key differences at a glance" section lists all differences
4. Scroll down to the comparison table

**Critical validation:**
- **Printer** row shows human-readable names (e.g., "Creality Ender 3 V3"), **NOT UUIDs**
- **Bed surface** row shows proper names (e.g., "PEI Textured"), **NOT UUIDs**
- All other fields show expected values

---

### Scenario 4.4: Comparison Highlights Differences
**Objective:** Verify different values are highlighted

**Steps:**
1. On comparison page, scroll through the table
2. Look for rows where Session A and B differ

**Expected Results:**
- Different values have **amber background** highlighting
- Identical rows have normal background
- A "≠" symbol appears in highlighted cells
- Column headers (A) and (B) are clearly labeled

---

## FEATURE 5: Equipment Suggestion Flow (Bonus)

### Scenario 5.1: Select "Other" and Submit Suggestion
**Objective:** Verify equipment suggestion flow works

**Prerequisites:**
- Know what a custom printer you use (not in the list) would be called

**Steps:**
1. Open settings editor
2. Expand "Printer & Nozzle"
3. Click printer dropdown
4. Search for a printer not in the list (e.g., "Creality K1")
5. Type the full name: "Creality K1"
6. Press **Enter** or click

**Expected Results:**
- If exact match not found, "Other / Custom Printer" option remains selectable
- (This is a limitation of current flow — improved suggestion UI pending)

---

## FEATURE 6: Filament Database Integration

### Scenario 6.1: Look Up Filament in Open Filament Database
**Objective:** Verify brand lookup works

**Steps:**
1. Open settings editor
2. In Filament section:
   - Set "Material Type" to "PLA"
   - Type "Bambu Lab" in "Brand/Manufacturer" field
   - Wait ~400ms (debounced lookup)

**Expected Results:**
- Green box appears: "✓ Found in Open Filament Database: 200–220°C"
- Shows temperature range from database
- Helps user select appropriate print temp

---

## FEATURE 7: End-to-End Workflow

### Scenario 7.1: Complete Workflow from Upload to Comparison
**Objective:** Full integration test

**Steps:**
1. **Upload** a structural part (bracket, mount, etc.)
2. Wait for analysis with **Functional** selected
3. **Note** the print settings (infill, walls, temp, etc.)
4. **Open Settings Editor**
5. **Change** Print Purpose to **Structural**
6. **Verify** shrinkage compensation section appears
7. **Re-run** analysis
8. **Verify** settings updated with structural overrides (35%+ infill, 4+ walls, etc.)
9. **Go to History**
10. **Select** both original and structural variant
11. **Compare**
12. **Verify** differences are highlighted correctly
13. **Verify** No GUIDs in printer/surface fields

**Expected Results:**
- All steps complete without errors
- No console errors (check browser dev tools)
- Proper names displayed throughout
- Structural overrides applied
- Shrinkage compensation relevant to filament type

---

## TESTING CHECKLIST

### UI/UX
- [ ] Settings panel slides in from right smoothly
- [ ] Panel is responsive (mobile viewport works)
- [ ] All buttons are clickable and show hover state
- [ ] Keyboard shortcuts work (Escape, Enter, arrows)
- [ ] Dark mode styling looks correct

### Functionality
- [ ] Changes are tracked correctly
- [ ] Reset clears all changes
- [ ] Re-run analysis creates variant session
- [ ] History entries save properly
- [ ] Comparison shows correct data

### Data Integrity
- [ ] No GUIDs visible in dropdowns
- [ ] Equipment names resolve correctly
- [ ] Variant naming is consistent
- [ ] Structural overrides apply correctly
- [ ] Shrinkage values change with filament

### Performance
- [ ] Settings editor loads quickly (<500ms)
- [ ] Re-run analysis completes in <10 seconds
- [ ] No lag when typing in search boxes
- [ ] Dropdown filtering is responsive

### Error Handling
- [ ] Rate limit warning displays correctly
- [ ] Invalid selections don't break the form
- [ ] Network errors are handled gracefully
- [ ] KV fallback (defaults) works if offline

---

## Known Limitations / Future Work

1. **Equipment Suggestion UI**: Currently no dedicated UI to suggest new printer models. Workaround: suggest via email or GitHub issue.
2. **Nozzle Selection**: Currently a simple dropdown; could be enhanced to SearchableSelect (lower priority).
3. **Batch Re-runs**: Can't run multiple settings variations at once.
4. **Comparison Diff Export**: No CSV/PDF export of comparisons.
5. **Automated Testing**: No CI/CD tests yet (next phase).

---

## Notes for QA Team

- **Browser Compatibility**: Test in Chrome, Firefox, Safari, Edge
- **Mobile Testing**: Test on iOS Safari and Android Chrome
- **Offline**: Test with network throttled or offline to verify fallbacks
- **Rate Limiting**: Use incognito/private mode to reset daily limits for testing
- **KV Data**: If KV is unavailable, defaults should load without errors

---

