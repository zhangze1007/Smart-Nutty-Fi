import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  Coffee,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Zap,
} from "lucide-react";

import {
  createMockDashboardData,
  mockPolicyGuidelines,
  type AppTransaction,
} from "@/data/mockTransactions";
import { getTransactionsData } from "@/lib/dataProvider";

const fallbackDashboard = createMockDashboardData();

const iconMap = {
  coffee: <Coffee className="h-4 w-4" />,
  bill: <Zap className="h-4 w-4" />,
  income: <ArrowDownLeft className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
  transfer: <ArrowRightLeft className="h-4 w-4" />,
};

const colorMap = {
  warning: "bg-nutty-warning-bg text-[#8B4513]",
  primary: "bg-nutty-bg text-nutty-primary",
  safe: "bg-[#E8F0E8] text-nutty-safe",
  secondary: "bg-nutty-bg text-nutty-secondary",
};

const profileSummary = [
  {
    label: "Conservative",
    description: "Earlier checkpoints for first-time or higher-risk transfers.",
  },
  {
    label: "Balanced",
    description: "Recommended demo default with strong review on risky money movement.",
  },
  {
    label: "Flexible",
    description: "Later checkpoints unless the transfer still looks clearly unsafe.",
  },
];

export default function TransactionsView() {
  const [transactions, setTransactions] = useState<AppTransaction[]>(fallbackDashboard.transactions);

  useEffect(() => {
    let isMounted = true;

    getTransactionsData()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setTransactions(data.transactions);
      })
      .catch(() => {
        // Keep mock fallback data.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-nutty-bg pb-8">
      <div className="px-6 pb-4 pt-12">
        <h1 className="mb-1 text-2xl font-bold text-nutty-text-main">Policy Context</h1>
        <p className="text-sm text-nutty-text-muted">
          Why Nutty opens a review checkpoint before risky money movement.
        </p>
      </div>

      <div className="flex flex-col gap-5 px-6">
        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C2410C]" />
            <h2 className="text-sm font-bold text-nutty-text-main">How Nutty decides</h2>
          </div>
          <p className="text-sm leading-6 text-nutty-text-main">
            Nutty is not a banner warning. It runs a server-side transfer review, checks the active
            risk profile, and explains the checkpoint with policy-backed context before money moves.
          </p>
        </div>

        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-nutty-primary" />
            <h2 className="text-sm font-bold text-nutty-text-main">Calm Mode review pillars</h2>
          </div>
          <div className="flex flex-col gap-3">
            {mockPolicyGuidelines.map((guideline) => (
              <div
                key={guideline.title}
                className="rounded-2xl border border-nutty-border bg-nutty-bg p-4"
              >
                <p className="text-sm font-semibold text-nutty-text-main">{guideline.title}</p>
                <p className="mt-1 text-xs leading-5 text-nutty-text-muted">{guideline.summary}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#B45309]">
                  {guideline.reference}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-nutty-primary" />
            <h2 className="text-sm font-bold text-nutty-text-main">Risk profile effect</h2>
          </div>
          <div className="grid gap-3">
            {profileSummary.map((profile) => (
              <div
                key={profile.label}
                className="rounded-2xl border border-nutty-border bg-white px-4 py-3"
              >
                <p className="text-sm font-semibold text-nutty-text-main">{profile.label}</p>
                <p className="mt-1 text-xs leading-5 text-nutty-text-muted">
                  {profile.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-nutty-text-main">Recent money movement</h2>
              <p className="mt-1 text-xs text-nutty-text-muted">
                Supporting context for the live transfer demo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between rounded-2xl border border-transparent p-3 transition-colors hover:border-nutty-border hover:bg-nutty-bg"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      colorMap[transaction.colorKey]
                    }`}
                  >
                    {iconMap[transaction.iconKey]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-nutty-text-main">{transaction.title}</p>
                    <p className="text-xs text-nutty-text-muted">
                      {transaction.date} • {transaction.category}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-sm font-bold ${
                    transaction.isIncome ? "text-nutty-safe" : "text-nutty-text-main"
                  }`}
                >
                  {transaction.amount >= 0 ? "+" : "-"}RM {Math.abs(transaction.amount).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
