"use client";

import React from "react";
import { useTranslation } from "./I18nContext";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function LanguageSelector({ isSidebarOpen = true }: { isSidebarOpen?: boolean }) {
  const { locale, setLocale, locales } = useTranslation();

  return (
    <div className={cn(
      "flex items-center gap-2 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors border border-border/50",
      isSidebarOpen ? "w-full px-3 py-2" : "w-10 h-10 justify-center"
    )}>
      <Globe className={cn("w-4 h-4 text-muted-foreground shrink-0", !isSidebarOpen && "mx-auto")} />
      {isSidebarOpen && (
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer w-full"
        >
          {locales.map((loc) => (
            <option key={loc} value={loc} className="bg-card text-foreground">
              {loc === 'zh-TW' ? '繁體中文' : loc === 'en' ? 'English' : '日本語'}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
