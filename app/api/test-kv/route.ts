import { kv } from "@vercel/kv";

/**
 * Diagnostic endpoint to test KV operations
 * GET /api/test-kv
 */
export async function GET() {
  try {
    // Test 1: Write test array
    const testData = [
      { id: "1", name: "Item1" },
      { id: "2", name: "Item2" },
      { id: "3", name: "Item3" },
    ];

    console.log(`[TEST-KV] Writing ${testData.length} items...`);
    await kv.set("test:data", testData);

    // Test 2: Read it back
    const readBack = await kv.get("test:data");
    console.log(`[TEST-KV] Read back type: ${typeof readBack}, is array: ${Array.isArray(readBack)}`);

    if (Array.isArray(readBack)) {
      console.log(`[TEST-KV] Array length: ${readBack.length}`);
    }

    // Test 3: Get current filaments
    console.log(`[TEST-KV] Checking current filaments...`);
    const filaments = await kv.get("filament:types");
    console.log(`[TEST-KV] Filaments type: ${typeof filaments}, is array: ${Array.isArray(filaments)}, length: ${Array.isArray(filaments) ? filaments.length : 'N/A'}`);

    return Response.json(
      {
        test: "OK",
        writeTest: { input: testData.length, readBack: Array.isArray(readBack) ? readBack.length : null },
        filaments: {
          type: typeof filaments,
          isArray: Array.isArray(filaments),
          length: Array.isArray(filaments) ? filaments.length : null,
          sample: Array.isArray(filaments) ? (filaments[0]?.displayName || filaments[0]) : filaments,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[TEST-KV] Error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
