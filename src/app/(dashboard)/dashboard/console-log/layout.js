"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";

const TABS = [
  { href: "/dashboard/console-log", label: "Console", icon: "terminal" },
  { href: "/dashboard/console-log/activity", label: "Activity", icon: "history" },
  { href: "/dashboard/console-log/proxy", label: "Proxy", icon: "lan" },
  { href: "/dashboard/console-log/timeline", label: "Timeline", icon: "timeline" },
];

export default function ConsoleLogLayout({ children }) {
  const pathname = (usePathname() || "").replace(/\/+$/, "");

  return (
    <div className="flex flex-col gap-4">
      <nav className="inline-flex w-fit max-w-full items-center overflow-x-auto rounded-[10px] bg-surface-2 p-1" aria-label="Logs">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-[8px] px-4 text-sm font-medium transition-all",
                active ? "bg-surface text-text-main shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <span className="material-symbols-outlined mr-1.5 text-[16px]">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
