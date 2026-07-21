import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Ticket,
  Users,
  CreditCard,
  Trophy,
  Mic,
} from "lucide-react";
import { signOut } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/lotteries", label: "Lotteries", icon: Ticket },
  { to: "/admin/participants", label: "Participants", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/drawings", label: "Drawings", icon: Trophy },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/voice", label: "Voice", icon: Mic },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6 font-bold">
          <Ticket className="h-5 w-5 text-primary" /> Admin
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 border-t px-6 py-4 text-sm font-medium hover:bg-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <h1 className="text-lg font-semibold">Lottery Administration</h1>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
