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
const PaymentMethods = lazy(() => import("./pages/PaymentMethods"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
            <Route path="/login" element={<Login />} />
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
