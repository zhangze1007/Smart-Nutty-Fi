import React, { useEffect, useState } from "react";
import { Coffee, ShoppingBag, Zap, ArrowDownLeft, ArrowRightLeft } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { createMockDashboardData, type AppTransaction } from "@/data/mockTransactions";
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

export default function TransactionsView() {
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expenses">("all");
  const [transactions, setTransactions] = useState<AppTransaction[]>(fallbackDashboard.transactions);
  const [weeklySpending, setWeeklySpending] = useState(fallbackDashboard.weeklySpending);
  const [totalWeeklySpend, setTotalWeeklySpend] = useState(fallbackDashboard.totalWeeklySpend);
  const [periodLabel, setPeriodLabel] = useState(fallbackDashboard.periodLabel);

  useEffect(() => {
    let isMounted = true;

    getTransactionsData()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setTransactions(data.transactions);
        setWeeklySpending(data.weeklySpending);
        setTotalWeeklySpend(data.totalWeeklySpend);
        setPeriodLabel(data.periodLabel);
      })
      .catch(() => {
        // Keep mock fallback data.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
    if (activeTab === "income") {
      return transaction.isIncome;
    }

    if (activeTab === "expenses") {
      return !transaction.isIncome;
    }

    return true;
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-nutty-bg pb-8">
      <div className="px-6 pb-4 pt-12">
        <h1 className="mb-1 text-2xl font-bold text-nutty-text-main">Spending</h1>
        <p className="text-sm text-nutty-text-muted">This week</p>
      </div>

      <div className="mb-8 px-6">
        <div className="rounded-3xl border border-nutty-border bg-nutty-card p-5">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium text-nutty-text-muted">Total Spent</p>
              <p className="text-3xl font-bold text-nutty-text-main">
                RM {totalWeeklySpend.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-nutty-border bg-nutty-bg px-2 py-1 text-xs font-medium text-nutty-text-muted shadow-sm">
              {periodLabel}
            </div>
          </div>

          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySpending} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#6B6B61" }}
                  dy={10}
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg bg-nutty-primary px-2 py-1 text-xs font-medium text-white shadow-xl">
                          RM {payload[0].value}
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <Bar dataKey="spend" radius={[4, 4, 4, 4]}>
                  {weeklySpending.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.spend > 150 ? "#4A4A32" : "#A3A380"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-nutty-text-main">Recent</h3>
          <div className="flex gap-2 rounded-xl bg-nutty-border p-1">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
              All
            </TabButton>
            <TabButton active={activeTab === "expenses"} onClick={() => setActiveTab("expenses")}>
              Out
            </TabButton>
            <TabButton active={activeTab === "income"} onClick={() => setActiveTab("income")}>
              In
            </TabButton>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex cursor-pointer items-center justify-between rounded-2xl p-3 transition-colors hover:bg-nutty-card"
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
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
        active ? "bg-nutty-card text-nutty-text-main shadow-sm" : "text-nutty-text-muted hover:text-nutty-text-main"
      }`}
    >
      {children}
    </button>
  );
}
