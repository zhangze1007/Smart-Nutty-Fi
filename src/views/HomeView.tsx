import React, { useState } from "react";
import { ArrowRightLeft, CreditCard, Wallet, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function HomeView({ onNavigate, onRiskTrigger }: { onNavigate: (view: "home" | "chat" | "transactions") => void, onRiskTrigger: (amount: number, recipient: string, reason: string) => void }) {
  const [simulatorAmount, setSimulatorAmount] = useState<string>("");
  const currentBalance = 4250.00;
  const upcomingBills = 850.00;

  const simulatedBalance = currentBalance - upcomingBills - (parseFloat(simulatorAmount) || 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-nutty-bg pb-8">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 bg-nutty-card rounded-b-[2.5rem] shadow-sm mb-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-medium text-nutty-text-muted mb-1">Good morning, Alex</p>
            <h1 className="text-2xl font-bold text-nutty-text-main">Nutty-Fi</h1>
          </div>
          <div className="w-10 h-10 bg-nutty-accent text-white rounded-full flex items-center justify-center font-bold">
            A
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-nutty-primary rounded-[2rem] p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-nutty-accent/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-nutty-secondary/20 rounded-full blur-2xl -ml-10 -mb-10"></div>
          
          <p className="text-white/80 text-sm mb-2 relative z-10">Total Balance</p>
          <h2 className="text-4xl font-bold mb-6 relative z-10">RM 4,250.00</h2>
          
          <div className="flex gap-4 relative z-10">
            <button className="flex-1 bg-white/10 hover:bg-white/20 transition-colors rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium backdrop-blur-sm">
              <ArrowRightLeft className="w-4 h-4" />
              Transfer
            </button>
            <button className="flex-1 bg-nutty-card text-nutty-text-main hover:bg-nutty-bg transition-colors rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium">
              <CreditCard className="w-4 h-4" />
              Pay Bill
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 flex flex-col gap-6">
        {/* Ask Nutty Input */}
        <div 
          onClick={() => onNavigate("chat")}
          className="bg-nutty-card rounded-2xl p-4 shadow-sm border border-nutty-border flex items-center gap-3 cursor-text hover:border-nutty-accent transition-colors"
        >
          <div className="w-10 h-10 bg-nutty-bg rounded-xl flex items-center justify-center text-nutty-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-nutty-text-main">Ask Nutty...</p>
            <p className="text-xs text-nutty-text-muted">"Pay my Unifi bill" or "Transfer RM50"</p>
          </div>
          <ArrowRight className="w-5 h-5 text-nutty-text-muted" />
        </div>

        {/* Quick Actions Grid */}
        <div>
          <h3 className="text-sm font-bold text-nutty-text-main mb-3 px-1">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            <QuickAction icon={<Wallet />} label="Top Up" />
            <QuickAction icon={<ArrowRightLeft />} label="Transfer" onClick={() => onRiskTrigger(5000, "Unknown Crypto Exchange", "This recipient was recently flagged for suspicious activity. Are you sure you want to proceed?")} />
            <QuickAction icon={<CreditCard />} label="Bills" />
            <QuickAction icon={<TrendingDown />} label="Spending" onClick={() => onNavigate("transactions")} />
          </div>
        </div>

        {/* What-If Simulator */}
        <Card className="border-none shadow-sm bg-nutty-card rounded-3xl overflow-hidden">
          <div className="p-5 bg-nutty-bg border-b border-nutty-border">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-nutty-primary" />
              <h3 className="text-sm font-bold text-nutty-text-main">What-If Simulator</h3>
            </div>
            <p className="text-xs text-nutty-text-muted">See how a purchase affects your month.</p>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <label className="text-xs font-medium text-nutty-text-muted mb-1.5 block">Planned Purchase (RM)</label>
              <Input 
                type="number" 
                placeholder="e.g. 350" 
                value={simulatorAmount}
                onChange={(e) => setSimulatorAmount(e.target.value)}
                className="bg-nutty-bg border-transparent focus-visible:ring-nutty-primary"
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-nutty-text-muted">Current Balance</span>
                <span className="font-medium text-nutty-text-main">RM {currentBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-nutty-text-muted">Upcoming Bills</span>
                <span className="font-medium text-[#8B4513]">- RM {upcomingBills.toFixed(2)}</span>
              </div>
              <div className="h-px bg-nutty-border my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-nutty-text-main">Estimated Left</span>
                <span className={`text-lg font-bold ${simulatedBalance < 500 ? 'text-[#92400E]' : 'text-nutty-safe'}`}>
                  RM {simulatedBalance.toFixed(2)}
                </span>
              </div>
            </div>
            
            {simulatedBalance < 500 && simulatorAmount && (
              <div className="mt-4 p-3 bg-nutty-warning-bg rounded-xl border border-nutty-warning-border">
                <p className="text-xs text-[#78350F]">
                  <span className="font-semibold">Nutty says:</span> This leaves you a bit tight for the rest of the month. Consider delaying this purchase.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2"
    >
      <div className="w-14 h-14 bg-nutty-card rounded-2xl shadow-sm border border-nutty-border flex items-center justify-center text-nutty-text-muted hover:bg-nutty-bg hover:text-nutty-primary transition-colors">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <span className="text-xs font-medium text-nutty-text-muted">{label}</span>
    </button>
  );
}
