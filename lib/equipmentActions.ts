"use server";

/**
 * Server action to resolve printer UUID to display name.
 * Must be in a separate file from client components.
 */
export async function resolvePrinterName(id: string): Promise<string> {
  try {
    const { getPrinters } = await import("@/lib/equipmentStore");
    const printers = await getPrinters();
    const printer = printers.find((p: any) => p.id === id);
    if (printer) {
      return `${printer.vendorName} ${printer.modelName}`;
    }
  } catch {
    // Fall through
  }
  return id; // Return UUID if lookup fails
}
