import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";

// Secondary routes are loaded on demand to keep the first paint light.
const Templates = lazy(() => import("./pages/Templates.tsx"));
const Library = lazy(() => import("./pages/Library.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.tsx"));
const AdminDuplicates = lazy(() => import("./pages/AdminDuplicates.tsx"));
const AdminTaskTypes = lazy(() => import("./pages/AdminTaskTypes.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const MfaEnroll = lazy(() => import("./pages/MfaEnroll.tsx"));
const VerifyDocument = lazy(() => import("./pages/VerifyDocument.tsx"));
const Pendencias = lazy(() => import("./pages/Pendencias.tsx"));
const Relatorios = lazy(() => import("./pages/Relatorios.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function IndexGate() {
  const { user } = useAuth();
  const { isConcierge, loading } = useUserRole();
  if (loading) return <PageFallback />;
  const flagKey = user ? `concierge-landed:${user.id}` : null;
  if (isConcierge && flagKey && !sessionStorage.getItem(flagKey)) {
    sessionStorage.setItem(flagKey, '1');
    return <Navigate to="/pendencias" replace />;
  }
  return <Index />;
}


function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-document/:id" element={<VerifyDocument />} />
              <Route path="/" element={<ProtectedRoute><IndexGate /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/duplicates" element={<ProtectedRoute><AdminDuplicates /></ProtectedRoute>} />
              <Route path="/admin/tipos-acao" element={<ProtectedRoute><AdminTaskTypes /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/perfil/mfa" element={<ProtectedRoute><MfaEnroll /></ProtectedRoute>} />
              <Route path="/pendencias" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
