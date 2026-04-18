import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, ShieldAlert, CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AssistantResponse,
  PolicyCitation,
  RiskProfileId,
  RiskPrompt,
  RiskRuleHit,
  TransferResolutionEvent,
} from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    type: "transfer";
    data: {
      recipient: string;
      amount: number;
      status: "requires_confirmation" | "completed";
      reasons: string[];
      ruleHits: RiskRuleHit[];
      citations: PolicyCitation[];
      policySummary: string;
      riskLogId: string | null;
      appliedProfile: RiskProfileId;
    };
  };
};

function createAssistantMessage(response: AssistantResponse): Message {
  return {
    id: Date.now().toString(),
    role: "assistant",
    content: response.reply,
    action:
      response.intent === "transfer_money" && response.actionCard
        ? {
            type: "transfer",
            data: {
              recipient: response.actionCard.recipient,
              amount: response.actionCard.amount,
              status: response.status === "requires_confirmation" ? "requires_confirmation" : "completed",
              reasons: response.calmMode?.reasons ?? [],
              ruleHits: response.calmMode?.ruleHits ?? [],
              citations: response.calmMode?.citations ?? [],
              policySummary: response.calmMode?.policySummary ?? "",
              riskLogId: response.calmMode?.riskLogId ?? null,
              appliedProfile: response.calmMode?.appliedProfile ?? "balanced",
            },
          }
        : undefined,
  };
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

export default function ChatView({
  onRiskTrigger,
  transferEvent,
  riskProfile,
}: {
  onRiskTrigger: (riskPrompt: RiskPrompt) => void;
  transferEvent: TransferResolutionEvent | null;
  riskProfile: RiskProfileId;
}) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi Alex! I'm Nutty. How can I help you with your money today?",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!transferEvent) {
      return;
    }

    setMessages((previousMessages) => [
      ...previousMessages,
      createAssistantMessage(transferEvent.response),
    ]);
  }, [transferEvent]);

  const handleAssistantResponse = (response: AssistantResponse) => {
    setMessages((previousMessages) => [...previousMessages, createAssistantMessage(response)]);

    if (response.status === "requires_confirmation" && response.calmMode && response.confirmation) {
      onRiskTrigger({
        amount: response.confirmation.amount,
        recipient: response.confirmation.recipient,
        reasons: response.calmMode.reasons,
        ruleHits: response.calmMode.ruleHits,
        citations: response.calmMode.citations,
        policySummary: response.calmMode.policySummary,
        riskLogId: response.calmMode.riskLogId,
        appliedProfile: response.calmMode.appliedProfile,
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((previousMessages) => [...previousMessages, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const assistantResponse = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          riskProfile,
        }),
      });

      const payload = (await assistantResponse.json()) as AssistantResponse;
      handleAssistantResponse(payload);
    } catch {
      handleAssistantResponse({
        reply: "Nutty hit a network problem. Please try again in a moment.",
        intent: "unknown",
        status: "error",
        actionCard: null,
        calmMode: null,
        confirmation: null,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#FAF9F6]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-nutty-border bg-nutty-card/80 px-6 py-4 backdrop-blur-md">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-nutty-accent text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-nutty-text-main">Nutty</h2>
          <p className="text-xs font-medium text-nutty-safe">
            {isSending ? "Checking..." : `${getRiskProfileLabel(riskProfile)} profile active`}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "flex max-w-[85%] flex-col gap-2",
                message.role === "user" ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm",
                  message.role === "user"
                    ? "rounded-tr-sm bg-nutty-primary text-white"
                    : "rounded-tl-sm border border-nutty-border bg-nutty-card text-nutty-text-main",
                )}
              >
                {message.content}
              </div>

              {message.action?.type === "transfer" && (
                <div className="mt-1 w-full animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <div className="w-full max-w-[280px] rounded-2xl border border-nutty-border bg-nutty-card p-4 shadow-sm">
                    <p className="mb-1 text-xs text-nutty-text-muted">Transfer to</p>
                    <p className="mb-2 text-sm font-medium text-nutty-text-main">
                      {message.action.data.recipient}
                    </p>
                    <p className="mb-4 text-2xl font-bold text-nutty-text-main">
                      RM {message.action.data.amount.toFixed(2)}
                    </p>

                    {message.action.data.status === "requires_confirmation" ? (
                      <Button
                        variant="destructive"
                        className="flex h-10 w-full gap-2 rounded-xl"
                        onClick={() =>
                          onRiskTrigger({
                            amount: message.action!.data.amount,
                            recipient: message.action!.data.recipient,
                            reasons: message.action!.data.reasons,
                            ruleHits: message.action!.data.ruleHits,
                            citations: message.action!.data.citations,
                            policySummary: message.action!.data.policySummary,
                            riskLogId: message.action!.data.riskLogId,
                            appliedProfile: message.action!.data.appliedProfile,
                          })
                        }
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Review Calm Mode
                      </Button>
                    ) : (
                      <Button className="flex h-10 w-full gap-2 rounded-xl" disabled>
                        <CheckCircle2 className="h-4 w-4" />
                        Transfer Completed
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-nutty-border bg-nutty-card p-4">
        <div className="flex items-center gap-2 rounded-full border border-nutty-border bg-nutty-bg p-1 pr-2 transition-all focus-within:border-nutty-accent focus-within:ring-2 focus-within:ring-nutty-bg">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
            placeholder="Type your request..."
            className="h-12 border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
          >
            <Send className="ml-0.5 h-4 w-4" />
          </Button>
        </div>
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <SuggestionBadge text="Pay Unifi bill" onClick={() => setInput("Pay my Unifi bill")} />
          <SuggestionBadge text="Transfer RM50 to Ali" onClick={() => setInput("Transfer RM50 to Ali")} />
          <SuggestionBadge
            text="Transfer to Crypto"
            onClick={() => setInput("Transfer RM5000 to Crypto Exchange")}
          />
        </div>
      </div>
    </div>
  );
}

function SuggestionBadge({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="whitespace-nowrap rounded-full border border-nutty-border bg-nutty-card px-3 py-1.5 text-xs font-medium text-nutty-text-muted transition-colors hover:bg-nutty-bg"
    >
      {text}
    </button>
  );
}
