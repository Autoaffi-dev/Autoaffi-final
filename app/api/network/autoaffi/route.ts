import { NextRequest, NextResponse } from "next/server";
import { RevenueManager } from "@/lib/integrations/revenueManager";

/**
 * Autoaffi intern API endpoint
 * - Tar emot inkommande affiliate events från nätverk eller Autoaffis egen plattform
 * - Kan även hämta sparade data (mock nu, men redo för DB)
 */

const manager = new RevenueManager();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'events' array" },
        { status: 400 }
      );
    }

    // Normalisera & spara
    await manager.ingest(body.events);

    return NextResponse.json({ success: true, count: body.events.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  // Mock: returnera exempeldata
  return NextResponse.json({
    success: true,
    data: [
      { id: 1, network: "clickbank", gross: 42.5 },
      { id: 2, network: "digistore24", gross: 19.99 },
    ],
  });
}