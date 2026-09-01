import { ASSET_API_CATEGORIES, ASSET_API_HEADERS, ASSET_API_VERSION, toAssetApiItem } from "@/lib/gen/assetApi";
import { listGeneratedAssets } from "@/lib/gen/assetCatalog";

export function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const assets = listGeneratedAssets();
  const filtered = category ? assets.filter((asset) => asset.category === category) : assets;

  if (category && filtered.length === 0) {
    return Response.json({ error: `Unknown asset category: ${category}` }, { status: 400, headers: ASSET_API_HEADERS });
  }

  return Response.json({
    apiVersion: ASSET_API_VERSION,
    name: "Dynamica Command Asset Bay",
    categories: ASSET_API_CATEGORIES,
    count: filtered.length,
    assets: filtered.map((asset) => toAssetApiItem(asset, request.url)),
  }, { headers: ASSET_API_HEADERS });
}

export function OPTIONS(request: Request) {
  const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
  return new Response(null, {
    headers: {
      ...ASSET_API_HEADERS,
      Allow: "GET, OPTIONS",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": requestedHeaders ?? "Content-Type",
    },
  });
}
