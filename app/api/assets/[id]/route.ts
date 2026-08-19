import { ASSET_API_VERSION, assetById, toAssetApiItem } from "@/lib/gen/assetApi";

const headers = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "Access-Control-Allow-Origin": "*",
};

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const asset = assetById(decodeURIComponent(id));
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404, headers });
    return Response.json({ apiVersion: ASSET_API_VERSION, asset: toAssetApiItem(asset, request.url) }, { headers });
  });
}
