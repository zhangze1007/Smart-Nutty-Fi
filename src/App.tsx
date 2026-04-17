import React, { useState } from "react";
import { Home, MessageSquare, PieChart, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AssistantResponse, RiskPrompt, TransferResolutionEvent } from "@/lib/types";
import HomeView from "@/views/HomeView";
import ChatView from "@/views/ChatView";
import TransactionsView from "@/views/TransactionsView";

type View = "home" | "chat" | "transactions";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [riskData, setRiskData] = useState<RiskPrompt | null>(null);
  const [isConfirmingRisk, setIsConfirmingRisk] = useState(false);
  const [transferEvent, setTransferEvent] = useState<TransferResolutionEvent | null>(null);

  const triggerRiskIntervention = (nextRiskData: RiskPrompt) => {
    setRiskData(nextRiskData);
    setIsRiskModalOpen(true);
  };

  const pushTransferEvent = (assistantResponse: AssistantResponse) => {
    setTransferEvent({
      id: Date.now().toString(),
      response: assistantResponse,
    });
  };

  const confirmRiskyTransfer = async () => {
    if (!riskData) {
      return;
    }

    setIsConfirmingRisk(true);

    try {
      const transferResponse = await fetch("/api/actions/confirm-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: riskData.recipient,
          amount: riskData.amount,
          acknowledgedRisk: true,
        }),
      });

      const assistantResponse = (await transferResponse.json()) as AssistantResponse;
      pushTransferEvent(assistantResponse);
    } catch {
      pushTransferEvent({
        reply: "Nutty could not confirm the transfer right now. Please try again.",
        intent: "unknown",
        status: "error",
        actionCard: null,
        calmMode: null,
        confirmation: null,
      });
    } finally {
      setIsConfirmingRisk(false);
      setIsRiskModalOpen(false);
      setRiskData(null);
      setCurrentView("chat");
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-nutty-bg font-sans text-nutty-text-main">
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="relative mx-auto h-full w-full max-w-md bg-nutty-card shadow-sm sm:border-x sm:border-nutty-border">
          {currentView === "home" && <HomeView onNavigate={setCurrentView} />}
          {currentView === "chat" && (
            <ChatView onRiskTrigger={triggerRiskIntervention} transferEvent={transferEvent} />
          )}
          {currentView === "transactions" && <TransactionsView />}
        </div>
      </main>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center">
        <div className="pointer-events-auto flex w-full max-w-md items-center justify-between border-t border-nutty-border bg-nutty-card px-6 py-3 pb-safe">
          <NavItem
            icon={<Home className="h-6 w-6" />}
            label="Home"
            isActive={currentView === "home"}
            onClick={() => setCurrentView("home")}
          />
          <NavItem
            icon={<MessageSquare className="h-6 w-6" />}
            label="Nutty"
            isActive={currentView === "chat"}
            onClick={() => setCurrentView("chat")}
          />
          <NavItem
            icon={<PieChart className="h-6 w-6" />}
            label="Spending"
            isActive={currentView === "transactions"}
            onClick={() => setCurrentView("transactions")}
          />
        </div>
      </div>

      {isRiskModalOpen && riskData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in rounded-[2rem] bg-nutty-card p-6 shadow-2xl fade-in zoom-in-95 duration-200">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-nutty-warning-bg text-[#92400E]">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-center text-2xl font-bold text-nutty-text-main">
              Wait a second.
            </h2>
            <p className="mb-6 text-center text-nutty-text-muted">
              You&apos;re about to transfer{" "}
              <span className="font-semibold text-nutty-text-main">
                RM{riskData.amount.toFixed(2)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-nutty-text-main">{riskData.recipient}</span>.
            </p>

            <div className="mb-8 rounded-2xl border border-nutty-warning-border bg-nutty-warning-bg p-4">
              <p className="text-sm font-medium text-[#92400E]">
                Nutty noticed something unusual:
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {riskData.reasons.map((reason) => (
                  <p key={reason} className="text-sm text-[#78350F]">
                    {reason}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsRiskModalOpen(false)}
                className="h-14 w-full rounded-2xl bg-[#92400E] font-medium text-white transition-colors hover:bg-[#78350F]"
              >
                Pause & Review
              </button>
              <button
                onClick={confirmRiskyTransfer}
                disabled={isConfirmingRisk}
                className="h-14 w-full rounded-2xl border border-nutty-border bg-transparent font-medium text-nutty-text-main transition-colors hover:bg-nutty-bg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isConfirmingRisk ? "Confirming transfer..." : "I understand, continue transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-16 flex-col items-center justify-center gap-1 transition-colors",
        isActive ? "text-nutty-primary" : "text-nutty-text-muted hover:text-nutty-text-main",
      )}
    >
      <div className={cn("rounded-xl p-1.5 transition-colors", isActive && "bg-nutty-bg")}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
