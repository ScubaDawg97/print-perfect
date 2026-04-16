import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import {
  EquipmentPrinterSchema,
  EquipmentSurfaceSchema,
  EquipmentNozzleSchema,
  EquipmentSuggestionSchema,
  type EquipmentPrinter,
  type EquipmentSurface,
  type EquipmentNozzle,
  type EquipmentSuggestion,
} from "@/lib/equipmentSchemas";
import { invalidateCache } from "@/lib/equipmentStore";

// ── Admin Authentication ────────────────────────────────────────────────────
// All routes require pp_admin cookie set by /api/admin/login

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

function isAuthed(req: NextRequest): boolean {
  return req.cookies.get("pp_admin")?.value === ADMIN_SECRET;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

/**
 * GET /api/admin/equipment-manage (admin-authenticated)
 *
 * List all equipment of specified type.
 * Query: ?type=printers|surfaces|nozzles|suggestions
 *
 * Response: { success: boolean, data: Equipment[], message?: string }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  if (!isAuthed(request)) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as
      | "printers"
      | "surfaces"
      | "nozzles"
      | "suggestions"
      | null;

    if (!type || !["printers", "surfaces", "nozzles", "suggestions"].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Query parameter "type" must be one of: printers, surfaces, nozzles, suggestions',
        },
        { status: 400 }
      );
    }

    const kvKey = `equipment:${type}`;
    const data = await kv.get<any[]>(kvKey);
    const equipmentList = Array.isArray(data) ? data : [];

    return NextResponse.json(
      {
        success: true,
        data: equipmentList,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/admin/equipment-manage] Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve equipment",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/equipment-manage (admin-authenticated)
 *
 * Create new equipment item.
 * Body: {
 *   type: "printers" | "surfaces" | "nozzles"
 *   data: EquipmentPrinter | EquipmentSurface | EquipmentNozzle
 * }
 *
 * Response: { success: boolean, data?: Equipment, message: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  if (!isAuthed(request)) {
    return unauthorized();
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON",
        },
        { status: 400 }
      );
    }

    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: type, data",
        },
        { status: 400 }
      );
    }

    // Generate ID if not provided
    const id = data.id || uuidv4();
    const newItem = { ...data, id, active: true };

    // Validate based on type
    let validated: any;
    let kvKey: string;

    if (type === "printers") {
      const result = EquipmentPrinterSchema.safeParse(newItem);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid printer data",
            errors: result.error.errors,
          },
          { status: 400 }
        );
      }
      validated = result.data;
      kvKey = "equipment:printers";
    } else if (type === "surfaces") {
      const result = EquipmentSurfaceSchema.safeParse(newItem);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid surface data",
            errors: result.error.errors,
          },
          { status: 400 }
        );
      }
      validated = result.data;
      kvKey = "equipment:surfaces";
    } else if (type === "nozzles") {
      const result = EquipmentNozzleSchema.safeParse(newItem);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid nozzle data",
            errors: result.error.errors,
          },
          { status: 400 }
        );
      }
      validated = result.data;
      kvKey = "equipment:nozzles";
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Type must be one of: printers, surfaces, nozzles',
        },
        { status: 400 }
      );
    }

    // Get existing equipment
    const existing = await kv.get<any[]>(kvKey);
    const equipmentList = Array.isArray(existing) ? existing : [];

    // Check for duplicates
    if (equipmentList.some((e) => e.id === id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Equipment with this ID already exists",
        },
        { status: 409 }
      );
    }

    // Add new item
    equipmentList.push(validated);
    await kv.set(kvKey, equipmentList);

    // Clear cache
    invalidateCache();

    return NextResponse.json(
      {
        success: true,
        data: validated,
        message: `${type.slice(0, -1)} created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/admin/equipment-manage] Error:", errorMsg, error);

    return NextResponse.json(
      {
        success: false,
        message: `Failed to create equipment: ${errorMsg}`,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/equipment-manage (admin-authenticated)
 *
 * Update existing equipment item.
 * Query: ?type=printers|surfaces|nozzles&id=<uuid>
 * Body: { voteDirection?: "up" | "down", name?: string, group?: string, ... }
 *
 * Response: { success: boolean, data?: Equipment, message: string }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  if (!isAuthed(request)) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as
      | "printers"
      | "surfaces"
      | "nozzles"
      | null;
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required query parameters: type, id",
        },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON",
        },
        { status: 400 }
      );
    }

    const kvKey = `equipment:${type}`;
    const existing = await kv.get<any[]>(kvKey);
    const equipmentList = Array.isArray(existing) ? existing : [];

    // Find item by id
    const index = equipmentList.findIndex((e) => e.id === id);
    if (index === -1) {
      return NextResponse.json(
        {
          success: false,
          message: "Equipment not found",
        },
        { status: 404 }
      );
    }

    // Merge updates
    const updated = { ...equipmentList[index], ...body };

    // Validate based on type
    let validated: any;

    if (type === "printers") {
      const result = EquipmentPrinterSchema.safeParse(updated);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid printer data",
            errors: result.error.errors,
          },
          { status: 400 }
        );
      }
      validated = result.data;
    } else if (type === "surfaces") {
      const result = EquipmentSurfaceSchema.safeParse(updated);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid surface data",
            errors: result.error.errors,
          },
          { status: 400 }
        );
      }
      validated = result.data;
    } else if (type === "nozzles") {
      const result = EquipmentNozzleSchema.safeParse(updated);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid nozzle data",
            errors: result.error.errors,
          },
          { status: 400 }
        );
      }
      validated = result.data;
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Type must be one of: printers, surfaces, nozzles',
        },
        { status: 400 }
      );
    }

    // Update item
    equipmentList[index] = validated;
    await kv.set(kvKey, equipmentList);

    // Clear cache
    invalidateCache();

    return NextResponse.json(
      {
        success: true,
        data: validated,
        message: `${type.slice(0, -1)} updated successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PUT /api/admin/equipment-manage] Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update equipment",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/equipment-manage (admin-authenticated)
 *
 * Soft-delete equipment (mark as inactive).
 * Query: ?type=printers|surfaces|nozzles&id=<uuid>
 *
 * Response: { success: boolean, message: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  if (!isAuthed(request)) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as
      | "printers"
      | "surfaces"
      | "nozzles"
      | null;
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required query parameters: type, id",
        },
        { status: 400 }
      );
    }

    const kvKey = `equipment:${type}`;
    const existing = await kv.get<any[]>(kvKey);
    const equipmentList = Array.isArray(existing) ? existing : [];

    // Find item by id
    const index = equipmentList.findIndex((e) => e.id === id);
    if (index === -1) {
      return NextResponse.json(
        {
          success: false,
          message: "Equipment not found",
        },
        { status: 404 }
      );
    }

    // Soft delete — mark as inactive
    equipmentList[index].active = false;
    await kv.set(kvKey, equipmentList);

    // Clear cache
    invalidateCache();

    return NextResponse.json(
      {
        success: true,
        message: `${type.slice(0, -1)} deactivated successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/admin/equipment-manage] Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete equipment",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/admin/equipment-manage
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Allow": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
