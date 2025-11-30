import { Button } from "@/components/ui/button"
import { Activity } from "lucide-react"
import { useState } from "react"

interface ActionTabsProps{
  onTabChange: (tab: string) => void
}

export const ActionTabs: React.FC<ActionTabsProps> = ({ onTabChange }) => {
  const [activeTab,setActiveTab] = useState("Properties")

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    onTabChange(tab);
  }

  const baseClass =
    "flex-1 font-bold text-gray-700 border-r border-gray-200 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center gap-2 rounded-none shadow-none"

  const activeClass = "bg-blue-100 text-blue-700"

  return (
    <div className="w-4/5 mx-auto mt-6 bg-[#f8f9fb] border border-gray-200 flex">
      <Button
        onClick={() => handleTabClick("Properties")}
        className={`${baseClass} ${activeTab === "Properties" ? activeClass : "bg-white"}`}
      >
        Properties
      </Button>

      <Button
        onClick={() => handleTabClick("Leases")}
        className={`${baseClass} ${activeTab === "Leases" ? activeClass : "bg-white"}`}
      >
        Leases
      </Button>

      <Button
        onClick={() => handleTabClick("Documents")}
        className={`${baseClass} ${activeTab === "Documents" ? activeClass : "bg-white"}`}
      >
        Documents
      </Button>

      <Button
        onClick={() => handleTabClick("Audit Trail")}
        className={`${baseClass} border-r-0 ${activeTab === "Audit Trail" ? activeClass : "bg-white"}`}
      >
        <Activity className="w-5 h-5" />
        Audit Trail
      </Button>
    </div>
  )
}

export default ActionTabs