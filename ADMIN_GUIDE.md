# Admin User Guide: Equipment Management

This guide walks through managing 3D printer models, bed surfaces, and nozzles in PrintPerfect.

---

## Accessing Admin Panel

1. Go to `yourdomain.com/admin/login`
2. Enter your admin credentials (from `.env.local` or Vercel environment)
3. Click "Settings" in the sidebar

---

## Managing Equipment Lists

The **Equipment Lists** section lets you add, view, and delete printers, surfaces, and nozzles.

### Add Equipment

**To add a new printer:**

1. Go to Admin Settings → **Equipment Lists** → **Printers** tab
2. Click **+ Add** button
3. Fill in:
   - **Name**: Full printer name (e.g., "Bambu Lab H2C")
   - **Vendor**: Manufacturer (e.g., "Bambu Lab") — optional, auto-detected if omitted
   - **Max Bed Temp (°C)**: Maximum bed temperature (e.g., 110)
   - **Max Nozzle Temp (°C)**: Maximum nozzle temperature (e.g., 300)
4. Click **Save**

**To add a new surface:**

1. Go to **Surfaces** tab
2. Click **+ Add**
3. Fill in:
   - **Name**: Surface type (e.g., "PEI Textured", "Glass", "CoolPlate")
   - **Description**: Optional notes (e.g., "Textured PEI sheet, great for bed adhesion")
4. Click **Save**

**To add a new nozzle:**

1. Go to **Nozzles** tab
2. Click **+ Add**
3. Fill in:
   - **Diameter**: Nozzle size (e.g., 0.4, 0.6, 0.8)
   - **Material**: Select from dropdown (Brass, Hardened Steel, etc.)
   - **Type**: Select from dropdown (Standard, CHT, Volcano, etc.)
4. Click **Save**

### View & Delete Equipment

- **View**: Equipment lists show all active items grouped/sorted for easy browsing
- **Delete**: Click trash icon next to any item to delete it (soft delete — item marked inactive)

### Refresh Equipment Cache

After making changes, click the **⟳ Refresh** button (top right of Equipment Lists) to reload data without clearing browser history.

---

## Equipment Suggestions

Users can suggest equipment they're using that isn't in the database. The **Equipment Suggestions** section shows pending user-submitted suggestions.

### Review Suggestions

1. Go to Admin Settings → **Equipment Suggestions**
2. See a list of pending suggestions with:
   - Equipment type (🖨️ Printer, 🛏️ Bed Surface, 🔧 Nozzle)
   - Proposed name (what the user wants to call it)
   - User's description and characteristics
   - Vote count (how many others upvoted it)

### Vote on Suggestions

- **👍 Upvote**: Increase vote count (shows community interest)
- **👎 Downvote**: Decrease vote count
- **🗑️ Reject**: Dismiss suggestion permanently

### Approve Suggestions

1. Review the user's description and details
2. Manually add the equipment to the Equipment Lists (see "Add Equipment" above)
3. Once added, users will see it in the printer/surface/nozzle dropdowns on the main form
4. Optionally: Reject the original suggestion to mark it processed

**Example Workflow:**
- User suggests: "My custom Ender 3 with E3D V6 hotend"
- You review: Sounds like a standard Creality setup
- You add: New printer "Creality Ender 3 (Custom)" in Printers tab
- You reject: The original suggestion (marks it as handled)

---

## Managing Filament Types

The **Filament Types** section lets you manage the filament materials available to users in the analysis form. Similar to equipment management, you can add, edit, and soft-delete filament types.

### Add Filament

1. Go to Admin Settings → **Filament Types**
2. Click **+ Add Filament** button
3. Fill in:
   - **Filament name** (required): e.g., "PETG HF", "ASA", "Nylon"
   - **Description** (required): Material properties and use cases
4. Click **Add Filament**

### Edit Filament

1. In Filament Types section, find the filament you want to edit
2. Click the **✏️ Edit** (pencil) icon
3. Modify the name and/or description
4. Click **Save**

### Delete Filament

1. Click the **🗑️ Delete** (trash) icon next to the filament
2. Confirm the deletion dialog
3. Filament moves to **Deactivated** section (soft delete — kept in database but hidden from users)

### Filament Sorting

Filaments are automatically sorted **alphabetically by name** for easy discovery:
- "ABS" and "ABS HF" appear together
- "PETG" and "PETG HF" appear together
- Custom filaments appear in their alphabetical position

---

## Filament Suggestions

Users can suggest new filament types when their material isn't in the dropdown. The **Filament Suggestions** section shows pending user-submitted suggestions.

### Review Suggestions

1. Go to Admin Settings → **Filament Suggestions**
2. See pending suggestions grouped by status:
   - **Pending Review**: New suggestions awaiting action
   - **Approved**: Accepted and converted to filament types
   - **Rejected**: Dismissed suggestions

Each suggestion shows:
- Filament name (user-proposed)
- Description from the user
- Optional characteristics (temperature ranges, speed notes, etc.)
- Submission date
- Vote count (how many users upvoted)

### Approve Suggestions

When you approve a suggestion, it **automatically creates a new filament type** and moves to the Approved section.

**To approve a filament:**
1. Review the suggestion details (name, description, characteristics)
2. Click **✅ Approve** button
3. New filament is created and immediately available to users
4. Suggestion moves to "Approved" section

**Example Workflow:**
- User suggests: "PETG HF" with description "High-flow PETG variant"
- You click **✅ Approve**
- New filament "PETG HF" appears in Filament Types (alphabetically sorted)
- Users see it in the filament dropdown within 30 seconds

### Reject Suggestions

If you don't want to add a suggestion as a filament type:

1. Click **❌ Reject** on the suggestion
2. Suggestion moves to "Rejected" section
3. User can still submit a new suggestion (rate limited to 1 per 24 hours)

---

## Common Tasks

### Adding a new printer model from a user suggestion

1. Read the suggestion details in Equipment Suggestions panel
2. Go to Printers tab → Click **+ Add**
3. Enter the details from the suggestion
4. Fill in reasonable defaults for temps (110°C bed, 250-300°C nozzle)
5. Click **Save**
6. Return to Equipment Suggestions and **Reject** the original suggestion

### Handling duplicate equipment entries

If you accidentally add the same printer twice:

1. Go to Printers tab
2. Find the duplicate
3. Click trash icon to delete it
4. Click **⟳ Refresh** if it doesn't disappear immediately

### Checking if equipment is being used

There's currently no usage stats. To check if a printer is actively used:

1. Ask users for feedback
2. Monitor error logs if users report issues with specific models
3. (Future feature: usage analytics)

---

## Tips & Best Practices

- **Consistent naming**: Use "Vendor Model" format (e.g., "Creality Ender 3 V3 SE")
- **Reasonable temperature ranges**: 
  - Most FDM printers: 100-110°C bed, 250-300°C nozzle
  - High-temp capable: Up to 120°C bed, 350°C nozzle
- **Group by vendor**: The system sorts by "Group" field, so like printers appear together
- **Review suggestions regularly**: User feedback helps improve the equipment database
- **Cache refresh**: Click **⟳ Refresh** after changes to see updates immediately

---

## Troubleshooting

### Changes don't appear after adding equipment

**Solution**: Click the **⟳ Refresh** button at the top of Equipment Lists.

### "Failed to create equipment" error

**Cause**: Invalid data (e.g., missing required fields, bad temperature values)

**Solution**:
- Check all fields are filled
- Temperatures should be positive numbers
- Try refreshing the page and trying again

### Can't log into admin panel

**Solution**:
1. Verify `ADMIN_USER` and `ADMIN_PASS` in `.env.local` (dev) or Vercel environment (production)
2. Clear browser cookies
3. Try again

### Equipment suggestions not showing

**Cause**: KV database not configured or no suggestions yet

**Solution**:
1. Verify KV is set up (check Vercel Storage dashboard)
2. Have a user submit a suggestion on the main form
3. Suggestions appear within seconds

---

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review logs in Vercel dashboard (Production → Logs)
3. Verify KV and email (SMTP) configuration in Vercel Environment variables
