"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/shadcn/command";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { ADMIN_NAV } from "./admin-nav";

const SearchContext = createContext<{ setOpen: (open: boolean) => void } | null>(null);

/** Bảng lệnh ⌘K/Ctrl+K để nhảy nhanh giữa các trang admin; bọc quanh toàn khối admin ở layout. */
export function AdminSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <SearchContext.Provider value={{ setOpen }}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Tìm trang quản trị"
        description="Gõ tên trang để chuyển tới."
      >
        <CommandInput placeholder="Gõ tên trang cần tới…" />
        <CommandList>
          <ScrollArea type="hover" className="h-64 pe-1">
            <CommandEmpty>Không có trang nào khớp.</CommandEmpty>
            {ADMIN_NAV.map((group) => (
              <CommandGroup key={group.title} heading={group.title}>
                {group.items.map((item) => (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                    <div className="flex size-4 items-center justify-center">
                      <ArrowRight className="text-muted-foreground/80 size-2" />
                    </div>
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </ScrollArea>
        </CommandList>
      </CommandDialog>
    </SearchContext.Provider>
  );
}

function useAdminSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("AdminSearchButton phải nằm trong AdminSearchProvider");
  return context;
}

/** Ô "Tìm trang" trên thanh đầu — bấm hoặc ⌘K đều mở cùng một bảng lệnh. */
export function AdminSearchButton() {
  const { setOpen } = useAdminSearch();

  return (
    <Button
      variant="outline"
      onClick={() => setOpen(true)}
      className="bg-muted/25 text-muted-foreground hover:bg-accent group relative h-8 w-full justify-start text-body font-normal shadow-none sm:w-44 sm:pe-12 lg:w-56"
    >
      <Search aria-hidden size={16} className="absolute start-2 top-1/2 -translate-y-1/2" />
      <span className="ms-4">Tìm trang</span>
      <kbd className="bg-muted group-hover:bg-accent pointer-events-none absolute end-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded-inner border px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
        <span className="text-caption">⌘</span>K
      </kbd>
    </Button>
  );
}
