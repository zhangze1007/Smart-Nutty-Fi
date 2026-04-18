import React, { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  CreditCard,
  Wallet,
  TrendingDown,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Type,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createMockDashboardData } from "@/data/mockTransactions";
import { getDashboardData } from "@/lib/dataProvider";
import type { RiskProfileId, TextScale } from "@/lib/types";

const riskProfileDescriptions: Record<RiskProfileId, string> = {
  conservative: "Lower review thresholds for extra caution around unfamiliar transfers.",
  balanced: "Recommended default for demo use: strong checks without interrupting every transfer.",
  flexible: "Higher review thresholds, while still pausing obvious scam or low-balance cases.",
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

  const simulatedBalance =
    dashboard.currentBalance - dashboard.upcomingBills - (parseFloat(simulatorAmount) || 0);

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

          <p className="relative z-10 mb-2 text-sm text-white/80">Total Balance</p>
          <h2 className="relative z-10 mb-4 text-4xl font-bold">
            RM {dashboard.currentBalance.toFixed(2)}
          </h2>
          <p className="relative z-10 mb-6 max-w-[18rem] text-sm text-white/85">
            From chat to action, with a safety pause before high-risk money movement.
          </p>

          <div className="relative z-10 flex gap-4">
            <button
              onClick={() => onNavigate("chat")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </button>
            <button
              onClick={() => onNavigate("chat")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-nutty-card py-3 text-sm font-medium text-nutty-text-main transition-colors hover:bg-nutty-bg"
            >
              <CreditCard className="h-4 w-4" />
              Pay Bill
            </button>
          </div>
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
            <p className="text-sm font-medium text-nutty-text-main">Ask Nutty...</p>
            <p className="text-xs text-nutty-text-muted">
              &quot;Pay my Unifi bill&quot; or &quot;Transfer RM50&quot;
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-nutty-text-muted" />
        </div>

        <div>
          <h3 className="mb-3 px-1 text-sm font-bold text-nutty-text-main">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            <QuickAction icon={<Wallet />} label="Top Up" />
            <QuickAction icon={<ArrowRightLeft />} label="Transfer" onClick={() => onNavigate("chat")} />
            <QuickAction icon={<CreditCard />} label="Bills" onClick={() => onNavigate("chat")} />
            <QuickAction icon={<TrendingDown />} label="Spending" onClick={() => onNavigate("transactions")} />
          </div>
        </div>

        <Card className="overflow-hidden border-none bg-nutty-card shadow-sm">
          <div className="border-b border-nutty-border bg-nutty-bg p-5">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#C2410C]" />
              <h3 className="text-sm font-bold text-nutty-text-main">Safety & Accessibility</h3>
            </div>
            <p className="text-xs text-nutty-text-muted">
              Lightweight controls for how strongly Nutty reviews risky transfers.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-nutty-text-muted">
                Risk reminder level
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

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Type className="h-4 w-4 text-nutty-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-nutty-text-muted">
                  Text size
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

        <Card className="overflow-hidden border-none bg-nutty-card shadow-sm">
          <div className="border-b border-nutty-border bg-nutty-bg p-5">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-nutty-primary" />
              <h3 className="text-sm font-bold text-nutty-text-main">What-If Simulator</h3>
            </div>
            <p className="text-xs text-nutty-text-muted">See how a purchase affects your month.</p>
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
                <span className="text-sm font-medium text-nutty-text-main">Estimated Left</span>
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
                  <span className="font-semibold">Nutty says:</span> This leaves you a bit tight for
                  the rest of the month. Consider delaying this purchase.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-nutty-border bg-nutty-card text-nutty-text-muted shadow-sm transition-colors hover:bg-nutty-bg hover:text-nutty-primary">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <span className="text-xs font-medium text-nutty-text-muted">{label}</span>
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
