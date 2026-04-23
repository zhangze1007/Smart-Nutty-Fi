import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, ShieldAlert, CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AssistantResponse,
  PolicyCitation,
  RecipientAssurance,
  RiskProfileId,
  RiskPrompt,
  RiskRuleHit,
  RiskTriggerFlags,
  RiskTriggerReason,
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
        severity: "medium" | "high";
        reasons: string[];
        ruleHits: RiskRuleHit[];
        citations: PolicyCitation[];
        policySummary: string;
      riskLogId: string | null;
      appliedProfile: RiskProfileId;
      triggerFlags: RiskTriggerFlags;
      triggerReasons: RiskTriggerReason[];
      recipientAssurance: RecipientAssurance | null;
    };
  };
};

const emptyTriggerFlags: RiskTriggerFlags = {
  first_time_payee: false,
  high_amount: false,
  thin_buffer: false,
  suspicious_destination: false,
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
              severity: response.calmMode?.severity ?? "medium",
              reasons: response.calmMode?.reasons ?? [],
              ruleHits: response.calmMode?.ruleHits ?? [],
              citations: response.calmMode?.citations ?? [],
              policySummary: response.calmMode?.policySummary ?? "",
              riskLogId: response.calmMode?.riskLogId ?? null,
              appliedProfile: response.calmMode?.appliedProfile ?? "balanced",
              triggerFlags: response.calmMode?.triggerFlags ?? emptyTriggerFlags,
              triggerReasons: response.calmMode?.triggerReasons ?? [],
              recipientAssurance: response.calmMode?.recipientAssurance ?? null,
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
  onTransferEventConsumed,
  riskProfile,
  onTransferCompleted,
}: {
  onRiskTrigger: (riskPrompt: RiskPrompt) => void;
  transferEvent: TransferResolutionEvent | null;
  onTransferEventConsumed: () => void;
  riskProfile: RiskProfileId;
  onTransferCompleted: (response: AssistantResponse) => void;
}) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi Alex! Tell me the money action you want to take. I can help slow down a risky transfer, review a bill request, or check if a spend still leaves enough for bills.",
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
    onTransferEventConsumed();
  }, [onTransferEventConsumed, transferEvent]);

  const handleAssistantResponse = (response: AssistantResponse) => {
    setMessages((previousMessages) => [...previousMessages, createAssistantMessage(response)]);
    onTransferCompleted(response);

    if (response.status === "requires_confirmation" && response.calmMode && response.confirmation) {
      onRiskTrigger({
        amount: response.confirmation.amount,
        recipient: response.confirmation.recipient,
        severity: response.calmMode.severity,
        reasons: response.calmMode.reasons,
        ruleHits: response.calmMode.ruleHits,
        citations: response.calmMode.citations,
        policySummary: response.calmMode.policySummary,
        riskLogId: response.calmMode.riskLogId,
        appliedProfile: response.calmMode.appliedProfile,
        triggerFlags: response.calmMode.triggerFlags,
        triggerReasons: response.calmMode.triggerReasons,
        recipientAssurance: response.calmMode.recipientAssurance,
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
            {isSending ? "Checking for action and risk..." : `${getRiskProfileLabel(riskProfile)} intervention profile active`}
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
                    <p className="mb-1 text-xs text-nutty-text-muted">Transfer request</p>
                    {message.action.data.status === "requires_confirmation" && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#FFF1E6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#9A3412]">
                          Decision checkpoint
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                            message.action.data.severity === "high"
                              ? "bg-[#FEE2E2] text-[#B91C1C]"
                              : "bg-[#FEF3C7] text-[#B45309]",
                          )}
                        >
                          {message.action.data.severity === "high"
                            ? "High-risk review"
                            : "Review recommended"}
                        </span>
                      </div>
                    )}
                    <p className="mb-2 text-sm font-medium text-nutty-text-main">
                      {message.action.data.recipient}
                    </p>
                    <p className="mb-4 text-2xl font-bold text-nutty-text-main">
                      RM {message.action.data.amount.toFixed(2)}
                    </p>

                    {message.action.data.status === "requires_confirmation" &&
                      message.action.data.recipientAssurance && (
                        <div className="mb-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2">
                          <p className="text-xs font-semibold text-[#7C2D12]">
                            {message.action.data.recipientAssurance.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-[#9A3412]">
                            {message.action.data.recipientAssurance.guidance}
                          </p>
                        </div>
                      )}

                    {message.action.data.status === "requires_confirmation" ? (
                      <Button
                        variant="destructive"
                        className="flex h-10 w-full gap-2 rounded-xl"
                        onClick={() =>
                          onRiskTrigger({
                            amount: message.action!.data.amount,
                            recipient: message.action!.data.recipient,
                            severity: message.action!.data.severity,
                            reasons: message.action!.data.reasons,
                            ruleHits: message.action!.data.ruleHits,
                            citations: message.action!.data.citations,
                            policySummary: message.action!.data.policySummary,
                            riskLogId: message.action!.data.riskLogId,
                            appliedProfile: message.action!.data.appliedProfile,
                            triggerFlags: message.action!.data.triggerFlags,
                            triggerReasons: message.action!.data.triggerReasons,
                            recipientAssurance: message.action!.data.recipientAssurance!,
                          })
                        }
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Open Calm Mode review
                      </Button>
                    ) : (
                      <Button className="flex h-10 w-full gap-2 rounded-xl" disabled>
                        <CheckCircle2 className="h-4 w-4" />
                        Money moved
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
            placeholder="Describe a transfer, bill review, or affordability check..."
            className="h-12 border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full p-0"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <SuggestionBadge text="Transfer RM50 to Ali" onClick={() => setInput("Transfer RM50 to Ali")} />
          <SuggestionBadge
            text="Check monthly buffer"
            onClick={() => setInput("Can I afford RM480 after bills?")}
          />
          <SuggestionBadge
            text="Review first-time payee"
            onClick={() => setInput("Transfer RM350 to New Seller")}
          />
          <SuggestionBadge
            text="Review crypto transfer"
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
