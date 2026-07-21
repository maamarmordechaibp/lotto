import { Link, Outlet } from "react-router-dom";
import { Phone, Ticket } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Ticket className="h-6 w-6 text-primary" />
            <span>LuckyLine</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link to="/" className="hover:text-primary">Home</Link>
            <Link to="/past-winners" className="hover:text-primary">Winners</Link>
            <Link to="/faq" className="hover:text-primary">FAQ</Link>
            <Link to="/contact" className="hover:text-primary">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="tel:+18459357587"
              className="hidden items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground sm:flex"
            >
              <Phone className="h-4 w-4" /> Call to Enter
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} LuckyLine Lottery. All rights reserved.</p>
          <nav className="flex gap-4">
            <Link to="/terms" className="hover:text-primary">Terms</Link>
            <Link to="/privacy" className="hover:text-primary">Privacy</Link>
            <Link to="/contact" className="hover:text-primary">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
