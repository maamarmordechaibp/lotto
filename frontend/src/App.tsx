import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { HomePage } from "@/pages/HomePage";
import { LotteryDetailPage } from "@/pages/LotteryDetailPage";
import { EnterPage } from "@/pages/EnterPage";
import { ConfirmationPage } from "@/pages/ConfirmationPage";
import { FaqPage } from "@/pages/FaqPage";
import { PastWinnersPage } from "@/pages/PastWinnersPage";
import { ContactPage } from "@/pages/ContactPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { LotteriesPage } from "@/pages/admin/LotteriesPage";
import { ParticipantsPage } from "@/pages/admin/ParticipantsPage";
import { PaymentsPage } from "@/pages/admin/PaymentsPage";
import { ReportsPage } from "@/pages/admin/ReportsPage";
import { DrawingsPage } from "@/pages/admin/DrawingsPage";
import { VoicePage } from "@/pages/admin/VoicePage";

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public site */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/lottery/:id" element={<LotteryDetailPage />} />
                <Route path="/enter/:id" element={<EnterPage />} />
                <Route path="/confirmation" element={<ConfirmationPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/past-winners" element={<PastWinnersPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
              </Route>

              {/* Admin auth */}
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Admin (protected) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<DashboardPage />} />
                  <Route path="/admin/lotteries" element={<LotteriesPage />} />
                  <Route path="/admin/participants" element={<ParticipantsPage />} />
                  <Route path="/admin/payments" element={<PaymentsPage />} />
                  <Route path="/admin/reports" element={<ReportsPage />} />
                  <Route path="/admin/drawings" element={<DrawingsPage />} />
                  <Route path="/admin/voice" element={<VoicePage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
