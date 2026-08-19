import { ASSET_FACINGS, assetById, assetPreviewSpec, spriteSpecToSvg } from "@/lib/gen/assetApi";
import type { Facing } from "@/lib/types";

const headers = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "Access-Control-Allow-Origin": "*",
};

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const asset = assetById(decodeURIComponent(id));
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404, headers });

    const url = new URL(request.url);
    const rawFacing = url.searchParams.get("facing");
    const facing = rawFacing === null ? 0 : Number(rawFacing);
    if (!Number.isInteger(facing) || !ASSET_FACINGS.includes(facing as Facing)) {
      return Response.json({ error: "facing must be an integer from 0 to 7" }, { status: 400, headers });
    }
    if (asset.category !== "unit" && facing !== 0) {
      return Response.json({ error: "This asset does not support directional previews" }, { status: 400, headers });
    }

    const spec = assetPreviewSpec(asset, facing as Facing);
    if (spec.imageSrc && asset.category !== "unit") return Response.redirect(new URL(spec.imageSrc, request.url), 307);

    return new Response(spec.svg ?? spriteSpecToSvg(spec, spec.imageSrc ? new URL(spec.imageSrc, request.url).toString() : undefined), {
      headers: {
        ...headers,
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  });
}
