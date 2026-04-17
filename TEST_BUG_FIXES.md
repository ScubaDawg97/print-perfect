# Bug Fix Testing Checklist

Complete these tests to verify both bug fixes are working correctly.

---

## Setup

1. **Build the project locally**:
   ```bash
   npm run build
   ```

2. **Start dev server**:
   ```bash
   npm run dev
   ```

3. **Open browser**: `http://localhost:3000`

---

## BUG 1: Auto-Orientation Tests

### Test 1.1: Already Well-Oriented Model
1. Create or find a simple cube STL (50mm sides)
2. Open in Bambu/Cura with correct face down
3. **Upload to PrintPerfect**
4. **Expected**:
   - `wasAutoOriented: false` in debug output
   - `orientationReason: "already well-oriented"`
   - Dimensions should match original

**Result**: ✅ PASS / ❌ FAIL

### Test 1.2: Boat Box Test Case
1. Upload `Boat_Box.stl` (128×204×101.6mm) if available, or create similar
2. Model intentionally exported with side face down
3. **Upload to PrintPerfect**
4. **Expected**:
   - Should rotate to 128×204 base down (NOT 128×101.6)
   - `wasAutoOriented: true`
   - `orientationReason: "multi-candidate optimal"`
   - Base surface area visible and largest

**Result**: ✅ PASS / ❌ FAIL

### Test 1.3: Tall Narrow Model
1. Upload a tall vase or column (100×100×400mm)
2. **Upload to PrintPerfect**
3. **Expected**:
   - Should NOT flip to horizontal (400×100 base is unstable)
   - Should stay upright (100×100 base)
   - `orientationWarning: null` (stable aspect ratio)
   - 100×100×400 dimensions maintained

**Result**: ✅ PASS / ❌ FAIL

### Test 1.4: Container Detection
1. Upload a hollow box, cup, or vase (empty interior)
2. **Upload to PrintPerfect**
3. **Expected**:
   - `isDetectedContainer: true`
   - Should keep opening facing up (special handling)
   - `orientationWarning: null` (properly oriented for container)

**Result**: ✅ PASS / ❌ FAIL

### Test 1.5: Extreme Aspect Ratio
1. Upload a very long thin needleor strand (5×5×500mm)
2. **Upload to PrintPerfect**
3. **Expected**:
   - May show warning: `orientationWarning: "footprint aspect ratio 100:1 is extreme"`
   - Still orients (doesn't block)
   - `wasAutoOriented: true` likely

**Result**: ✅ PASS / ❌ FAIL

---

## BUG 2: 3MF Stack Overflow Tests

### Test 2.1: Simple 3MF
1. Find or create a simple 3MF file (single object, <100k triangles)
2. **Upload to PrintPerfect**
3. **Expected**:
   - Parses successfully
   - No errors
   - Geometry loads in viewer
   - Triangle count reasonable

**Result**: ✅ PASS / ❌ FAIL

### Test 2.2: Multi-Object 3MF (Bambu)
1. Export a multi-object print from **Bambu Studio** as .3MF
2. **Upload to PrintPerfect**
3. **Expected**:
   - Parses successfully
   - All components included (total triangle count reflects all objects)
   - No "Maximum call stack" error
   - Inspect shows: `objectCount > 1`

**Result**: ✅ PASS / ❌ FAIL

### Test 2.3: Complex Bambu Export
1. Export a **complex Bambu Studio model** (dense geometry, many components)
2. This is the test case that previously crashed
3. **Upload to PrintPerfect**
4. **Expected**:
   - Either parses successfully OR shows helpful error message
   - NO stack overflow crash (browser tab doesn't hang)
   - Error message includes: "re-export", "split", or "convert to STL"

**Result**: ✅ PASS / ❌ FAIL

### Test 2.4: Large File Rejection
1. Artificially create/find 3MF >100MB (or skip if not available)
2. **Upload to PrintPerfect**
3. **Expected**:
   - Rejected with error: "3MF file is X.X MB — too large to process. Max 100 MB."
   - Graceful rejection, no crash
   - No browser freeze

**Result**: ✅ PASS / ❌ FAIL

### Test 2.5: High Triangle Count Rejection
1. Create or find 3MF with >750,000 triangles
2. **Upload to PrintPerfect**
3. **Expected**:
   - Rejected with error including: "too many to analyze safely"
   - Mentions "750k triangles"
   - Suggests "convert to STL format first" for 3MF files
   - No crash

**Result**: ✅ PASS / ❌ FAIL

### Test 2.6: Component Path Limit
1. Create 3MF with >500 component references (unlikely, but test if possible)
2. **Upload to PrintPerfect**
3. **Expected**:
   - Browser console warns: `[3MF Parser] Warning: 3MF contains X component references`
   - Parses only first 500 (graceful limit)
   - Geometry loads with limited component count

**Result**: ✅ PASS / ❌ FAIL

---

## Debug Output Verification

Add this to your browser console to inspect geometry analysis:

```javascript
// In the console after upload:
// The ParseResult should include analysis with new fields

// Example output structure:
{
  analysis: {
    // ... existing fields ...
    wasAutoOriented: true,
    orientationReason: "multi-candidate optimal (score: 0.68)",
    orientationWarning: null,
    isDetectedContainer: false
  }
}
```

---

## Error Scenarios

### Expected Error Messages

1. **File too large (>100MB)**:
   > "3MF file is 120.5 MB — too large to process. Re-export at a lower resolution or split into multiple files (max 100 MB)."

2. **Stack overflow caught**:
   > "3MF file is too complex (stack overflow during decompression). Try: 1) re-exporting at lower resolution, 2) splitting the model, or 3) converting to STL in your slicer."

3. **Too many triangles (3MF specific)**:
   > "This 3MF file has 800,000 triangles — too many to analyze safely. Re-export at a lower resolution or reduce the mesh in your CAD tool first (aim for under 750k triangles). Alternatively, try converting to STL format first."

4. **Many component references**:
   > [Browser console] `[3MF Parser] Warning: 3MF contains 523 component references. This is unusual and may indicate a corrupted or extremely complex file. Processing first 500.`

---

## Summary

| Test | Category | Status | Notes |
|------|----------|--------|-------|
| 1.1 | Orientation | ? | Already well-oriented check |
| 1.2 | Orientation | ? | Boat box stays flat |
| 1.3 | Orientation | ? | Tall model stays upright |
| 1.4 | Orientation | ? | Container detection |
| 1.5 | Orientation | ? | Extreme aspect ratio handling |
| 2.1 | 3MF | ? | Simple file parsing |
| 2.2 | 3MF | ? | Multi-object Bambu export |
| 2.3 | 3MF | ? | Complex model (previously crashed) |
| 2.4 | 3MF | ? | Large file rejection |
| 2.5 | 3MF | ? | High triangle count rejection |
| 2.6 | 3MF | ? | Component path limit |

**Overall Status**: ⏳ PENDING (awaiting your testing)

---

## Reporting Issues

If any test fails:
1. Document the model dimensions and file type
2. Note the error message or unexpected behavior
3. Check browser console for stack traces
4. Provide the test file if possible (especially for 3MF)

This will help diagnose any edge cases that need additional fixes.
