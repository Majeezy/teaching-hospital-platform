"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { search, type SearchResultGroup } from "@/actions/search";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setGroups([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await search(value);
        setGroups(results);
      });
    }, 250);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showEmptyState =
    open && query.trim().length >= 2 && !isPending && groups.length === 0;

  return (
    <div ref={containerRef} className="relative w-36 sm:w-48 md:w-64">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      {open && (groups.length > 0 || showEmptyState) && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-1.5rem)] max-h-96 overflow-y-auto rounded-md border bg-white p-1 shadow-lg dark:bg-zinc-950">
          {showEmptyState && (
            <p className="px-2 py-3 text-center text-sm text-zinc-500">
              No results for &ldquo;{query}&rdquo;.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.category} className="flex flex-col gap-0.5 p-1">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {group.category}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col rounded-md px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-zinc-500">{item.sublabel}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
