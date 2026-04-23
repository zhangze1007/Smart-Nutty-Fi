import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  Coffee,
  ExternalLink,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Zap,
} from "lucide-react";

import type { AppTransaction } from "@/data/mockTransactions";
import {
  getCachedDashboardData,
  getCachedPolicyContextData,
  revalidateDashboardData,
  revalidatePolicyContextData,
  subscribeDashboardData,
  subscribePolicyContextData,
} from "@/lib/dataProvider";
import type { PolicyContextData, RiskTriggerReason } from "@/lib/types";

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

const triggerReasonLabels: Record<RiskTriggerReason, string> = {
  first_time_payee: "Recipient not previously verified",
  high_amount: "High-value transfer",
  thin_buffer: "Thin cash buffer",
  suspicious_destination: "Suspicious destination category",
};

function formatRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function TransactionsView() {
  const [transactions, setTransactions] = useState<AppTransaction[]>(
    () => getCachedDashboardData().transactions,
  );
  const [policyContext, setPolicyContext] = useState<PolicyContextData | null>(
    () => getCachedPolicyContextData(),
  );

  useEffect(() => {
    let isMounted = true;
    const unsubscribeDashboard = subscribeDashboardData((nextDashboard) => {
      if (isMounted) {
        setTransactions(nextDashboard.transactions);
      }
    });
    const unsubscribePolicyContext = subscribePolicyContextData((nextPolicyContext) => {
      if (isMounted) {
        setPolicyContext(nextPolicyContext);
      }
    });

    Promise.all([revalidateDashboardData(), revalidatePolicyContextData()])
      .then(([dashboardData, nextPolicyContext]) => {
        if (!isMounted) {
          return;
        }

        setTransactions(dashboardData.transactions);
        setPolicyContext(nextPolicyContext);
      })
      .catch(() => {
        // Keep fallback data if runtime policy context is unavailable.
      });

    return () => {
      isMounted = false;
      unsubscribeDashboard();
      unsubscribePolicyContext();
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
            risk profile, and explains the checkpoint with Malaysia-specific public reference context before money moves.
          </p>
        </div>

        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C2410C]" />
            <h2 className="text-sm font-bold text-nutty-text-main">Pilot outcome metrics</h2>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-nutty-text-muted">
                Interventions
              </p>
              <p className="mt-2 text-lg font-bold text-nutty-text-main">
                {policyContext?.interventionMetrics.interventionCount ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-nutty-text-muted">
                Pause rate
              </p>
              <p className="mt-2 text-lg font-bold text-[#9A3412]">
                {formatRate(policyContext?.interventionMetrics.pauseRate ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-nutty-text-muted">
                Continue rate
              </p>
              <p className="mt-2 text-lg font-bold text-nutty-safe">
                {formatRate(policyContext?.interventionMetrics.continueRate ?? 0)}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9A3412]">
              Top trigger reasons
            </p>
            {policyContext?.interventionMetrics.topTriggerReasons.length ? (
              <div className="flex flex-col gap-2">
                {policyContext.interventionMetrics.topTriggerReasons.map((triggerReason) => (
                  <div
                    key={triggerReason.reason}
                    className="flex items-center justify-between rounded-xl border border-nutty-border bg-white px-3 py-2"
                  >
                    <span className="text-xs font-medium text-nutty-text-main">
                      {triggerReasonLabels[triggerReason.reason]}
                    </span>
                    <span className="text-xs font-bold text-[#9A3412]">{triggerReason.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-nutty-text-muted">
                Trigger a Calm Mode review to populate behavioural outcome metrics.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-nutty-primary" />
            <h2 className="text-sm font-bold text-nutty-text-main">Latest Calm Mode evidence</h2>
          </div>
          {policyContext?.latestTriggeredReview ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-4">
                <p className="text-sm font-semibold text-nutty-text-main">
                  RM {policyContext.latestTriggeredReview.amount.toFixed(2)} to{" "}
                  {policyContext.latestTriggeredReview.recipient}
                </p>
                <p className="mt-1 text-xs leading-5 text-nutty-text-muted">
                  Logged from the latest live Calm Mode trigger under the{" "}
                  {policyContext.latestTriggeredReview.riskProfile} profile on{" "}
                  {new Date(policyContext.latestTriggeredReview.createdAt).toLocaleString("en-MY")}.
                </p>
              </div>

              <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9A3412]">
                  Rule hits
                </p>
                <div className="flex flex-col gap-3">
                  {policyContext.latestTriggeredReview.ruleHits.map((ruleHit) => (
                    <div key={ruleHit.code} className="rounded-xl border border-nutty-border bg-white p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-nutty-text-main">{ruleHit.title}</p>
                        <span className="rounded-full bg-[#FFF1E6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9A3412]">
                          {ruleHit.severity}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-nutty-text-muted">{ruleHit.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-nutty-border bg-nutty-bg p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9A3412]">
                  Malaysia policy summary used in Calm Mode
                </p>
                <p className="text-sm leading-6 text-nutty-text-main">
                  {policyContext.latestTriggeredReview.policySummary}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {policyContext.latestTriggeredReview.citations.map((citation) => (
                    <a
                      key={citation.url}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-nutty-border bg-white px-3 py-2 text-left text-xs font-medium text-nutty-text-main transition-colors hover:bg-nutty-bg"
                    >
                      <span>
                        {citation.title} • {citation.source}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-nutty-text-muted" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-nutty-border bg-nutty-bg p-4">
              <p className="text-sm text-nutty-text-main">
                No live Calm Mode review is logged in this demo state yet.
              </p>
              <p className="mt-1 text-xs leading-5 text-nutty-text-muted">
                Trigger a risky transfer to populate this section with real rule hits and citations from a live Calm Mode event.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-nutty-primary" />
            <h2 className="text-sm font-bold text-nutty-text-main">Active Malaysia policy references</h2>
          </div>
          <p className="mb-4 text-xs uppercase tracking-wide text-[#9A3412]">
            {policyContext ? `Current runtime source: ${policyContext.source}` : "Runtime source unavailable"}
          </p>
          <div className="flex flex-col gap-3">
            {policyContext?.documents.map((document) => (
              <a
                key={document.id}
                href={document.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-nutty-border bg-nutty-bg p-4 transition-colors hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-nutty-text-main">{document.title}</p>
                    <p className="mt-1 text-xs leading-5 text-nutty-text-muted">{document.summary}</p>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#B45309]">
                      {document.source} • {document.jurisdiction}
                    </p>
                  </div>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-nutty-text-muted" />
                </div>
              </a>
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
