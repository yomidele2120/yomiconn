import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import TransactionsPage from "./pages/TransactionsPage";
import ProfilePage from "./pages/ProfilePage";
import AirtimePage from "./pages/AirtimePage";
import DataPage from "./pages/DataPage";
import ElectricityPage from "./pages/ElectricityPage";
import CablePage from "./pages/CablePage";
import AdminPage from "./pages/AdminPage";
import PaymentWaitingPage from "./pages/PaymentWaitingPage";
import NotFound from "./pages/NotFound";
import InAppChatbot from "./components/InAppChatbot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/services/airtime" element={<ProtectedRoute><AirtimePage /></ProtectedRoute>} />
            <Route path="/services/data" element={<ProtectedRoute><DataPage /></ProtectedRoute>} />
            <Route path="/services/electricity" element={<ProtectedRoute><ElectricityPage /></ProtectedRoute>} />
            <Route path="/services/cable" element={<ProtectedRoute><CablePage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/payment-waiting" element={<ProtectedRoute><PaymentWaitingPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
          </Routes>
          <InAppChatbot />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
