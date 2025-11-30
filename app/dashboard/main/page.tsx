export const dynamic = "force-dynamic";
export const revalidate = 0;

import DashboardClient from "@/app/components/dashboardclient";
import AISearchCard from "../../components/aisearchcard";

export default function Home() {
  return (
    <div>
        <DashboardClient /> 
        <AISearchCard />
    </div>
  );
}
