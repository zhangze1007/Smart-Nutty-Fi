import React, { useState } from "react";
import { Home, MessageSquare, PieChart, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import HomeView from "@/views/HomeView";
import ChatView from "@/views/ChatView";
import TransactionsView from "@/views/TransactionsView";

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "chat" | "transactions">("home");
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [riskData, setRiskData] = useState<{ amount: number; recipient: string; reason: string } | null>(null);

  const triggerRiskIntervention = (amount: number, recipient: string, reason: string) => {
    setRiskData({ amount, recipient, reason });
    setIsRiskModalOpen(true);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-nutty-bg text-nutty-text-main font-sans overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="mx-auto max-w-md h-full w-full bg-nutty-card shadow-sm sm:border-x sm:border-nutty-border relative">
          {currentView === "home" && <HomeView onNavigate={setCurrentView} onRiskTrigger={triggerRiskIntervention} />}
          {currentView === "chat" && <ChatView onRiskTrigger={triggerRiskIntervention} />}
          {currentView === "transactions" && <TransactionsView />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="w-full max-w-md bg-nutty-card border-t border-nutty-border px-6 py-3 flex justify-between items-center pointer-events-auto pb-safe">
          <NavItem 
            icon={<Home className="w-6 h-6" />} 
            label="Home" 
            isActive={currentView === "home"} 
            onClick={() => setCurrentView("home")} 
          />
          <NavItem 
            icon={<MessageSquare className="w-6 h-6" />} 
            label="Nutty" 
            isActive={currentView === "chat"} 
            onClick={() => setCurrentView("chat")} 
          />
          <NavItem 
            icon={<PieChart className="w-6 h-6" />} 
            label="Spending" 
            isActive={currentView === "transactions"} 
            onClick={() => setCurrentView("transactions")} 
          />
        </div>
      </div>

      {/* Risk Intervention Modal */}
      {isRiskModalOpen && riskData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-nutty-card rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 bg-nutty-warning-bg text-[#92400E] rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-center text-nutty-text-main mb-2">Wait a second.</h2>
            <p className="text-center text-nutty-text-muted mb-6">
              You're about to transfer <span className="font-semibold text-nutty-text-main">RM{riskData.amount.toFixed(2)}</span> to <span className="font-semibold text-nutty-text-main">{riskData.recipient}</span>.
            </p>
            
            <div className="bg-nutty-warning-bg border border-nutty-warning-border rounded-2xl p-4 mb-8">
              <p className="text-sm text-[#92400E] font-medium">
                Nutty noticed something unusual:
              </p>
              <p className="text-sm text-[#78350F] mt-1">
                {riskData.reason}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setIsRiskModalOpen(false)}
                className="w-full bg-[#92400E] text-white font-medium h-14 rounded-2xl hover:bg-[#78350F] transition-colors"
              >
                Pause & Review
              </button>
              <button 
                onClick={() => {
                  setIsRiskModalOpen(false);
                  // In a real app, this would proceed with the transfer
                }}
                className="w-full bg-transparent text-nutty-text-main font-medium h-14 rounded-2xl border border-nutty-border hover:bg-nutty-bg transition-colors"
              >
                I understand, continue transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-16 gap-1 transition-colors",
        isActive ? "text-nutty-primary" : "text-nutty-text-muted hover:text-nutty-text-main"
      )}
    >
      <div className={cn("p-1.5 rounded-xl transition-colors", isActive && "bg-nutty-bg")}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

