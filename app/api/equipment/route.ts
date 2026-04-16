import { NextRequest, NextResponse } from "next/server";
import {
  getAllEquipment,
  getEquipmentByType,
} from "@/lib/equipmentStore";
import { ensureEquipmentDataInitialized } from "@/lib/equipmentMigration";
import { EquipmentListResponseSchema } from "@/lib/equipmentSchemas";

/**
 * GET /api/equipment
 *
 * Retrieves equipment lists (printers, surfaces, nozzles) with caching.
 * Optional query parameter ?type=printers|surfaces|nozzles filters by type.
 *
 * Response includes:
 * - Equipment lists (only active items)
 * - Cache metadata (cached boolean, ttl in ms)
 * - Fetch timestamp
 *
 * Returns 200 with full response or defaults if KV unavailable.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Initialize equipment data on first request
    await ensureEquipmentDataInitialized();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const fresh = searchParams.get("fresh") === "true";

    // Build response
    let responseData: any;

    if (typeParam && ["printers", "surfaces", "nozzles"].includes(typeParam)) {
      // Single type requested
      const data = await getEquipmentByType(
        typeParam as "printers" | "surfaces" | "nozzles",
        fresh
      );

      responseData = {
        [typeParam]: data.filter((item: any) => item.active),
        cached: true,
        ttl: 300000, // 5 minutes
        fetchedAt: new Date().toISOString(),
      };
    } else {
      // All types requested (default)
      const allData = await getAllEquipment(fresh);
      responseData = allData;
    }

    // Validate response schema
    const validated = EquipmentListResponseSchema.safeParse(responseData);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Response validation failed",
        },
        { status: 500 }
      );
    }

    // Return response with cache headers
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300", // 5 minutes
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[GET /api/equipment] Error:", error);

    return NextResponse.json(
      {
        error: "server_error",
        message: "Failed to retrieve equipment data",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/equipment
 *
 * CORS preflight response.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Allow": "GET, OPTIONS",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
