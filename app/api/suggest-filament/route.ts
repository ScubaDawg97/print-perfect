import { v4 as uuidv4 } from "uuid";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { getClientIp, maskIp } from "@/lib/rateLimiter";
import { isKvConfigured } from "@/lib/config";
import type { FilamentSuggestion } from "@/lib/filamentSchemas";

/**
 * POST /api/suggest-filament
 *
 * Accept user-submitted filament suggestions with rate limiting.
 * Limit: 1 suggestion per IP per calendar day.
 */

const SuggestFilamentSchema = z.object({
  displayName: z.string().min(1).max(100),
  userDescription: z.string().min(5).max(500),
  characteristics: z.string().max(500).optional().nullable(),
});

type SuggestFilamentRequest = z.infer<typeof SuggestFilamentSchema>;

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const result = SuggestFilamentSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = result.data as SuggestFilamentRequest;

    // Rate limiting: 1 suggestion per IP per calendar day
    if (isKvConfigured()) {
      const clientIp = getClientIp(request);
      const maskedIp = maskIp(clientIp);
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const rateLimitKey = `filament:suggestion:${maskedIp}:${today}`;

      try {
        const existingCount = await kv.get<number>(rateLimitKey);
        if (existingCount && existingCount >= 1) {
          return Response.json(
            {
              id: null,
              status: "rate_limited",
              message: "You can submit one filament suggestion per day. Please try again tomorrow.",
            },
            { status: 429 }
          );
        }

        // Increment counter
        await kv.incr(rateLimitKey);
        // Set expiry to 25 hours (covers any timezone edge cases)
        await kv.expire(rateLimitKey, 25 * 60 * 60);
      } catch (error) {
        console.error("[suggest-filament] Rate limit check failed:", error);
        // Silently fail rate limiting, allow suggestion
      }
    }

    // Create suggestion object
    const suggestion: FilamentSuggestion = {
      id: uuidv4(),
      displayName: data.displayName,
      userDescription: data.userDescription,
      characteristics: data.characteristics || null,
      status: "pending",
      votes: 0,
      submissionTime: new Date().toISOString(),
    };

    // Fire-and-forget: store suggestion in KV
    if (isKvConfigured()) {
      try {
        const existingSuggestions = (await kv.get<FilamentSuggestion[]>(
          "filament:suggestions"
        )) || [];
        await kv.set("filament:suggestions", [...existingSuggestions, suggestion]);
      } catch (error) {
        console.error("[suggest-filament] Failed to store suggestion:", error);
        // Don't fail the response — suggestion is captured
      }
    }

    return Response.json(
      {
        id: suggestion.id,
        status: "submitted",
        message: "Thank you! Your filament suggestion has been submitted. Our team will review it shortly.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/suggest-filament] Error:", error);
    return Response.json(
      { error: "Failed to submit suggestion" },
      { status: 500 }
    );
  }
}
