import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Type,
  RotateCcw,
  Info,
  ScrollText,
  Wallet,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createMockDashboardData, mockDashboardData } from "@/data/mockTransactions";
import { getDashboardData, resetDemoData } from "@/lib/dataProvider";
import type { RiskProfileId, TextScale } from "@/lib/types";

const riskProfileDescriptions: Record<RiskProfileId, string> = {
  conservative: "Earlier decision checkpoints for unfamiliar or higher-risk money movement.",
  balanced: "Recommended demo default: strong intervention on risky transfers without blocking routine ones.",
  flexible: "Later checkpoints, while still pausing obvious scam or low-buffer transfers.",
};

export default function HomeView({
  onNavigate,
  riskProfile,
  onRiskProfileChange,
  textScale,
  onTextScaleChange,
}: {
  onNavigate: (view: "home" | "chat" | "transactions") => void;
  riskProfile: RiskProfileId;
  onRiskProfileChange: (riskProfile: RiskProfileId) => void;
  textScale: TextScale;
  onTextScaleChange: (textScale: TextScale) => void;
}) {
  const [simulatorAmount, setSimulatorAmount] = useState("");
  const [dashboard, setDashboard] = useState(createMockDashboardData());
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [demoResetFeedback, setDemoResetFeedback] = useState<null | {
    tone: "success" | "error";
    message: string;
  }>(null);
  const simulatorSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    getDashboardData()
      .then((nextDashboard) => {
        if (isMounted) {
          setDashboard(nextDashboard);
        }
      })
      .catch(() => {
        // Keep fallback data if both Firestore and runtime snapshot fail.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDemoReset = async () => {
    setIsResettingDemo(true);
    setDemoResetFeedback(null);

    try {
      const nextDashboard = await resetDemoData();
      setDashboard(nextDashboard);
      setDemoResetFeedback({
        tone: "success",
        message: "Demo state reset to the seeded judging baseline.",
      });
    } catch {
      setDemoResetFeedback({
        tone: "error",
        message: "Nutty could not reset the demo state right now. Please try again.",
      });
    } finally {
      setIsResettingDemo(false);
    }
  };

  const simulatedBalance =
    dashboard.currentBalance - dashboard.upcomingBills - (parseFloat(simulatorAmount) || 0);
  const demoState = dashboard.demoState;
  const baselineBalance = demoState?.baselineBalance ?? mockDashboardData.currentBalance;

  const scrollToSimulator = () => {
    simulatorSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-nutty-bg pb-8">
      <div className="mb-6 rounded-b-[2.5rem] bg-nutty-card px-6 pb-6 pt-12 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-nutty-text-muted">Good morning, Alex</p>
            <h1 className="text-2xl font-bold text-nutty-text-main">Nutty-Fi</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-nutty-accent font-bold text-white">
            A
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-nutty-primary p-6 text-white">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-nutty-accent/20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-24 w-24 rounded-full bg-nutty-secondary/20 blur-2xl"></div>

          <p className="relative z-10 mb-2 text-sm text-white/80">
            {demoState?.hasPersistentData ? "Persisted Demo State" : "Total Balance"}
          </p>
          <h2 className="relative z-10 mb-4 text-4xl font-bold">
            RM {dashboard.currentBalance.toFixed(2)}
          </h2>
          <p className="relative z-10 mb-6 max-w-[18rem] text-sm text-white/85">
            {demoState?.hasPersistentData
              ? "This screen includes previous demo activity. Reset to return to the clean judging baseline before recording."
              : "Decision intervention before risky digital money moves, with clarity before action."}
          </p>

          {demoState?.hasPersistentData && (
            <div className="relative z-10 mb-6 rounded-[1.5rem] border border-white/15 bg-[#FFF7ED]/95 p-4 text-[#7C2D12] shadow-lg">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] text-[#C2410C]">
                  <Info className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Demo state includes previous transfers</p>
                  <p className="mt-1 text-xs leading-5 text-[#9A3412]">
                    {demoState.explanation}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#7C2D12]">
                    Clean baseline: RM {baselineBalance.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDemoReset}
                disabled={isResettingDemo}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#9A3412] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#7C2D12] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RotateCcw className="h-4 w-4" />
                {isResettingDemo ? "Resetting demo..." : "Reset to clean demo"}
              </button>
            </div>
          )}

          <div className="relative z-10 flex gap-4">
            <button
              onClick={() => onNavigate("chat")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Start transfer
            </button>
            <button
              onClick={scrollToSimulator}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-nutty-card py-3 text-sm font-medium text-nutty-text-main transition-colors hover:bg-nutty-bg"
            >
              <Wallet className="h-4 w-4" />
              What-if check
            </button>
          </div>

          {demoResetFeedback && (
            <div
              className={`relative z-10 mt-4 rounded-xl border px-3 py-2 text-xs font-medium ${
                demoResetFeedback.tone === "success"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-[#FED7AA] bg-[#FFF1E6] text-[#7C2D12]"
              }`}
            >
              {demoResetFeedback.message}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 px-6">
        <div
          onClick={() => onNavigate("chat")}
          className="flex cursor-text items-center gap-3 rounded-2xl border border-nutty-border bg-nutty-card p-4 shadow-sm transition-colors hover:border-nutty-accent"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nutty-bg text-nutty-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-nutty-text-main">Describe a money action</p>
            <p className="text-xs text-nutty-text-muted">
              &quot;Pay my Unifi bill&quot; or &quot;Transfer RM50 to Ali&quot;
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-nutty-text-muted" />
        </div>

        <div>
          <h3 className="mb-3 px-1 text-sm font-bold text-nutty-text-main">Core Demo Paths</h3>
          <div className="grid gap-3">
            <FocusPathCard
              icon={<ArrowRightLeft />}
              title="Transfer with review"
              description="Run the main flow: natural-language transfer, server-side risk check, then Calm Mode if needed."
              onClick={() => onNavigate("chat")}
            />
            <FocusPathCard
              icon={<Wallet />}
              title="What-if before spending"
              description="Check the remaining buffer before committing to a new spend."
              onClick={scrollToSimulator}
            />
            <FocusPathCard
              icon={<ScrollText />}
              title="Policy context"
              description="Show the rule-backed context that explains why Nutty pauses risky money movement."
              onClick={() => onNavigate("transactions")}
            />
          </div>
        </div>

        <Card className="overflow-hidden border-none bg-nutty-card shadow-sm">
          <div className="border-b border-nutty-border bg-nutty-bg p-5">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#C2410C]" />
              <h3 className="text-sm font-bold text-nutty-text-main">Intervention Controls</h3>
            </div>
            <p className="text-xs text-nutty-text-muted">
              Choose how early Nutty steps in before risky money movement.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-nutty-text-muted">
                Decision intervention profile
              </p>
              <div className="grid grid-cols-3 gap-2">
                <SettingChip
                  label="Conservative"
                  active={riskProfile === "conservative"}
                  onClick={() => onRiskProfileChange("conservative")}
                />
                <SettingChip
                  label="Balanced"
                  active={riskProfile === "balanced"}
                  onClick={() => onRiskProfileChange("balanced")}
                />
                <SettingChip
                  label="Flexible"
                  active={riskProfile === "flexible"}
                  onClick={() => onRiskProfileChange("flexible")}
                />
              </div>
              <p className="mt-2 text-xs text-nutty-text-muted">{riskProfileDescriptions[riskProfile]}</p>
            </div>

            <div className="rounded-xl border border-dashed border-[#FDBA74] bg-[#FFF7ED] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9A3412]">
                    Demo controls
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#9A3412]">
                    {demoState?.hasPersistentData
                      ? demoState.explanation
                      : `Reset back to the seeded RM ${baselineBalance.toFixed(2)} baseline before judging or after a transfer demo.`}
                  </p>
                </div>
                <button
                  onClick={handleDemoReset}
                  disabled={isResettingDemo}
                  className="shrink-0 rounded-lg border border-[#FDBA74] bg-white px-3 py-2 text-xs font-semibold text-[#9A3412] transition-colors hover:bg-[#FFF1E6] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResettingDemo ? "Resetting..." : "Reset demo"}
                </button>
              </div>
              {demoState?.lastResetAt && (
                <p className="mt-3 text-[11px] text-[#B45309]">
                  Last reset: {new Date(demoState.lastResetAt).toLocaleString("en-MY")}
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Type className="h-4 w-4 text-nutty-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-nutty-text-muted">
                  Accessibility
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SettingChip
                  label="Standard"
                  active={textScale === "standard"}
                  onClick={() => onTextScaleChange("standard")}
                />
                <SettingChip
                  label="Large"
                  active={textScale === "large"}
                  onClick={() => onTextScaleChange("large")}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card ref={simulatorSectionRef} className="overflow-hidden border-none bg-nutty-card shadow-sm">
          <div className="border-b border-nutty-border bg-nutty-bg p-5">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-nutty-primary" />
              <h3 className="text-sm font-bold text-nutty-text-main">What-If Simulator</h3>
            </div>
            <p className="text-xs text-nutty-text-muted">
              Check your remaining buffer before you commit to a new spend.
            </p>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-nutty-text-muted">
                Planned Purchase (RM)
              </label>
              <Input
                type="number"
                placeholder="e.g. 350"
                value={simulatorAmount}
                onChange={(event) => setSimulatorAmount(event.target.value)}
                className="border-transparent bg-nutty-bg focus-visible:ring-nutty-primary"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-nutty-text-muted">Current Balance</span>
                <span className="font-medium text-nutty-text-main">
                  RM {dashboard.currentBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-nutty-text-muted">Upcoming Bills</span>
                <span className="font-medium text-[#8B4513]">
                  - RM {dashboard.upcomingBills.toFixed(2)}
                </span>
              </div>
              <div className="my-2 h-px bg-nutty-border"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-nutty-text-main">Estimated left before action</span>
                <span
                  className={`text-lg font-bold ${
                    simulatedBalance < 500 ? "text-[#92400E]" : "text-nutty-safe"
                  }`}
                >
                  RM {simulatedBalance.toFixed(2)}
                </span>
              </div>
            </div>

            {simulatedBalance < 500 && simulatorAmount && (
              <div className="mt-4 rounded-xl border border-nutty-warning-border bg-nutty-warning-bg p-3">
                <p className="text-xs text-[#78350F]">
                  <span className="font-semibold">Nutty says:</span> This leaves less room for bills
                  and essentials. Consider pausing before you commit to this spend.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FocusPathCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border border-nutty-border bg-nutty-card p-4 text-left shadow-sm transition-colors hover:border-nutty-accent hover:bg-white"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-nutty-bg text-nutty-primary">
        {React.cloneElement(icon as React.ReactElement, { className: "h-5 w-5" })}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-nutty-text-main">{title}</p>
        <p className="mt-1 text-xs leading-5 text-nutty-text-muted">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-nutty-text-muted" />
    </button>
  );
}

function SettingChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-nutty-primary bg-nutty-primary text-white"
          : "border-nutty-border bg-nutty-bg text-nutty-text-main hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
