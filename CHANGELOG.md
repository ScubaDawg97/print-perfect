# Changelog

All notable changes to Print Perfect are documented in this file.

## [2.1.0] - April 21, 2026

### ✨ New Features

#### Filament Management System (Phase 2)
- **Admin Filament Management**: Admins can now add, edit, and soft-delete filament types
  - Full CRUD interface in `/admin/settings` → Filament Types section
  - Alphabetical sorting for easy discovery
  - Active/deactivated filament tracking
  
- **Filament Suggestion Review**: Admins can approve or reject user-submitted filaments
  - Suggestions panel in `/admin/settings` → Filament Suggestions
  - One-click approval creates new filament
  - Grouped by status (Pending, Approved, Rejected)
  - Vote tracking for popular suggestions

- **User Filament Suggestions**: Users can suggest new filament types
  - "Other / Custom Filament" option in filament dropdown
  - Inline form for filament details (name, description, characteristics)
  - Confirmation modal with rate limiting (1 per IP per 24 hours)
  - Instant feedback on submission status

### 🐛 Bug Fixes

- Fixed data loss bug when adding filaments to admin panel
- Fixed UUID validation that was rejecting deterministic IDs in default filaments
- Fixed initialization logic to properly detect and recover corrupted data
- Fixed browser caching delay for new filaments (reduced from 5 min to 30 sec)
- Improved error handling with 5-second timeouts for admin operations

### 🚀 Performance Improvements

- Reduced HTTP cache time for `/api/filament` from 5 minutes to 30 seconds
- Added timeout protection (5s) for admin settings panel data loading
- Filaments automatically sorted alphabetically for faster discovery
- In-memory caching with proper invalidation on updates

### 📚 Documentation

- Updated ADMIN_GUIDE.md with new Filament Management section
- Updated USER_GUIDE.md with filament suggestion instructions
- Added CHANGELOG.md for release tracking

### 🔧 Technical Details

**New API Endpoints:**
- `POST/PUT/DELETE /api/admin/filament-manage` - Filament CRUD
- `GET /api/admin/filament-manage?type=filaments|suggestions` - List filaments/suggestions
- `POST /api/suggest-filament` - User filament submission
- `POST /api/admin/filament-restore` - Emergency restore defaults

**New Components:**
- `FilamentListManager` - Admin CRUD interface (add, edit, delete filaments)
- `FilamentSuggestionsPanel` - Admin review interface (approve, reject suggestions)
- `FilamentSuggestionForm` - User inline form for suggesting filaments
- `FilamentSuggestionModal` - Confirmation dialog with rate-limit messaging

**Schema Updates:**
- `FilamentTypeSchema` - Relaxed ID validation from strict UUID to flexible string
- `FilamentSuggestionSchema` - New schema for user suggestions
- Added comprehensive validation for all filament operations

**Storage:**
- KV keys: `filament:types`, `filament:suggestions`
- Intelligent initialization checks for data completeness (>= 10 items)
- Automatic recovery of corrupted or incomplete data

---

## [2.0.0] - April 18, 2026

### ✨ New Features

- **Slide-in Settings Editor**: Adjust print settings without re-uploading files
- **Structural Print Category**: New print purpose option with special overrides (35% infill, 4 walls, etc.)
- **Shrinkage Compensation**: Dimensional accuracy guidance for structural prints with hole/bolt size tables
- **Equipment Searchable Selects**: Real-time dropdown search for printers, bed surfaces, and nozzles
- **Session Variants**: Name and save different setting combinations for easy comparison
- **History & Comparison**: View past analyses and compare two variants side-by-side

### 🐛 Bug Fixes

- Fixed form validation feedback positioning (now at button level with error summary)
- Fixed bed surface required field validation
- Fixed printer profile loading clearing error states
- Fixed printer and surface display names in all screens (no longer showing GUIDs)

### 📚 Documentation

- Updated USER_GUIDE.md with new sections on variant sessions and comparisons
- Updated ADMIN_GUIDE.md with equipment management workflows
- Created UAT_SCENARIOS.md with comprehensive test scenarios

---

## [1.0.0] - Initial Release

- Core 3D print settings analysis
- Equipment database (55+ printers)
- Filament type selection
- Basic settings recommendations
- Export and sharing features
