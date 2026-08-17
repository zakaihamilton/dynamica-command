import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import type { CatalogAsset } from "@/lib/gen/assetCatalog";
import { AssetListItem } from "./AssetListItem";
import styles from "./AssetList.module.css";

export function AssetList({
  assets,
  selectedId,
  onSelect,
}: {
  assets: CatalogAsset[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.pane}>
      <ConsoleLabel className={styles.heading}>All generated assets</ConsoleLabel>
      <div className={styles.list} role="listbox" aria-label="Generated assets">
        {assets.map((asset) => (
          <AssetListItem
            key={asset.id}
            asset={asset}
            selected={asset.id === selectedId}
            onSelect={() => onSelect(asset.id)}
          />
        ))}
      </div>
    </div>
  );
}
