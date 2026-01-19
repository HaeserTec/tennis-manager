import * as React from "react"
import { cn } from "@/lib/utils"

// Context for the dropdown
const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export const DropdownMenu = ({ children, open: controlledOpen, onOpenChange }: { children?: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback((newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    if (!isControlled) setUncontrolledOpen(newOpen);
  }, [onOpenChange, isControlled]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({ asChild, children, ...props }: { asChild?: boolean; children?: React.ReactNode; [key: string]: any }) => {
  const { open, setOpen } = React.useContext(DropdownMenuContext);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const triggerProps = {
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    "aria-haspopup": true,
    "aria-expanded": open,
    ...props
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, triggerProps);
  }
  return <button {...triggerProps}>{children}</button>;
};

export const DropdownMenuContent = ({ className, children, align = "start" }: { className?: string, children?: React.ReactNode, align?: "start" | "end" | "center" }) => {
  const { open, setOpen } = React.useContext(DropdownMenuContext);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open, setOpen]);

  // Focus management and Keyboard Navigation
  React.useEffect(() => {
    if (open && ref.current) {
      // Find the first focusable candidate
      const firstItem = getFocusableItems(ref.current)[0];
      if (firstItem) firstItem.focus();
    }
  }, [open]);

  const getFocusableItems = (container: HTMLElement) => {
    // Select MenuItems and Buttons/Inputs that are NOT inside MenuItems (to handle "Insert Selected" button)
    // We intentionally exclude buttons *inside* MenuItems from arrow navigation (they are reached via Tab)
    const all = Array.from(container.querySelectorAll('[role="menuitem"], button:not([tabindex="-1"]), input:not([tabindex="-1"])'));
    return all.filter(el => {
      // If it's a menuitem, keep it
      if (el.getAttribute('role') === 'menuitem') {
         return !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true';
      }
      // If it's a button/input, keep it ONLY if it is NOT inside a menuitem
      if (el.closest('[role="menuitem"]')) return false;
      return true;
    }) as HTMLElement[];
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!ref.current) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = getFocusableItems(ref.current);
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      let nextIndex;

      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
      } else {
        nextIndex = currentIndex === -1 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      }
      items[nextIndex]?.focus();
    }
    
    // Tab behavior is left default to allow navigating into complex items (like +/- buttons)
  };

  if (!open) return null;

  return (
    <div 
      ref={ref}
      className={cn(
        "absolute z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 focus:outline-none",
        align === "start" && "left-0 origin-top-left",
        align === "end" && "right-0 origin-top-right",
        align === "center" && "left-1/2 -translate-x-1/2 origin-top",
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({ children, onClick, onSelect, disabled, className, ...props }: { children?: React.ReactNode; onClick?: (e: React.MouseEvent) => void; onSelect?: (e: React.SyntheticEvent) => void; disabled?: boolean; className?: string; [key: string]: any }) => {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleSelect = (e: React.SyntheticEvent) => {
    if (disabled) return;
    
    // Allow external logic to handle selection (and potentially prevent closing)
    if (onSelect) onSelect(e);
    if (onClick) onClick(e as any);

    if (!e.defaultPrevented) {
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If the user is interacting with an inner form control (like a textbox or button inside the item),
    // don't trigger the menu item selection on Enter/Space.
    if (e.target !== e.currentTarget) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(e);
    }
  };

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuLabel = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>
    {children}
  </div>
);

export const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
);
