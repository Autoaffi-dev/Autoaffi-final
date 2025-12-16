import { NextRequest, NextResponse } from "next/server";
import {
  searchProductIndex,
  type ProductSource,
} from "@/lib/engines/product-indexer/indexer";

/**
 * Product Search API
 * GET /api/products/search?q=keyword&sources=digistore,mylead&limit=10
 *
 * Next.js 16 compatible
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") ?? "";
    const limitParam = searchParams.get("limit");
    const sourcesParam = searchParams.get("sources");

    const limit = limitParam ? Number(limitParam) : undefined;

    const sources: ProductSource[] | undefined = sourcesParam
      ? (sourcesParam.split(",") as ProductSource[])
      : undefined;

    const results = await searchProductIndex({
      query,
      sources,
      limit,
    });

    return NextResponse.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message ?? "Product search failed",
      },
      { status: 500 }
    );
  }
}