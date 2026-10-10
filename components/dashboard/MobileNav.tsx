"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import type { RoleName } from "@prisma/client";
import { NavLinks } from "@/components/dashboard/NavLinks";
import { Button } from "@/components/ui/button";

export function MobileNav({
  roles,
  unreadMessageCount,
}: {
  roles: RoleName[];
  unreadMessageCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation menu"
          />
        }
      >
        <Menu size={20} />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        {/* A dedicated left-side drawer, not DialogContent from
            components/ui/dialog -- that one is built for a centered,
            zoom-in confirmation/form popup, not a full-height slide-in
            panel, and fighting its positioning classes with overrides
            would be more fragile than just styling the Base UI
            primitives directly here. */}
        <DialogPrimitive.Popup
          className="fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85%] flex-col bg-background shadow-lg outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
          aria-label="Navigation"
        >
          <div className="flex items-center justify-between px-4 py-5">
            <span className="text-sm font-semibold">Teaching Hospital</span>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close navigation menu"
                />
              }
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto">
            <NavLinks
              roles={roles}
              unreadMessageCount={unreadMessageCount}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
