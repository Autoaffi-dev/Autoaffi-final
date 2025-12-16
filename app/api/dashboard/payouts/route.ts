import { NextRequest, NextResponse } from "next/server";
import { createMegaEngine2Store } from "@/lib/engines/payments/mega-engine-2-db";
import {
  getWalletSnapshotForUser,
  requestPayout,
} from "@/lib/engines/payments/mega-engine-2-core";

// All data här kräver autenticering → du har user.id via cookies / middleware
// Detta är bara placeholder — anpassas efter din auth senare.
async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const userHeader = req.headers.get("x-user-id");
    return userHeader || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const store = createMegaEngine2Store();
  const wallet = await getWalletSnapshotForUser(store, userId);

  return NextResponse.json(wallet, { status: 200 });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const amount = Number(body.amount);
  const method = body.method || "paypal";
  const destination = body.destination || null;

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: "Invalid payout amount" },
      { status: 400 }
    );
  }

  const store = createMegaEngine2Store();

  try {
    const { payout, balance } = await requestPayout(store, {
      userId,
      amount,
      currency: "usd",
      method,
      destination,
    });

    return NextResponse.json(
      { payout, balance },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Payout failed" },
      { status: 400 }
    );
  }
}