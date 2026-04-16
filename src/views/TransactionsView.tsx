import React, { useState } from "react";
import { Coffee, ShoppingBag, Zap, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const data = [
  { name: "Mon", spend: 45 },
  { name: "Tue", spend: 120 },
  { name: "Wed", spend: 35 },
  { name: "Thu", spend: 80 },
  { name: "Fri", spend: 210 },
  { name: "Sat", spend: 150 },
  { name: "Sun", spend: 90 },
];

const transactions = [
  { id: 1, title: "Starbucks", category: "Food & Dining", amount: -18.50, date: "Today, 9:41 AM", icon: <Coffee className="w-4 h-4" />, color: "bg-nutty-warning-bg text-[#8B4513]" },
  { id: 2, title: "Unifi Broadband", category: "Bills", amount: -159.00, date: "Yesterday", icon: <Zap className="w-4 h-4" />, color: "bg-nutty-bg text-nutty-primary" },
  { id: 3, title: "Salary", category: "Income", amount: 4500.00, date: "Oct 1", icon: <ArrowDownLeft className="w-4 h-4" />, color: "bg-[#E8F0E8] text-nutty-safe", isIncome: true },
  { id: 4, title: "Shopee", category: "Shopping", amount: -124.30, date: "Sep 28", icon: <ShoppingBag className="w-4 h-4" />, color: "bg-nutty-bg text-nutty-secondary" },
];

export default function TransactionsView() {
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expenses">("all");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-nutty-bg pb-8">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-nutty-text-main mb-1">Spending</h1>
        <p className="text-sm text-nutty-text-muted">This week</p>
      </div>

      {/* Chart Area */}
      <div className="px-6 mb-8">
        <div className="bg-nutty-card rounded-3xl p-5 border border-nutty-border">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-xs font-medium text-nutty-text-muted mb-1">Total Spent</p>
              <p className="text-3xl font-bold text-nutty-text-main">RM 730.00</p>
            </div>
            <div className="bg-nutty-bg px-2 py-1 rounded-lg text-xs font-medium text-nutty-text-muted border border-nutty-border shadow-sm">
              Oct 1 - 7
            </div>
          </div>
          
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B6B61' }} 
                  dy={10}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-nutty-primary text-white text-xs font-medium px-2 py-1 rounded-lg shadow-xl">
                          RM {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="spend" radius={[4, 4, 4, 4]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.spend > 150 ? '#4A4A32' : '#A3A380'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-nutty-text-main">Recent</h3>
          <div className="flex gap-2 bg-nutty-border p-1 rounded-xl">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>All</TabButton>
            <TabButton active={activeTab === "expenses"} onClick={() => setActiveTab("expenses")}>Out</TabButton>
            <TabButton active={activeTab === "income"} onClick={() => setActiveTab("income")}>In</TabButton>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {transactions
            .filter(t => {
              if (activeTab === "income") return t.isIncome;
              if (activeTab === "expenses") return !t.isIncome;
              return true;
            })
            .map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-nutty-card rounded-2xl transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.color}`}>
                  {tx.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-nutty-text-main">{tx.title}</p>
                  <p className="text-xs text-nutty-text-muted">{tx.date} • {tx.category}</p>
                </div>
              </div>
              <p className={`text-sm font-bold ${tx.isIncome ? 'text-nutty-safe' : 'text-nutty-text-main'}`}>
                {tx.isIncome ? '+' : ''}{tx.amount > 0 ? tx.amount.toFixed(2) : Math.abs(tx.amount).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
        active ? 'bg-nutty-card text-nutty-text-main shadow-sm' : 'text-nutty-text-muted hover:text-nutty-text-main'
      }`}
    >
      {children}
    </button>
  );
}
