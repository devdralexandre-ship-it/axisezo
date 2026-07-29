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
import Templates from "./pages/Templates.tsx";
import Library from "./pages/Library.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminDuplicates from "./pages/AdminDuplicates.tsx";
import Profile from "./pages/Profile.tsx";
import MfaEnroll from "./pages/MfaEnroll.tsx";
import VerifyDocument from "./pages/VerifyDocument.tsx";
import Pendencias from "./pages/Pendencias.tsx";
import Relatorios from "./pages/Relatorios.tsx";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function IndexGate() {
  const { user } = useAuth();
  const { isConcierge, loading } = useUserRole();
  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
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
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-document/:id" element={<VerifyDocument />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/duplicates" element={<ProtectedRoute><AdminDuplicates /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/perfil/mfa" element={<ProtectedRoute><MfaEnroll /></ProtectedRoute>} />
            <Route path="/pendencias" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
