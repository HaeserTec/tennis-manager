import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  theme: 'dark' | 'light' | 'midnight';
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 border",
        theme === 'light' 
          ? "bg-stone-200 border-stone-300 text-zinc-700 hover:text-black"
          : "bg-zinc-900 border-zinc-800 text-yellow-400 hover:text-yellow-300",
        className
      )}
      title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 animate-in zoom-in-50 duration-300" />
      ) : (
        <Sun className="w-5 h-5 animate-in zoom-in-50 duration-300" />
      )}
    </button>
  );
}
