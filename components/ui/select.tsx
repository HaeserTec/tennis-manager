import * as React from "react"
import ReactDOM from "react-dom"
import { cn } from "@/lib/utils"

const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}>({ 
  value: "", 
  onValueChange: () => {}, 
  open: false, 
  setOpen: () => {},
  triggerRef: { current: null } 
});

export const Select = ({ value, onValueChange, children }: any) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left w-full">{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = ({ className, children }: any) => {
  const { open, setOpen, triggerRef } = React.useContext(SelectContext);
  return (
    <button
      ref={triggerRef}
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => setOpen(!open)}
    >
      {children}
    </button>
  );
};

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { value } = React.useContext(SelectContext);
  return <span className="block truncate">{value || placeholder}</span>;
};

export const SelectContent = ({ children, className }: any) => {
  const { open, setOpen, triggerRef } = React.useContext(SelectContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
      const handleGlobalClick = (event: MouseEvent) => {
          if (!open) return;
          const target = event.target as Node;
          if (triggerRef.current?.contains(target)) return;
          if (contentRef.current?.contains(target)) return;
          setOpen(false);
      };
      // Use mousedown to capture before focus changes or other click handlers
      document.addEventListener("mousedown", handleGlobalClick);
      return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [open, setOpen, triggerRef]);

  // Handle window resize/scroll closing to prevent floating misalignment
  React.useEffect(() => {
    if(!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, { capture: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [open, setOpen]);

  if (!open) return null;
  if (!triggerRef.current) return null;
  
  const rect = triggerRef.current.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 4;
  const left = rect.left + window.scrollX;

  return ReactDOM.createPortal(
    <div
      ref={contentRef}
      style={{
          position: "absolute",
          top,
          left,
          minWidth: rect.width,
          maxWidth: '95vw',
          zIndex: 9999
      }}
      className={cn(
        "overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
        className
      )}
    >
      <div className="p-1">{children}</div>
    </div>,
    document.body
  );
};

export const SelectItem = ({ value, children }: any) => {
  const { onValueChange, setOpen, value: selectedValue } = React.useContext(SelectContext);
  return (
    <div
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground",
        selectedValue === value && "bg-accent/50"
      )}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
    >
      {selectedValue === value && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          ✓
        </span>
      )}
      {children}
    </div>
  );
};