import * as React from "react"
import { cn } from "@/lib/utils"

const TooltipContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export const TooltipProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export const Tooltip = ({ children }: { children?: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div 
        className="relative flex items-center justify-center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

export const TooltipTrigger = ({ children, asChild, ...props }: { children?: React.ReactNode; asChild?: boolean; [key: string]: any }) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, { ...props });
  }
  return <button {...props}>{children}</button>;
}

export const TooltipContent = ({ children, className, side = "bottom" }: { children?: React.ReactNode; className?: string; side?: "top" | "bottom" | "left" | "right" }) => {
  const { open } = React.useContext(TooltipContext);
  
  if (!open) return null;

  const sideClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2",
  };

  return (
    <div
      className={cn(
        "absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 shadow-md",
        sideClasses[side as keyof typeof sideClasses] || sideClasses.bottom,
        className
      )}
    >
      {children}
    </div>
  )
}