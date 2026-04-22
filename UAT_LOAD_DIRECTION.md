# UAT: Load Direction & Orientation Recommendation (Phase 3)

## Overview
Test the complete Load Direction input and Orientation Recommendation feature, including form visibility rules, Claude integration, results display, and session history.

**Feature Scope:**
- Load direction selector (7 options) with visibility rules
- Optional load description field (75 chars max)
- Claude prompt integration with FDM anisotropy context
- Orientation recommendation panel with 7 fields
- Session history storage and comparison
- Settings editor integration

**Test Environment:**
- Chrome/Firefox (latest)
- Dark mode and light mode
- Desktop and mobile (375px)
- localhost:3000

---

## Section 1: Form Input (LoadDirectionInput Component)

### Scenario 1.1: Load Direction Hidden for Decorative Prints
**Steps:**
1. Upload a model and go to the form
2. Select "🎨 Decorative" for print purpose
3. Scroll down to observe

**Expected Outcome:**
- Load Direction section is completely hidden (no DOM element)
- Form layout unchanged, no empty space

**Notes:**
- Verify in both light and dark mode
- Check mobile view (no layout shift)

---

### Scenario 1.2: Load Direction Collapsed Link for Functional Prints
**Steps:**
1. Upload a model
2. Select "🔧 Functional" for print purpose
3. Scroll to Load Direction section
4. Click the link/button to expand

**Expected Outcome:**
- Shows as a blue link: "⚡ Load Direction (Optional)" with chevron icon
- No load direction selected initially: chevron points right
- Click to expand shows 7 load direction buttons
- All 7 buttons visible: Vertical Tension, Vertical Compression, Cantilever, Torsional, Multi-directional, Impact, Fatigue
- Load description textarea hidden until direction selected

**Notes:**
- Verify chevron rotates 180° when expanding
- Check that expanding doesn't scroll page unexpectedly
- Verify collapse state is independent per page session

---

### Scenario 1.3: Load Direction Expanded for Structural Prints
**Steps:**
1. Upload a model
2. Select "🏗️ Structural" for print purpose
3. Scroll down

**Expected Outcome:**
- Load Direction section appears expanded by default
- All 7 buttons visible immediately
- Section title shows "⚡ Load Direction" (not a link)
- Description below: "How will this part be loaded? This affects optimal orientation."

**Notes:**
- Verify expanded state persists when switching back from other sections
- Check mobile layout (buttons stack in 2 columns as designed)

---

### Scenario 1.4: Select Load Direction and Show Description Field
**Steps:**
1. Start with Functional or Structural print
2. Expand Load Direction (if Functional)
3. Click "→ Cantilever" button
4. Observe textarea appearance

**Expected Outcome:**
- Selected button shows blue border and blue background
- Textarea appears with label "Load Context (0 / 75 chars)"
- Placeholder text: "e.g., 'Suspends 5kg weight', 'Repeated bending 1000x/day', etc."
- Help text: "Optional — helps Claude assess if your current orientation is optimal"

**Notes:**
- Verify previous selection is deselected if clicking a different button
- Check that textarea doesn't appear until a direction is selected
- Test dark mode styling (textarea should have correct dark background)

---

### Scenario 1.5: Load Description Character Limit
**Steps:**
1. Select a load direction (any)
2. Type a long description into the textarea
3. Type past 75 characters

**Expected Outcome:**
- Text stops accepting input at 75 characters
- Character counter updates in real-time: "75 / 75 chars"
- No truncation warning, just hard stop
- User can still delete characters

**Notes:**
- Try pasting a long string (should truncate to 75)
- Verify counter is accurate (use a tool to count)

---

### Scenario 1.6: Clear Load Direction (Functional Only)
**Steps:**
1. Start with Functional print purpose
2. Expand Load Direction
3. Select a direction and add description
4. Click "Clear load direction" link

**Expected Outcome:**
- Load direction deselected (no button highlighted)
- Textarea removed
- Section collapses back to the link
- Both fields reset

**Notes:**
- Verify link only appears when selection is active
- Check that collapse is smooth (CSS transition)
- Structural prints should NOT show clear button (always expanded)

---

### Scenario 1.7: Settings Editor Integration
**Steps:**
1. Complete an analysis (any print purpose)
2. Click "⚙️ Adjust Settings"
3. Scroll down in the settings panel
4. Locate "Print Settings" section
5. Verify Load Direction component

**Expected Outcome:**
- LoadDirectionInput appears in SettingsEditorPanel after Print Purpose
- Visibility rules apply (hidden for Decorative, collapsed for Functional, expanded for Structural)
- Changes are tracked: "Load direction" and "Load context" appear in Changes summary if modified
- Expanding/collapsing Load Direction is smooth

**Notes:**
- Try changing print purpose from Functional to Structural — should auto-expand Load Direction
- Try changing from Structural to Decorative — should hide Load Direction
- Edit description and verify character counter updates

---

## Section 2: API & Claude Prompt Integration

### Scenario 2.1: Load Direction Context in Claude Prompt
**Steps:**
1. Upload a model
2. Select Functional or Structural print purpose
3. Select load direction: "↓ Vertical Tension"
4. Leave load description empty
5. Submit form

**Expected Outcome:**
- API receives loadDirection and (empty) loadDescription
- Claude receives load direction context in prompt
- Response includes orientationRecommendation object (not null)

**Verification (Debug Mode):**
- Open browser DevTools → LocalStorage → pp_debug_last_run
- Search for "Load direction: vertical tension" in the saved prompt
- Verify FDM anisotropy explanation is present

**Notes:**
- This happens silently (user sees loading spinner)
- No validation errors should occur
- Confirm with multiple load directions

---

### Scenario 2.2: Load Direction with Context Description
**Steps:**
1. Upload a model
2. Select Structural purpose
3. Select "⬇️ Vertical Compression"
4. Type: "Experiences 50kg vertical crushing force"
5. Submit form

**Expected Outcome:**
- API receives both loadDirection and loadDescription
- Claude prompt includes both in Load Analysis section
- Example in prompt: "User context: \"Experiences 50kg vertical crushing force\""
- Response includes orientationRecommendation

**Verification:**
- Check pp_debug_last_run prompt for both fields
- Verify Claude's recommendation mentions the specific load context

---

### Scenario 2.3: No Load Direction = No Orientation Recommendation
**Steps:**
1. Upload a model
2. Select Decorative or submit form without selecting load direction
3. Submit

**Expected Outcome:**
- API receives loadDirection: undefined
- Claude prompt does NOT include Load Analysis section
- Response has orientationRecommendation: null
- Results page does NOT show OrientationRecommendationPanel

**Notes:**
- Verify in results that only standard panels appear
- Check API response in Network tab: orientationRecommendation should be null

---

### Scenario 2.4: Multiple Load Directions Generate Correct Recommendations
**Steps:**
1. Run 3 analyses with different load directions:
   - Vertical Tension
   - Cantilever
   - Impact
2. Compare recommendations in results

**Expected Outcome:**
- Each recommendation's "principle" section explains the relevant FDM principle
- "recommendation" field is specific to the load type (e.g., cantilever mentions horizontal orientation)
- "strengthImprovement" differs based on load type
- All 7 fields are populated with relevant content

**Notes:**
- Compare principle explanations — should be different for each load
- Verify Claude understood the load direction (read the principle text)

---

## Section 3: Orientation Recommendation Panel (Results Display)

### Scenario 3.1: Panel Header and Collapse/Expand
**Steps:**
1. Complete an analysis with load direction
2. Scroll to results
3. Locate OrientationRecommendationPanel (after Dimensional Accuracy)
4. Click the header

**Expected Outcome:**
- Header shows: "⚡ Print Orientation Recommendation"
- Subtitle: "Based on load direction and FDM anisotropy"
- Chevron icon points down (expanded) initially
- Click header to collapse
- Chevron rotates 180° on click
- Content smoothly collapses (CSS transition)
- Click again to re-expand

**Notes:**
- Verify collapse state persists on page (localStorage via sessionId)
- Check mobile view header layout (doesn't overflow)
- Dark mode: verify text and chevron color contrast

---

### Scenario 3.2: Assessment Status Box (Color Coding)
**Steps:**
1. Complete analysis with load direction
2. View results, locate "Current Orientation Assessment" box
3. Note the color

**Expected Outcome:**
- Box background and text colors change based on assessment:
  - **Excellent/Good**: Green background (emerald-50/emerald-900/20), green text
  - **Suboptimal**: Amber background (amber-50/amber-900/20), amber text
  - **Poor**: Red background (rose-50/rose-900/20), red text
- Bold assessment label: "Excellent", "Good", "Suboptimal", or "Poor"
- Explanation paragraph below

**Test Multiple Assessments:**
1. Change print purpose or load direction and re-run to get different assessments
2. Verify each color is correct

**Notes:**
- Compare colors with Dimensional Accuracy panel (should use same color scheme)
- Verify text is readable in both light and dark mode
- Check mobile view (box should be full width)

---

### Scenario 3.3: All 7 Recommendation Fields Visible
**Steps:**
1. View expanded OrientationRecommendationPanel
2. Scroll through all content

**Expected Outcome:**
- **FDM Anisotropy Principle**: 2-3 sentence explanation (readable text, not code)
- **Recommended Orientation**: Bold text with purple border box, specific instruction (e.g., "Orient vertically with hole axis along Z-axis")
- **Expected Strength Improvement**: Text like "up to 40% stronger" or "2-3x improvement"
- **Slicer Instructions**: Monospace font, step-by-step (e.g., "In Cura: Select model → Rotate 90° around Y-axis")
- **Material & Filament Considerations**: Specific to the material (e.g., "Carbon-filled materials show extreme anisotropy")
- **⚠️ If You Ignore**: Red warning box with consequence text
- **Disclaimer footer**: Small text about validation with test prints

**Notes:**
- Verify all 7 sections are present and non-empty
- Check text wrapping on mobile (no horizontal overflow)
- Verify monospace font for slicer instructions is correct

---

### Scenario 3.4: Collapse and Expand State Persists (localStorage)
**Steps:**
1. View results with OrientationRecommendationPanel expanded
2. Click header to collapse
3. Scroll away and back to the panel
4. Refresh the page (F5)

**Expected Outcome:**
- After collapse and scroll: panel remains collapsed
- After refresh: **if sessionId is present**, panel remains in collapsed state
- If sessionId is absent (main results screen), collapse state may reset

**Notes:**
- Test on main results screen (sessionId should be set)
- Test on history view (sessionId should be set)
- Verify other panels' collapse states don't interfere

---

### Scenario 3.5: No Orientation Panel When No Load Direction
**Steps:**
1. Complete analysis WITHOUT selecting load direction
2. View results

**Expected Outcome:**
- OrientationRecommendationPanel is not rendered at all
- No empty space or placeholder
- Dimensional Accuracy panel (if Structural) flows directly to Filament Properties panel

**Notes:**
- Check DOM (DevTools) — no OrientationRecommendationPanel element
- Verify layout alignment with and without the panel

---

## Section 4: Session History & Comparison

### Scenario 4.1: Save Session with Orientation Recommendation
**Steps:**
1. Complete analysis with load direction selected
2. Session auto-saves ("Session saved to your print history" toast)
3. Navigate to /history
4. Click on the saved session

**Expected Outcome:**
- Session appears in history list
- Click to open: results screen loads with OrientationRecommendationPanel visible
- All orientation data is intact (principle, recommendation, assessment, etc.)
- Collapse state is remembered (if previously collapsed, should open collapsed)

**Notes:**
- Verify sessionId is present in the loaded session
- Check localStorage for orientationRecommendation data
- Test on different browser (should load from localStorage)

---

### Scenario 4.2: Compare Two Sessions with Different Load Directions
**Steps:**
1. Create Session A: Load Direction = Vertical Tension
2. Create Session B: Load Direction = Cantilever
3. Go to /history
4. Select both and click "Compare"

**Expected Outcome:**
- Comparison table shows "Load direction" row
- Session A shows: "vertical tension"
- Session B shows: "cantilever"
- Row is highlighted in amber (different values)
- Differences summary at bottom includes "Load direction: vertical tension (A) vs cantilever (B)"

**Notes:**
- Verify underscores are removed from display (vertical_tension → vertical tension)
- Check that row only highlights if values differ
- Verify differences summary is accurate

---

### Scenario 4.3: Compare Sessions with Same Load Direction, Different Orientation Assessment
**Steps:**
1. Create Session A: Load Direction = Impact, Assessment = Excellent
2. Create Session B: Load Direction = Impact, Assessment = Poor (by changing settings)
3. Compare

**Expected Outcome:**
- Comparison table shows "Orientation Recommendation" section (only if at least one has data)
- "Assessment" row shows:
  - Session A: "excellent"
  - Session B: "poor"
- Row highlighted in amber (different assessments)
- Assessment row is present in comparison

**Notes:**
- If both sessions lack orientation recommendation, section should not appear
- Verify assessment values are formatted consistently

---

### Scenario 4.4: Backward Compatibility (Old Sessions Without Orientation Data)
**Steps:**
1. Manually edit localStorage to remove orientationRecommendation from an old session
2. Go to /history
3. Click the old session
4. View results
5. Try to compare old session with new session

**Expected Outcome:**
- Old session loads without errors
- OrientationRecommendationPanel does NOT appear
- Comparison view handles missing orientation data gracefully
- Differences summary works correctly (missing field shown as "—")
- No console errors

**Notes:**
- This simulates sessions saved before Phase 3
- Verify no TypeScript or runtime errors
- Check both light and dark mode rendering

---

## Section 5: Settings Editor (Re-run with Changes)

### Scenario 5.1: Change Load Direction and Re-run Analysis
**Steps:**
1. Complete initial analysis with Load Direction = Vertical Tension
2. Click "⚙️ Adjust Settings"
3. Change Load Direction to Cantilever
4. Add load description: "Horizontal bracket extending 200mm"
5. Click "Re-run Analysis"

**Expected Outcome:**
- Changes summary shows: "Load direction" and "Load context"
- "Re-run Analysis" button is enabled
- New analysis includes updated load direction in Claude prompt
- New orientation recommendation reflects Cantilever load (not Vertical Tension)
- Recommendation mentions the 200mm extension context

**Notes:**
- Verify old session is preserved (variant created)
- Check that new session name includes "Cantilever variant" or similar
- Verify new orientation assessment is different from original

---

### Scenario 5.2: Remove Load Direction and Re-run
**Steps:**
1. Complete analysis with load direction
2. Open settings
3. Click "Clear load direction"
4. Re-run

**Expected Outcome:**
- Changes summary shows: "Load direction" and "Load context" removed
- New analysis runs without load direction context
- Claude prompt does NOT include Load Analysis section
- New session has orientationRecommendation: null
- New results do NOT show OrientationRecommendationPanel

**Notes:**
- Verify variant naming reflects the change
- Check that old session still has its orientation data (not affected)

---

### Scenario 5.3: Change Print Purpose and Observe Load Direction Visibility
**Steps:**
1. Start with Functional, select load direction
2. Open settings
3. Change Print Purpose to Structural
4. Verify Load Direction section
5. Change Print Purpose to Decorative
6. Verify Load Direction section

**Expected Outcome:**
- Functional → Structural: Load Direction stays visible and expands
- Structural → Decorative: Load Direction hides (but value is preserved in inputs)
- If re-running from Decorative, load direction is included in request but panel doesn't show UI

**Notes:**
- Load direction value should persist internally even if UI hides it
- Verify no data loss when toggling visibility

---

## Section 6: Mobile Responsiveness

### Scenario 6.1: Mobile Load Direction Layout
**Steps:**
1. Resize browser to 375px width (mobile)
2. Select Functional or Structural purpose
3. Expand Load Direction
4. Interact with buttons and textarea

**Expected Outcome:**
- 7 load direction buttons display in 2-column grid on mobile
- Buttons are tappable (at least 44px height)
- Textarea expands full width
- Chevron icon is visible and rotates
- No horizontal scrolling
- Text doesn't overflow

**Notes:**
- Test both portrait and landscape
- Use DevTools device emulation (iPhone SE, Pixel 5)
- Verify touch interactions work smoothly

---

### Scenario 6.2: Mobile Orientation Panel Layout
**Steps:**
1. Complete analysis on mobile (375px)
2. View results, scroll to OrientationRecommendationPanel

**Expected Outcome:**
- Header is readable (title and subtitle don't wrap awkwardly)
- Assessment box is full width
- All 7 sections visible without horizontal scroll
- Monospace slicer instructions text wraps appropriately
- Collapse/expand touch target is at least 44px

**Notes:**
- Test on iPhone SE (375px) and Pixel 5 (412px)
- Verify colors and contrast on small screen
- Check that footer text is readable

---

## Section 7: Edge Cases & Error Handling

### Scenario 7.1: Load Direction with Very Long Description
**Steps:**
1. Select load direction
2. Copy-paste a very long text (200+ chars)

**Expected Outcome:**
- Input truncates to 75 characters (no error)
- Character counter shows "75 / 75"
- User can delete and type again
- No browser console errors

---

### Scenario 7.2: Rapid Fire Selection Changes
**Steps:**
1. Select load direction
2. Quickly click different directions several times
3. Add description
4. Submit

**Expected Outcome:**
- Form handles rapid clicks gracefully
- Only the final selected direction is submitted
- No race conditions or unexpected state
- No console errors

---

### Scenario 7.3: Offline / Network Error During Analysis
**Steps:**
1. Select load direction
2. Before submitting, turn off WiFi/disconnect network
3. Click "Analyze"
4. Wait for error

**Expected Outcome:**
- Error message appears (Claude API unreachable)
- Form stays populated with load direction
- Can retry without re-entering data

**Notes:**
- Simulate with DevTools Network throttling
- Verify error message doesn't reference load direction (generic "Couldn't reach Claude" message)

---

### Scenario 7.4: Missing Orientation Data in Session (Null Handling)
**Steps:**
1. View a session with null orientationRecommendation
2. Try to compare it with a session that has orientation data
3. Try to view the session in history

**Expected Outcome:**
- No crashes or console errors
- Comparison table handles null gracefully (shows "—" or omits section)
- History view renders without the panel
- All other session data displays normally

---

## Section 8: Dark Mode & Accessibility

### Scenario 8.1: Dark Mode Styling
**Steps:**
1. Toggle dark mode in settings or browser
2. Go through Scenarios 1.1 - 3.5 (selecting various items)
3. Pay attention to colors and contrast

**Expected Outcome:**
- All text has adequate contrast (WCAG AA)
- Colors match design (blue links, green/amber/red assessments, purple recommendation box)
- Borders and backgrounds visible in dark mode
- No unreadable text overlaps
- Textarea and input fields have visible dark mode styling

**Notes:**
- Use DevTools Accessibility → Contrast checker
- Test with dark mode toggle multiple times

---

### Scenario 8.2: Keyboard Navigation
**Steps:**
1. Use only Tab key to navigate form
2. Tab to load direction buttons
3. Use arrow keys to select directions
4. Tab to textarea and enter description
5. Submit with Enter

**Expected Outcome:**
- All interactive elements are focusable
- Load direction buttons show focus ring
- Textarea receives focus
- Description entered successfully
- Can submit form with Tab + Enter

**Notes:**
- Use DevTools → Accessibility Inspector to verify ARIA roles
- Check that buttons have aria-pressed or similar

---

## Test Summary Checklist

- [ ] Scenario 1.1: Decorative — no Load Direction visible
- [ ] Scenario 1.2: Functional — collapsed link with expand
- [ ] Scenario 1.3: Structural — expanded by default
- [ ] Scenario 1.4: Selection shows textarea
- [ ] Scenario 1.5: Character limit enforced at 75
- [ ] Scenario 1.6: Clear button resets selection
- [ ] Scenario 1.7: Settings editor integration works
- [ ] Scenario 2.1: Claude receives load direction context
- [ ] Scenario 2.2: Load description included in prompt
- [ ] Scenario 2.3: No load direction = null recommendation
- [ ] Scenario 2.4: Multiple directions generate appropriate recommendations
- [ ] Scenario 3.1: Panel header and collapse/expand work
- [ ] Scenario 3.2: Assessment colors match assessment level
- [ ] Scenario 3.3: All 7 fields visible and populated
- [ ] Scenario 3.4: Collapse state persists via localStorage
- [ ] Scenario 3.5: No panel when no load direction
- [ ] Scenario 4.1: Session saves and loads orientation data
- [ ] Scenario 4.2: Comparison shows load direction differences
- [ ] Scenario 4.3: Comparison shows orientation assessment differences
- [ ] Scenario 4.4: Old sessions without orientation data load gracefully
- [ ] Scenario 5.1: Change load direction and re-run works
- [ ] Scenario 5.2: Remove load direction and re-run works
- [ ] Scenario 5.3: Print purpose visibility rules work
- [ ] Scenario 6.1: Mobile layout is responsive (375px, 2-column grid)
- [ ] Scenario 6.2: Mobile panel layout is readable
- [ ] Scenario 7.1: Very long description truncates
- [ ] Scenario 7.2: Rapid selection changes handled
- [ ] Scenario 7.3: Network error doesn't lose form data
- [ ] Scenario 7.4: Null orientation data doesn't crash
- [ ] Scenario 8.1: Dark mode styling is correct
- [ ] Scenario 8.2: Keyboard navigation works

---

## Notes for Testers

1. **Filament & Equipment**: Load direction is independent of filament and equipment choices. Test with various combinations to ensure no conflicts.

2. **Print Purpose Interaction**: The feature's visibility depends entirely on printPurpose. Test all three values thoroughly.

3. **Claude Prompt Changes**: The prompt changes are subtle but important. Use the debug localStorage to verify the prompt includes load direction context.

4. **sessionId Handling**: Orientation data is keyed by sessionId in localStorage. Verify that collapse state and other session-specific data are properly isolated.

5. **Browser Cache**: Some tests may require clearing browser cache or using incognito mode to test fresh session creation.

6. **Console Warnings**: No TypeScript or JavaScript warnings should appear in the console during any scenario.

---

## Sign-Off

**Tester:** _________________  
**Date:** _________________  
**Result:** ☐ Pass  ☐ Fail  
**Notes:** _______________________________________________________________
