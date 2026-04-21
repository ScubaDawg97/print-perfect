import { v4 as uuidv4 } from "uuid";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { isKvConfigured } from "@/lib/config";
import { getFilaments, getFilamentSuggestions, invalidateCache, initializeFilamentData } from "@/lib/filamentStore";
import { DEFAULT_FILAMENTS } from "@/lib/defaultFilaments";
import type { FilamentType, FilamentSuggestion } from "@/lib/filamentSchemas";
import { FilamentTypeSchema, FilamentSuggestionSchema } from "@/lib/filamentSchemas";

/**
 * ─── Admin Filament Management API ────────────────────────────────────────────
 * Protected endpoint for admins to CRUD filaments and manage suggestions.
 * Requires pp_admin cookie.
 */

// Request body schemas
const CreateFilamentSchema = z.object({
  displayName: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  color: z.string().nullable().optional(),
});

const UpdateFilamentSchema = CreateFilamentSchema.partial();

/**
 * GET /api/admin/filament-manage?type=filaments|suggestions
 * List all filaments or suggestions
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "filaments";

    if (type === "suggestions") {
      const suggestions = await getFilamentSuggestions();
      return Response.json(
        { filaments: [], suggestions },
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Default: return filaments
    const filaments = await getFilaments();
    return Response.json(
      { filaments, suggestions: [] },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[GET /api/admin/filament-manage] Error:", error);
    return Response.json(
      { error: "Failed to fetch filaments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/filament-manage
 * Create a new filament
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = CreateFilamentSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 }
      );
    }

    if (!isKvConfigured()) {
      return Response.json(
        { error: "KV storage not configured" },
        { status: 503 }
      );
    }

    // Initialize KV with defaults if needed
    await initializeFilamentData();

    const data = result.data;

    // Create new filament
    const newFilament: FilamentType = {
      id: uuidv4(),
      displayName: data.displayName,
      description: data.description,
      color: data.color || null,
      active: true,
      createdAt: new Date().toISOString(),
    };

    // Get existing filaments directly from KV (bypass getFilaments logic)
    let filaments: FilamentType[] = [];
    try {
      const kvData = await kv.get("filament:types");
      console.log(`[POST] KV raw data type: ${typeof kvData}, is array: ${Array.isArray(kvData)}, length: ${Array.isArray(kvData) ? kvData.length : 'N/A'}`);

      if (Array.isArray(kvData)) {
        // Validate each filament
        filaments = kvData.filter((f) => {
          const valid = FilamentTypeSchema.safeParse(f).success;
          if (!valid) {
            console.log(`[POST] Invalid filament: ${JSON.stringify(f).substring(0, 100)}`);
          }
          return valid;
        });
        console.log(`[POST] After validation: ${filaments.length} valid filaments`);
      }
    } catch (err) {
      console.error("[POST] Error reading from KV:", err);
    }

    // If no valid filaments in KV, use defaults
    if (filaments.length === 0) {
      console.log(`[POST] No valid filaments, using ${DEFAULT_FILAMENTS.length} defaults`);
      filaments = DEFAULT_FILAMENTS;
    }

    // Add the new filament
    const updated = [...filaments, newFilament];
    console.log(`[POST] Updated array length before save: ${updated.length}`);

    // Save to KV
    await kv.set("filament:types", updated);
    console.log(`[POST] Saved to KV`);

    invalidateCache();

    // Verify what was saved
    const verify = await kv.get("filament:types");
    console.log(`[POST] Verification read back: ${Array.isArray(verify) ? verify.length : 'N/A'} items`);


    return Response.json(
      { success: true, filament: newFilament, message: "Filament created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/filament-manage] Error:", error);
    return Response.json(
      { error: "Failed to create filament" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/filament-manage?id=uuid&action=update|approve
 * Update filament or approve suggestion
 */
export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const action = url.searchParams.get("action") || "update";

    if (!id) {
      return Response.json(
        { error: "Missing 'id' parameter" },
        { status: 400 }
      );
    }

    if (!isKvConfigured()) {
      return Response.json(
        { error: "KV storage not configured" },
        { status: 503 }
      );
    }

    // Initialize KV with defaults if needed
    await initializeFilamentData();

    const body = await request.json();

    if (action === "approve") {
      // Approve a suggestion and create filament from it
      const suggestions = await getFilamentSuggestions();
      const suggestion = suggestions.find((s) => s.id === id);

      if (!suggestion) {
        return Response.json(
          { error: "Suggestion not found" },
          { status: 404 }
        );
      }

      // Create filament from suggestion
      const newFilament: FilamentType = {
        id: uuidv4(),
        displayName: suggestion.displayName,
        description: suggestion.userDescription,
        color: null,
        active: true,
        createdAt: new Date().toISOString(),
      };

      // Add filament
      const filaments = await getFilaments();
      const updatedFilaments = [...filaments, newFilament];
      await kv.set("filament:types", updatedFilaments);

      // Update suggestion status
      const updatedSuggestions = suggestions.map((s) =>
        s.id === id ? { ...s, status: "approved" as const } : s
      );
      await kv.set("filament:suggestions", updatedSuggestions);

      invalidateCache();

      return Response.json(
        {
          success: true,
          filament: newFilament,
          message: "Suggestion approved and filament created",
        },
        { status: 200 }
      );
    }

    if (action === "reject") {
      // Reject a suggestion
      const suggestions = await getFilamentSuggestions();
      const suggestion = suggestions.find((s) => s.id === id);

      if (!suggestion) {
        return Response.json(
          { error: "Suggestion not found" },
          { status: 404 }
        );
      }

      const updatedSuggestions = suggestions.map((s) =>
        s.id === id ? { ...s, status: "rejected" as const } : s
      );
      await kv.set("filament:suggestions", updatedSuggestions);

      return Response.json(
        { success: true, message: "Suggestion rejected" },
        { status: 200 }
      );
    }

    // Default: update filament
    const result = UpdateFilamentSchema.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const filaments = await getFilaments();
    const filamentIndex = filaments.findIndex((f) => f.id === id);

    if (filamentIndex === -1) {
      return Response.json(
        { error: "Filament not found" },
        { status: 404 }
      );
    }

    const updated = [...filaments];
    updated[filamentIndex] = {
      ...updated[filamentIndex],
      ...result.data,
    };

    await kv.set("filament:types", updated);
    invalidateCache();

    return Response.json(
      { success: true, filament: updated[filamentIndex], message: "Filament updated" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PUT /api/admin/filament-manage] Error:", error);
    return Response.json(
      { error: "Failed to update filament" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/filament-manage?id=uuid
 * Soft delete a filament (set active=false)
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Missing 'id' parameter" },
        { status: 400 }
      );
    }

    if (!isKvConfigured()) {
      return Response.json(
        { error: "KV storage not configured" },
        { status: 503 }
      );
    }

    // Initialize KV with defaults if needed
    await initializeFilamentData();

    const filaments = await getFilaments(true); // Get fresh from KV
    const filamentIndex = filaments.findIndex((f) => f.id === id);

    if (filamentIndex === -1) {
      return Response.json(
        { error: "Filament not found" },
        { status: 404 }
      );
    }

    const updated = [...filaments];
    updated[filamentIndex] = { ...updated[filamentIndex], active: false };

    await kv.set("filament:types", updated);
    invalidateCache();

    return Response.json(
      { success: true, message: "Filament deleted (deactivated)" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/admin/filament-manage] Error:", error);
    return Response.json(
      { error: "Failed to delete filament" },
      { status: 500 }
    );
  }
}
