import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, ArrowLeft, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    type: "transfer_confirm" | "bill_pay" | "insight";
    data: any;
  };
};

export default function ChatView({ onRiskTrigger }: { onRiskTrigger: (amount: number, recipient: string, reason: string) => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi Alex! I'm Nutty. How can I help you with your money today?",
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Simulate AI response based on keywords
    setTimeout(() => {
      const lowerInput = userMsg.content.toLowerCase();
      let aiMsg: Message;

      if (lowerInput.includes("unifi") || lowerInput.includes("bill")) {
        aiMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I found your upcoming Unifi bill. Would you like to pay it now?",
          action: {
            type: "bill_pay",
            data: { biller: "Unifi", amount: 159.00, dueDate: "Oct 15" }
          }
        };
      } else if (lowerInput.includes("transfer") && lowerInput.includes("crypto")) {
        // Trigger risk intervention directly or show a message that triggers it
        aiMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm setting up the transfer to the Crypto Exchange.",
          action: {
            type: "transfer_confirm",
            data: { recipient: "Unknown Crypto Exchange", amount: 5000, isRisky: true }
          }
        };
      } else if (lowerInput.includes("transfer") && lowerInput.includes("ali")) {
        aiMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Ready to transfer to Ali. Please confirm the details.",
          action: {
            type: "transfer_confirm",
            data: { recipient: "Ali bin Abu", amount: 50, isRisky: false }
          }
        };
      } else if (lowerInput.includes("spend") || lowerInput.includes("week")) {
        aiMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Here's a quick look at your spending this week. You're doing well, mostly spent on Food & Dining.",
          action: {
            type: "insight",
            data: { total: 420.50, topCategory: "Food & Dining" }
          }
        };
      } else {
        aiMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I can help you transfer money, pay bills, or check your spending. What would you like to do?",
        };
      }

      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F6]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-nutty-border flex items-center gap-3 bg-nutty-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="w-10 h-10 bg-nutty-accent text-white rounded-full flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-nutty-text-main">Nutty</h2>
          <p className="text-xs text-nutty-safe font-medium">Online</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex w-full",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[85%] flex flex-col gap-2",
              msg.role === "user" ? "items-end" : "items-start"
            )}>
              {/* Message Bubble */}
              <div className={cn(
                "px-4 py-3 rounded-2xl text-sm",
                msg.role === "user" 
                  ? "bg-nutty-primary text-white rounded-tr-sm" 
                  : "bg-nutty-card text-nutty-text-main border border-nutty-border rounded-tl-sm"
              )}>
                {msg.content}
              </div>

              {/* Action Cards */}
              {msg.action && (
                <div className="w-full mt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {msg.action.type === "bill_pay" && (
                    <div className="bg-nutty-card border border-nutty-border rounded-2xl p-4 shadow-sm w-full max-w-[280px]">
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-nutty-bg text-nutty-primary rounded-xl flex items-center justify-center font-bold">
                          U
                        </div>
                        <span className="text-xs font-medium text-[#8B4513] bg-nutty-warning-bg px-2 py-1 rounded-md">Due {msg.action.data.dueDate}</span>
                      </div>
                      <p className="text-sm font-medium text-nutty-text-main">{msg.action.data.biller}</p>
                      <p className="text-2xl font-bold text-nutty-text-main mb-4">RM {msg.action.data.amount.toFixed(2)}</p>
                      <Button className="w-full rounded-xl h-10">Pay Now</Button>
                    </div>
                  )}

                  {msg.action.type === "transfer_confirm" && (
                    <div className="bg-nutty-card border border-nutty-border rounded-2xl p-4 shadow-sm w-full max-w-[280px]">
                      <p className="text-xs text-nutty-text-muted mb-1">Transfer to</p>
                      <p className="text-sm font-medium text-nutty-text-main mb-2">{msg.action.data.recipient}</p>
                      <p className="text-2xl font-bold text-nutty-text-main mb-4">RM {msg.action.data.amount.toFixed(2)}</p>
                      
                      {msg.action.data.isRisky ? (
                        <Button 
                          variant="destructive" 
                          className="w-full rounded-xl h-10 flex gap-2"
                          onClick={() => onRiskTrigger(msg.action!.data.amount, msg.action!.data.recipient, "This recipient was recently flagged for suspicious activity. Are you sure you want to proceed?")}
                        >
                          <ShieldAlert className="w-4 h-4" />
                          Review Transfer
                        </Button>
                      ) : (
                        <Button className="w-full rounded-xl h-10 flex gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Transfer
                        </Button>
                      )}
                    </div>
                  )}

                  {msg.action.type === "insight" && (
                    <div className="bg-nutty-bg border border-nutty-border rounded-2xl p-4 shadow-sm w-full max-w-[280px]">
                      <p className="text-xs text-nutty-primary font-medium mb-1">This Week</p>
                      <p className="text-2xl font-bold text-nutty-text-main mb-2">RM {msg.action.data.total.toFixed(2)}</p>
                      <div className="bg-white/60 rounded-lg p-2 text-xs text-nutty-text-main">
                        Top category: <span className="font-semibold">{msg.action.data.topCategory}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-nutty-card border-t border-nutty-border">
        <div className="flex gap-2 items-center bg-nutty-bg rounded-full p-1 pr-2 border border-nutty-border focus-within:border-nutty-accent focus-within:ring-2 focus-within:ring-nutty-bg transition-all">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your request..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-12 px-4"
          />
          <Button 
            size="icon" 
            className="rounded-full h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide px-1">
          <SuggestionBadge text="Pay Unifi bill" onClick={() => setInput("Pay Unifi bill")} />
          <SuggestionBadge text="Transfer RM50 to Ali" onClick={() => setInput("Transfer RM50 to Ali")} />
          <SuggestionBadge text="Transfer to Crypto" onClick={() => setInput("Transfer RM5000 to Crypto Exchange")} />
        </div>
      </div>
    </div>
  );
}

function SuggestionBadge({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="whitespace-nowrap px-3 py-1.5 bg-nutty-card border border-nutty-border hover:bg-nutty-bg text-nutty-text-muted text-xs font-medium rounded-full transition-colors"
    >
      {text}
    </button>
  );
}
