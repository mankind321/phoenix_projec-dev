export const dynamic = "force-dynamic";
export const revalidate = 0;

import DashboardClient from "@/app/components/dashboardclient";

export default function Home() {
  return (
    <div>
        <DashboardClient /> 
    </div>
  );
}
