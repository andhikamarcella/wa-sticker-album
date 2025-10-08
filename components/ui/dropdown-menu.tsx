'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuContent = ({ className, ...props }: DropdownMenuPrimitive.DropdownMenuContentProps) => (
  <DropdownMenuPrimitive.Content
    className={cn(
      'z-50 min-w-[180px] overflow-hidden rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
      className
    )}
    sideOffset={12}
    {...props}
  />
);

const DropdownMenuItem = ({ className, ...props }: DropdownMenuPrimitive.DropdownMenuItemProps) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      'flex cursor-pointer select-none items-center rounded-2xl px-3 py-2 text-sm outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
      className
    )}
    {...props}
  />
);

const DropdownMenuSeparator = () => <div className="my-1 h-px bg-border" />;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
};
