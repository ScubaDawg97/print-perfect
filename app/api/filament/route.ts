import { getAllFilaments, initializeFilamentData } from "@/lib/filamentStore";

/**
 * GET /api/filament
 *
 * Returns all active filament types with cache metadata.
 * Initializes KV with defaults if first call.
 */
export async function GET(request: Request) {
  try {
    // Initialize KV on first call if needed
    await initializeFilamentData();

    // Fetch filaments
    const data = await getAllFilaments();

    // Return with cache headers - short TTL to catch updates quickly
    // Users won't see new admin-added filaments until they refresh
    return Response.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30", // 30 seconds instead of 5 min
      },
    });
  } catch (error) {
    console.error("[GET /api/filament] Error:", error);
    return Response.json(
      { error: "Failed to fetch filaments" },
      { status: 500 }
    );
  }
}
