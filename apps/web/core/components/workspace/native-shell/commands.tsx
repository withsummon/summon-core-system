import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { StickyNote, Plus } from "lucide-react";
import { CommandSearchView } from "@/components/navigation/command-search-view";
import { PowerKModalFooter } from "@/components/power-k/ui/modal/footer";
import { useExpandableSearch } from "@/hooks/use-expandable-search";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
export function StickyCommands({
  onCreateSticky,
  onOpenStickies,
}: {
  onCreateSticky: () => Promise<void>;
  onOpenStickies: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const search = useExpandableSearch({ onClose: () => setSearchTerm("") });
  const { openPanel, inputRef, isOpen, handleClose } = search;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) handleClose();
        else {
          openPanel();
          inputRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [openPanel, inputRef, isOpen, handleClose]);
  const create = async () => {
    search.handleClose();
    try {
      await onCreateSticky();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Unable to create sticky",
        message: error instanceof Error ? error.message : "Try again.",
      });
    }
  };
  return (
    <CommandSearchView
      {...search}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      handleClear={() => {
        setSearchTerm("");
        search.inputRef.current?.focus();
      }}
      handleKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          search.handleClose();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          search.containerRef.current?.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')?.click();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          search.containerRef.current
            ?.querySelector("[cmdk-list]")
            ?.dispatchEvent(new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true }));
        }
      }}
      footer={<PowerKModalFooter isWorkspaceLevel={false} projectId={undefined} onWorkspaceLevelChange={() => {}} />}
    >
      <Command.Empty className="p-3 text-13 text-tertiary">No commands found.</Command.Empty>
      <Command.Item
        value="Create new sticky"
        onSelect={() => void create()}
        className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-13 data-[selected=true]:bg-layer-2"
      >
        <Plus className="size-4" />
        Create new sticky
      </Command.Item>
      <Command.Item
        value="Open all stickies"
        onSelect={() => {
          search.handleClose();
          onOpenStickies();
        }}
        className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-13 data-[selected=true]:bg-layer-2"
      >
        <StickyNote className="size-4" />
        Open all stickies
      </Command.Item>
    </CommandSearchView>
  );
}
