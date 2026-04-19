export type PolicyDocument = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  jurisdiction: string;
  summary: string;
  excerpt: string;
  topics: string[];
  keywords: string[];
};

export const policySeedDocuments: PolicyDocument[] = [
  {
    id: "bnm-amla-money-mule",
    title: "Bank Negara Malaysia Money Mule Education",
    source: "Bank Negara Malaysia Museum and Art Gallery",
    sourceUrl: "https://museum.bnm.gov.my/amla/Section3_1.html",
    jurisdiction: "Malaysia",
    summary:
      "Bank Negara Malaysia's AMLA education material says account holders should not receive or move funds for unknown third parties and should verify unusual transfer requests before acting.",
    excerpt:
      "Money mule examples include strangers asking an account holder to receive, move, or forward funds through their own bank or e-wallet account.",
    topics: ["money_mule", "scam_verification", "unknown_payee"],
    keywords: ["money mule", "third party", "unknown sender", "urgent transfer", "e-wallet"],
  },
  {
    id: "bnm-financial-consumer-alert",
    title: "Bank Negara Malaysia Financial Consumer Alert List",
    source: "Bank Negara Malaysia public alert list",
    sourceUrl: "https://www.bnm.gov.my/financial-consumer-alert-list",
    jurisdiction: "Malaysia",
    summary:
      "Bank Negara Malaysia maintains a public alert list that users can check when a suspicious entity, investment site, or payment destination may not be authorised.",
    excerpt:
      "Consumers are encouraged to verify suspicious entities or websites against the central bank's public alert resources before proceeding with a transaction.",
    topics: ["consumer_alert", "scam_verification", "unregulated_entity"],
    keywords: ["alert list", "unauthorised", "verify entity", "consumer alert", "website"],
  },
  {
    id: "bnm-financial-fraud-alert",
    title: "Bank Negara Malaysia Financial Fraud Alert",
    source: "Bank Negara Malaysia fraud alert material",
    sourceUrl: "https://www.bnm.gov.my/web/financial-fraud-alert",
    jurisdiction: "Malaysia",
    summary:
      "Bank Negara Malaysia fraud alerts tell customers to pause, verify unexpected instructions, and be careful when urgency is used to rush a transfer.",
    excerpt:
      "Fraud-prevention material emphasises pausing to review urgent or unusual payment instructions before money is transferred.",
    topics: ["scam_verification", "social_engineering", "urgent_transfer"],
    keywords: ["fraud alert", "urgent", "pause", "verify", "scam"],
  },
  {
    id: "malaysia-act-613-amla",
    title: "Malaysia Act 613 AMLA Reference",
    source: "Attorney General's Chambers of Malaysia",
    sourceUrl:
      "https://lom.agc.gov.my/ilims/upload/portal/akta/outputaktap/1719599_BI/010722_Act%20613_final.pdf",
    jurisdiction: "Malaysia",
    summary:
      "Act 613 is Malaysia's anti-money laundering framework and provides background context for suspicious or unlawful movement of funds.",
    excerpt:
      "The Act is part of Malaysia's legal framework against unlawful movement or concealment of funds.",
    topics: ["aml_reporting", "financial_crime", "suspicious_activity"],
    keywords: ["act 613", "money laundering", "terrorism financing", "reporting obligations"],
  },
];
