import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardPage from "./DashboardPage";
import LoginPage from "./LoginPage";

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f5f4ee]"><Loader2 className="h-6 w-6 animate-spin text-[#35635d]" /></div>;
  if (!isAuthenticated) return <LoginPage />;
  return <DashboardLayout><DashboardPage /></DashboardLayout>;
}
