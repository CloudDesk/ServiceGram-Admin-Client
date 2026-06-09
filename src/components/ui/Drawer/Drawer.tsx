import { X } from "lucide-react";
import { useUiStore } from "../../../store/uiStore";

export function DrawerRoot() {
  const drawerContent = useUiStore((state) => state.drawerContent);
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  if (!drawerContent) {
    return null;
  }

  return (
    <div className="premium-overlay flex justify-end">
      <div className="premium-drawer-surface flex max-w-2xl flex-col">
        <div className="flex items-center justify-end border-b border-adaptive p-3">
          <button
            aria-label="Close drawer"
            className="btn-icon"
            onClick={closeDrawer}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{drawerContent}</div>
      </div>
    </div>
  );
}
