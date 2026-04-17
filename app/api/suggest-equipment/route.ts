import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { SubmitEquipmentSuggestionSchema } from "@/lib/equipmentSchemas";
import { getClientIp, maskIp } from "@/lib/rateLimiter";
import { sendEquipmentSuggestionNotification } from "@/lib/mailer";

/**
 * POST /api/suggest-equipment
 *
 * Accept user equipment suggestions with rate limiting.
 * Rate limit: 1 suggestion per IP per 24-hour calendar day.
 *
 * Request body:
 * {
 *   equipmentType: "printer" | "surface" | "nozzle"
 *   name: string (1-100 chars)
 *   description: string (5-500 chars)
 *   characteristics?: string (0-500 chars)
 * }
 *
 * Response:
 * - On success (201): { id: uuid, status: "submitted", message: "Thanks for your suggestion!" }
 * - On rate limit (429): { status: "rate_limited", message: "You can submit one suggestion per day..." }
 * - On validation error (400): { error: "validation_error", message: "..." }
 * - On server error (500): { error: "server_error", message: "..." }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "invalid_json",
          message: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    // Validate against schema
    const parseResult = SubmitEquipmentSuggestionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid request format",
          details: parseResult.error.issues.map((e) => ({
            path: (e.path as any[]).join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { equipmentType, name, description, characteristics } =
      parseResult.data;

    // Get client IP for rate limiting
    const clientIp = getClientIp(request) || "unknown";
    const maskedIp = maskIp(clientIp);

    // Check rate limit: 1 suggestion per IP per calendar day
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const rateLimitKey = `equipment:suggestion:${maskedIp}:${today}`;

    // Get current count
    let suggestionCount = 0;
    try {
      const count = await kv.get<number>(rateLimitKey);
      suggestionCount = count ?? 0;
    } catch {
      // Treat errors as count=0, proceed with caution
      console.error(
        `[suggest-equipment] Failed to check rate limit for ${rateLimitKey}`
      );
    }

    // Check if limit exceeded
    if (suggestionCount >= 1) {
      return NextResponse.json(
        {
          status: "rate_limited",
          message: "You can submit one suggestion per day. Please try again tomorrow.",
        },
        { status: 429 }
      );
    }

    // Create suggestion object
    const suggestionId = uuidv4();
    const suggestion = {
      id: suggestionId,
      equipmentType,
      proposedName: name,
      userDescription: description,
      userCharacteristics: characteristics || "",
      submissionTime: new Date().toISOString(),
      submitterIp: maskedIp,
      votes: 0,
      status: "pending" as const,
    };

    // Store suggestion in KV (fire-and-forget)
    // Try to append to suggestions list
    try {
      // Try to get existing suggestions array
      const existingSuggestions = await kv.get<any[]>(
        "equipment:suggestions"
      );
      const suggestionsList = Array.isArray(existingSuggestions)
        ? existingSuggestions
        : [];

      // Add new suggestion
      suggestionsList.push(suggestion);

      // Store back to KV
      await kv.set("equipment:suggestions", suggestionsList);

      // Increment rate limit counter with 25-hour TTL
      // (covers 24 hours + 1 hour buffer)
      await kv.incr(rateLimitKey);
      await kv.expire(rateLimitKey, 25 * 60 * 60);
    } catch (error) {
      // Log but don't fail the response
      console.error(
        "[suggest-equipment] Failed to store suggestion:",
        error
      );
    }

    // Send admin notification email (fire-and-forget, does not block response)
    void sendEquipmentSuggestionNotification(
      equipmentType,
      name,
      description,
      characteristics
    );

    // Return success response
    return NextResponse.json(
      {
        id: suggestionId,
        status: "submitted",
        message: "Thanks for your suggestion! Our team will review it.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/suggest-equipment] Unexpected error:", error);

    return NextResponse.json(
      {
        error: "server_error",
        message: "Failed to submit suggestion",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/suggest-equipment
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Allow": "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
