"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.8125rem]">
      {items.map((it) => {
        const active =
          it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`-mb-px border-b-2 py-3 no-underline transition-colors hover:text-ink ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-soft"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
