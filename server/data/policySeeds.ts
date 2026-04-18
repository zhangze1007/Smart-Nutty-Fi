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
    title: "AMLA Education: Money Mule Edition",
    source: "Bank Negara Malaysia Museum and Art Gallery",
    sourceUrl: "https://museum.bnm.gov.my/amla/Section3_1.html",
    jurisdiction: "Malaysia",
    summary:
      "BNM's AMLA scam-awareness guidance warns users not to receive or transfer funds on behalf of unknown third parties and to be cautious with unusual payment requests.",
    excerpt:
      "Money mule scams often involve strangers asking the account holder to receive, move, or forward funds through their bank account.",
    topics: ["money_mule", "scam_verification", "unknown_payee"],
    keywords: ["money mule", "third party", "unknown sender", "urgent transfer", "verification"],
  },
  {
    id: "bnm-financial-consumer-alert",
    title: "Financial Consumer Alert List",
    source: "Bank Negara Malaysia",
    sourceUrl: "https://www.bnm.gov.my/financial-consumer-alert-list",
    jurisdiction: "Malaysia",
    summary:
      "BNM maintains a public alert list to help consumers identify entities that may not be authorised to offer financial products or services regulated by the central bank.",
    excerpt:
      "Consumers should verify suspicious entities or websites against BNM's public alert resources before proceeding with a transaction.",
    topics: ["consumer_alert", "scam_verification", "unregulated_entity"],
    keywords: ["alert list", "unauthorised", "verify entity", "consumer alert", "website"],
  },
  {
    id: "bnm-financial-fraud-alert",
    title: "Financial Fraud Alert",
    source: "Bank Negara Malaysia",
    sourceUrl: "https://www.bnm.gov.my/web/financial-fraud-alert",
    jurisdiction: "Malaysia",
    summary:
      "BNM's fraud alert materials encourage customers to pause, verify unusual instructions, and stay alert to scam tactics that pressure fast action.",
    excerpt:
      "Scam prevention guidance emphasises stopping to review urgent instructions and verifying suspicious requests before money is transferred.",
    topics: ["scam_verification", "social_engineering", "urgent_transfer"],
    keywords: ["fraud alert", "urgent", "pause", "verify", "scam"],
  },
  {
    id: "malaysia-act-613-amla",
    title:
      "Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 [Act 613]",
    source: "Laws of Malaysia / Attorney General's Chambers",
    sourceUrl:
      "https://lom.agc.gov.my/ilims/upload/portal/akta/outputaktap/1719599_BI/010722_Act%20613_final.pdf",
    jurisdiction: "Malaysia",
    summary:
      "Act 613 establishes the legal basis for preventing money laundering and terrorism financing, including reporting and enforcement obligations connected to suspicious activity.",
    excerpt:
      "Malaysia's AML framework is designed to prevent unlawful funds from being moved or disguised through the financial system.",
    topics: ["aml_reporting", "financial_crime", "suspicious_activity"],
    keywords: ["act 613", "money laundering", "terrorism financing", "reporting obligations"],
  },
];
