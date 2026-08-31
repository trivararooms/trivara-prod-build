import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";

// Route-level code-splitting: everything except the home page (which needs to
// be in the initial bundle so the very first paint has no extra network hop)
// is loaded on demand. This keeps the main JS chunk down for the common case
// of a visitor who only ever looks at the home page, at the cost of a small
// per-route fetch (shown via the PageFallback spinner below) the first time
// someone navigates to a given page.
const Search = lazy(() => import("./pages/Search"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const Trips = lazy(() => import("./pages/Trips"));
const Saved = lazy(() => import("./pages/Saved"));
const Account = lazy(() => import("./pages/Account"));
const Login = lazy(() => import("./pages/Login"));
const BecomeHost = lazy(() => import("./pages/host/BecomeHost"));
const HostDashboard = lazy(() => import("./pages/host/HostDashboard"));
const CreateListing = lazy(() => import("./pages/host/CreateListing"));
const HostEarnings = lazy(() => import("./pages/host/HostEarnings"));
const ListingCalendar = lazy(() => import("./pages/host/ListingCalendar"));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AboutPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.AboutPage })));
const CareersPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.CareersPage })));
const PressPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.PressPage })));
const PrivacyPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.TermsPage })));
const HelpCenterPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.HelpCenterPage })));
const SafetyPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.SafetyPage })));
const CancellationOptionsPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.CancellationOptionsPage })));
const ResourcesPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.ResourcesPage })));
const CommunityPage = lazy(() => import("./pages/info/InfoPage").then(m => ({ default: m.CommunityPage })));
const Messages = lazy(() => import("./pages/Messages"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-accent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<Search />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/saved" element={
              <ProtectedRoute>
                <Saved />
              </ProtectedRoute>
            } />
            <Route path="/host" element={<BecomeHost />} />
            <Route path="/host/dashboard" element={
              <ProtectedRoute>
                <HostDashboard />
              </ProtectedRoute>
            } />
            <Route path="/host/listings/new" element={
              <ProtectedRoute>
                <CreateListing />
              </ProtectedRoute>
            } />
            <Route path="/host/listings/:id/edit" element={
              <ProtectedRoute>
                <CreateListing />
              </ProtectedRoute>
            } />
            <Route path="/host/earnings" element={
              <ProtectedRoute>
                <HostEarnings />
              </ProtectedRoute>
            } />
            <Route path="/host/listings/:id/calendar" element={
              <ProtectedRoute>
                <ListingCalendar />
              </ProtectedRoute>
            } />
            <Route path="/account" element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            } />
            <Route path="/account/payment-methods" element={
              <ProtectedRoute>
                <PaymentMethods />
              </ProtectedRoute>
            } />
            <Route path="/account/settings" element={
              <ProtectedRoute>
                <AccountSettings />
              </ProtectedRoute>
            } />
            <Route path="/account/notifications" element={
              <ProtectedRoute>
                <NotificationSettings />
              </ProtectedRoute>
            } />
            <Route path="/login" element={<Login />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/press" element={<PressPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/cancellation-options" element={<CancellationOptionsPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/messages" element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            } />
            <Route path="/bookings/:id/confirmation" element={
              <ProtectedRoute>
                <BookingConfirmation />
              </ProtectedRoute>
            } />
            {/* /admin alone isn't a real page - redirect it to the actual
                dashboard rather than letting it fall through to the catch-all
                NotFound route, since that's the URL people naturally try. */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>} />
            <Route path="/admin/dashboard/settings" element={<ProtectedRoute requiredRole="admin">
              <AdminSettings />
            </ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
