import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardPage from "./DashboardPage";
import LoginPage from "./LoginPage";

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <div className="cluster-grid grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <LoginPage />;
  return <DashboardLayout><div className="cluster-workspace"><DashboardPage /></div></DashboardLayout>;
}
