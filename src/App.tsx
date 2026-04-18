import React, { useEffect, useState } from "react";
import { Home, MessageSquare, PieChart, ShieldAlert, PauseCircle, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AssistantResponse,
  RiskProfileId,
  RiskPrompt,
  TextScale,
  TransferResolutionEvent,
} from "@/lib/types";
import HomeView from "@/views/HomeView";
import ChatView from "@/views/ChatView";
import TransactionsView from "@/views/TransactionsView";

type View = "home" | "chat" | "transactions";

const RISK_PROFILE_STORAGE_KEY = "nutty-risk-profile";
const TEXT_SCALE_STORAGE_KEY = "nutty-text-scale";

function safeReadStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Some mobile browsers or embedded webviews block localStorage access.
  }
}

function getRiskProfileLabel(riskProfile: RiskProfileId) {
  if (riskProfile === "conservative") {
    return "Conservative";
  }

  if (riskProfile === "flexible") {
    return "Flexible";
  }

  return "Balanced";
}

function readStoredRiskProfile(): RiskProfileId {
  const storedValue = safeReadStorage(RISK_PROFILE_STORAGE_KEY);
  if (
    storedValue === "conservative" ||
    storedValue === "balanced" ||
    storedValue === "flexible"
  ) {
    return storedValue;
  }

  return "balanced";
}

function readStoredTextScale(): TextScale {
  return safeReadStorage(TEXT_SCALE_STORAGE_KEY) === "large" ? "large" : "standard";
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [riskData, setRiskData] = useState<RiskPrompt | null>(null);
  const [isConfirmingRisk, setIsConfirmingRisk] = useState(false);
  const [isCancellingRisk, setIsCancellingRisk] = useState(false);
  const [transferEvent, setTransferEvent] = useState<TransferResolutionEvent | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfileId>(() => readStoredRiskProfile());
  const [textScale, setTextScale] = useState<TextScale>(() => readStoredTextScale());

  useEffect(() => {
    safeWriteStorage(RISK_PROFILE_STORAGE_KEY, riskProfile);
  }, [riskProfile]);

  useEffect(() => {
    safeWriteStorage(TEXT_SCALE_STORAGE_KEY, textScale);

    if (typeof document !== "undefined") {
      document.documentElement.style.fontSize = textScale === "large" ? "18px" : "16px";
    }
  }, [textScale]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    if (isRiskModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, [isRiskModalOpen]);

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
          riskProfile: riskData.appliedProfile,
          riskLogId: riskData.riskLogId,
          ruleCodes: riskData.ruleHits.map((ruleHit) => ruleHit.code),
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

  const cancelRiskyTransfer = async () => {
    if (!riskData) {
      return;
    }

    setIsCancellingRisk(true);

    try {
      const cancelResponse = await fetch("/api/actions/cancel-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: riskData.recipient,
          amount: riskData.amount,
          riskProfile: riskData.appliedProfile,
          riskLogId: riskData.riskLogId,
          ruleCodes: riskData.ruleHits.map((ruleHit) => ruleHit.code),
        }),
      });

      const assistantResponse = (await cancelResponse.json()) as AssistantResponse;
      pushTransferEvent(assistantResponse);
    } catch {
      pushTransferEvent({
        reply: "Nutty could not pause the transfer right now, but no money was moved.",
        intent: "unknown",
        status: "error",
        actionCard: null,
        calmMode: null,
        confirmation: null,
      });
    } finally {
      setIsCancellingRisk(false);
      setIsRiskModalOpen(false);
      setRiskData(null);
      setCurrentView("chat");
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-nutty-bg font-sans text-nutty-text-main">
      <main className={cn("flex-1 pb-24", isRiskModalOpen ? "overflow-hidden" : "overflow-y-auto")}>
        <div className="relative mx-auto h-full w-full max-w-md bg-nutty-card shadow-sm sm:border-x sm:border-nutty-border">
          {currentView === "home" && (
            <HomeView
              onNavigate={setCurrentView}
              riskProfile={riskProfile}
              onRiskProfileChange={setRiskProfile}
              textScale={textScale}
              onTextScaleChange={setTextScale}
            />
          )}
          {currentView === "chat" && (
            <ChatView
              onRiskTrigger={triggerRiskIntervention}
              transferEvent={transferEvent}
              riskProfile={riskProfile}
            />
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center overscroll-none bg-[#2D1606]/75 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calm-mode-title"
            className="flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-[#D97706]/30 bg-[#FFF7ED] shadow-2xl"
            style={{ maxHeight: "90dvh" }}
          >
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-6 touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316] text-white shadow-lg">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div className="mb-6 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C2410C]">
                  Calm Mode
                </p>
                <h2 id="calm-mode-title" className="mb-2 text-2xl font-bold text-[#7C2D12]">
                  Pause before sending.
                </h2>
                <p className="text-sm text-[#9A3412]">
                  Nutty paused{" "}
                  <span className="font-semibold">RM{riskData.amount.toFixed(2)}</span> to{" "}
                  <span className="font-semibold">{riskData.recipient}</span> under the{" "}
                  <span className="font-semibold">
                    {getRiskProfileLabel(riskData.appliedProfile)}
                  </span>{" "}
                  profile.
                </p>
              </div>

              <div className="mb-4 rounded-2xl border border-[#FDBA74] bg-white/80 p-4">
                <p className="mb-3 text-sm font-semibold text-[#9A3412]">Why Nutty intervened</p>
                <div className="flex flex-col gap-3">
                  {riskData.ruleHits.map((ruleHit) => (
                    <div
                      key={ruleHit.code}
                      className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#7C2D12]">{ruleHit.title}</p>
                        <span className="rounded-full bg-[#FFEDD5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C2410C]">
                          {ruleHit.severity}
                        </span>
                      </div>
                      <p className="text-sm text-[#9A3412]">{ruleHit.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#FED7AA] bg-white/80 p-4">
                <p className="mb-2 text-sm font-semibold text-[#9A3412]">Policy context</p>
                <p className="mb-3 text-sm text-[#7C2D12]">{riskData.policySummary}</p>
                <div className="flex flex-col gap-2">
                  {riskData.citations.map((citation) => (
                    <a
                      key={citation.url}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-left text-xs font-medium text-[#9A3412] transition-colors hover:bg-[#FFEDD5]"
                    >
                      <span>{citation.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 shrink-0 border-t border-[#FED7AA] bg-[#FFF7ED] px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-12px_24px_rgba(124,45,18,0.08)]">
              <div className="flex flex-col gap-3">
                <button
                  onClick={cancelRiskyTransfer}
                  disabled={isCancellingRisk || isConfirmingRisk}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#FDBA74] bg-white font-medium text-[#9A3412] transition-colors hover:bg-[#FFF1E6] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <PauseCircle className="h-4 w-4" />
                  {isCancellingRisk ? "Pausing..." : "Pause for now"}
                </button>
                <button
                  onClick={confirmRiskyTransfer}
                  disabled={isConfirmingRisk || isCancellingRisk}
                  className="h-14 w-full rounded-2xl bg-[#9A3412] font-medium text-white transition-colors hover:bg-[#7C2D12] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isConfirmingRisk ? "Confirming transfer..." : "Continue after review"}
                </button>
              </div>
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
