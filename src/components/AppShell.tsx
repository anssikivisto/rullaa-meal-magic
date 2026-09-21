import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Compass, ShoppingBasket, User } from "lucide-react";
import type { ReactNode } from "react";
import { RullaaLogo } from "./RullaaLogo";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Reseptit", icon: BookOpen },
  { to: "/ruokalista", label: "Ruokalista", icon: CalendarDays },
  { to: "/ostoslista", label: "Ostoslista", icon: ShoppingBasket },
  { to: "/loyda", label: "Löydä", icon: Compass },
  { to: "/tili", label: "Tili", icon: User },
] as const;

export function AppShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <RullaaLogo className="h-8 w-8 text-primary" />
              <span className="font-display text-2xl font-semibold tracking-tight text-foreground">Oiva</span>
            </Link>
            {action}
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl border-t border-border/50 bg-background/90 backdrop-blur-md">
          <ul className="grid grid-cols-5">
            {TABS.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 text-[11px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground/80",
                    )}
                  >
                    <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
    </div>
  );
}