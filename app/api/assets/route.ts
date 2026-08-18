import { ASSET_API_VERSION, toAssetApiItem } from "@/lib/gen/assetApi";
import { listGeneratedAssets } from "@/lib/gen/assetCatalog";

const headers = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "Access-Control-Allow-Origin": "*",
};

export function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const assets = listGeneratedAssets();
  const filtered = category ? assets.filter((asset) => asset.category === category) : assets;

  if (category && filtered.length === 0) {
    return Response.json({ error: `Unknown asset category: ${category}` }, { status: 400, headers });
  }

  return Response.json({
    apiVersion: ASSET_API_VERSION,
    name: "Genesis Protocol Asset Bay",
    count: filtered.length,
    assets: filtered.map((asset) => toAssetApiItem(asset, request.url)),
  }, { headers });
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      ...headers,
      Allow: "GET, OPTIONS",
    },
  });
}
