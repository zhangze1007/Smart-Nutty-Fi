import type { Firestore } from "firebase-admin/firestore";

import { getAdminFirestore } from "../lib/firebaseAdmin.js";

export type RiskProfileId = "conservative" | "balanced" | "flexible";
export type RiskConfigSource = "default" | "env" | "firestore";

export type RiskProfileConfig = {
  maxTransferWithoutConfirm: number;
  minBalanceThreshold: number;
  explanationTone: "cautious" | "balanced" | "light";
  unknownPayeeMinimumAmount: number;
  unknownPayeeSeverity: "medium" | "high";
  highRiskKeywordSeverity: "medium" | "high";
};

export type RiskConfig = {
  defaultProfile: RiskProfileId;
  highRiskKeywords: string[];
  unknownPayeeRequiresReview: boolean;
  profiles: Record<RiskProfileId, RiskProfileConfig>;
  source: RiskConfigSource;
};

export type ResolvedRiskConfig = RiskConfig &
  RiskProfileConfig & {
    requestedProfile: RiskProfileId;
  };

type RiskConfigOverride = Partial<{
  defaultProfile: RiskProfileId;
  highRiskKeywords: string[];
  unknownPayeeRequiresReview: boolean;
  profiles: Partial<Record<RiskProfileId, Partial<RiskProfileConfig>>>;
}>;

const DEFAULT_RISK_CONFIG: RiskConfig = {
  defaultProfile: "balanced",
  highRiskKeywords: ["crypto", "exchange", "wallet"],
  unknownPayeeRequiresReview: true,
  profiles: {
    conservative: {
      maxTransferWithoutConfirm: 500,
      minBalanceThreshold: 800,
      explanationTone: "cautious",
      unknownPayeeMinimumAmount: 0,
      unknownPayeeSeverity: "high",
      highRiskKeywordSeverity: "high",
    },
    balanced: {
      maxTransferWithoutConfirm: 1000,
      minBalanceThreshold: 500,
      explanationTone: "balanced",
      unknownPayeeMinimumAmount: 100,
      unknownPayeeSeverity: "medium",
      highRiskKeywordSeverity: "high",
    },
    flexible: {
      maxTransferWithoutConfirm: 2000,
      minBalanceThreshold: 250,
      explanationTone: "light",
      unknownPayeeMinimumAmount: 300,
      unknownPayeeSeverity: "medium",
      highRiskKeywordSeverity: "medium",
    },
  },
  source: "default",
};

let latestRiskConfigSource: RiskConfigSource = "default";

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return null;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function parseSeverity(value: unknown): "medium" | "high" | null {
  if (value === "medium" || value === "high") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "medium" || normalizedValue === "high") {
    return normalizedValue;
  }

  return null;
}

export function normalizeRiskProfileId(value: unknown): RiskProfileId | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (
    normalizedValue === "conservative" ||
    normalizedValue === "balanced" ||
    normalizedValue === "flexible"
  ) {
    return normalizedValue;
  }

  return null;
}

function parseKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((keyword): keyword is string => typeof keyword === "string")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function hasOverrideContent(override: RiskConfigOverride) {
  return Boolean(
    override.defaultProfile ||
      override.highRiskKeywords?.length ||
      typeof override.unknownPayeeRequiresReview === "boolean" ||
      Object.values(override.profiles ?? {}).some((profileOverride) =>
        Boolean(
          profileOverride &&
            (profileOverride.maxTransferWithoutConfirm !== undefined ||
              profileOverride.minBalanceThreshold !== undefined ||
              profileOverride.explanationTone !== undefined ||
              profileOverride.unknownPayeeMinimumAmount !== undefined ||
              profileOverride.unknownPayeeSeverity !== undefined ||
              profileOverride.highRiskKeywordSeverity !== undefined),
        ),
      ),
  );
}

export function mergeRiskConfig(
  baseConfig: RiskConfig,
  override: RiskConfigOverride | null | undefined,
  source: RiskConfigSource,
): RiskConfig {
  if (!override || !hasOverrideContent(override)) {
    return baseConfig;
  }

  return {
    defaultProfile: override.defaultProfile ?? baseConfig.defaultProfile,
    highRiskKeywords:
      override.highRiskKeywords && override.highRiskKeywords.length
        ? override.highRiskKeywords
        : baseConfig.highRiskKeywords,
    unknownPayeeRequiresReview:
      override.unknownPayeeRequiresReview ?? baseConfig.unknownPayeeRequiresReview,
    profiles: {
      conservative: {
        ...baseConfig.profiles.conservative,
        ...override.profiles?.conservative,
      },
      balanced: {
        ...baseConfig.profiles.balanced,
        ...override.profiles?.balanced,
      },
      flexible: {
        ...baseConfig.profiles.flexible,
        ...override.profiles?.flexible,
      },
    },
    source,
  };
}

export function readRiskConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RiskConfigOverride | null {
  const defaultProfile = normalizeRiskProfileId(env.RISK_DEFAULT_PROFILE);
  const highRiskKeywords = parseKeywords(env.RISK_HIGH_RISK_KEYWORDS);
  const unknownPayeeRequiresReview = parseBoolean(env.RISK_UNKNOWN_PAYEE_REQUIRES_REVIEW);

  const profiles = {
    conservative: {
      maxTransferWithoutConfirm: parseNumber(
        env.RISK_PROFILE_CONSERVATIVE_MAX_TRANSFER_WITHOUT_CONFIRM,
      ),
      minBalanceThreshold: parseNumber(env.RISK_PROFILE_CONSERVATIVE_MIN_BALANCE_THRESHOLD),
      explanationTone: "cautious" as const,
      unknownPayeeMinimumAmount: parseNumber(
        env.RISK_PROFILE_CONSERVATIVE_UNKNOWN_PAYEE_MINIMUM_AMOUNT,
      ),
      unknownPayeeSeverity: parseSeverity(env.RISK_PROFILE_CONSERVATIVE_UNKNOWN_PAYEE_SEVERITY),
      highRiskKeywordSeverity: parseSeverity(
        env.RISK_PROFILE_CONSERVATIVE_HIGH_RISK_KEYWORD_SEVERITY,
      ),
    },
    balanced: {
      maxTransferWithoutConfirm: parseNumber(
        env.RISK_PROFILE_BALANCED_MAX_TRANSFER_WITHOUT_CONFIRM,
      ),
      minBalanceThreshold: parseNumber(env.RISK_PROFILE_BALANCED_MIN_BALANCE_THRESHOLD),
      explanationTone: "balanced" as const,
      unknownPayeeMinimumAmount: parseNumber(
        env.RISK_PROFILE_BALANCED_UNKNOWN_PAYEE_MINIMUM_AMOUNT,
      ),
      unknownPayeeSeverity: parseSeverity(env.RISK_PROFILE_BALANCED_UNKNOWN_PAYEE_SEVERITY),
      highRiskKeywordSeverity: parseSeverity(
        env.RISK_PROFILE_BALANCED_HIGH_RISK_KEYWORD_SEVERITY,
      ),
    },
    flexible: {
      maxTransferWithoutConfirm: parseNumber(env.RISK_PROFILE_FLEXIBLE_MAX_TRANSFER_WITHOUT_CONFIRM),
      minBalanceThreshold: parseNumber(env.RISK_PROFILE_FLEXIBLE_MIN_BALANCE_THRESHOLD),
      explanationTone: "light" as const,
      unknownPayeeMinimumAmount: parseNumber(
        env.RISK_PROFILE_FLEXIBLE_UNKNOWN_PAYEE_MINIMUM_AMOUNT,
      ),
      unknownPayeeSeverity: parseSeverity(env.RISK_PROFILE_FLEXIBLE_UNKNOWN_PAYEE_SEVERITY),
      highRiskKeywordSeverity: parseSeverity(
        env.RISK_PROFILE_FLEXIBLE_HIGH_RISK_KEYWORD_SEVERITY,
      ),
    },
  };

  const override: RiskConfigOverride = {
    defaultProfile: defaultProfile ?? undefined,
    highRiskKeywords,
    unknownPayeeRequiresReview: unknownPayeeRequiresReview ?? undefined,
    profiles: {
      conservative: {
        maxTransferWithoutConfirm: profiles.conservative.maxTransferWithoutConfirm ?? undefined,
        minBalanceThreshold: profiles.conservative.minBalanceThreshold ?? undefined,
        unknownPayeeMinimumAmount: profiles.conservative.unknownPayeeMinimumAmount ?? undefined,
        unknownPayeeSeverity: profiles.conservative.unknownPayeeSeverity ?? undefined,
        highRiskKeywordSeverity: profiles.conservative.highRiskKeywordSeverity ?? undefined,
      },
      balanced: {
        maxTransferWithoutConfirm: profiles.balanced.maxTransferWithoutConfirm ?? undefined,
        minBalanceThreshold: profiles.balanced.minBalanceThreshold ?? undefined,
        unknownPayeeMinimumAmount: profiles.balanced.unknownPayeeMinimumAmount ?? undefined,
        unknownPayeeSeverity: profiles.balanced.unknownPayeeSeverity ?? undefined,
        highRiskKeywordSeverity: profiles.balanced.highRiskKeywordSeverity ?? undefined,
      },
      flexible: {
        maxTransferWithoutConfirm: profiles.flexible.maxTransferWithoutConfirm ?? undefined,
        minBalanceThreshold: profiles.flexible.minBalanceThreshold ?? undefined,
        unknownPayeeMinimumAmount: profiles.flexible.unknownPayeeMinimumAmount ?? undefined,
        unknownPayeeSeverity: profiles.flexible.unknownPayeeSeverity ?? undefined,
        highRiskKeywordSeverity: profiles.flexible.highRiskKeywordSeverity ?? undefined,
      },
    },
  };

  return hasOverrideContent(override) ? override : null;
}

function parseRiskConfigRecord(record: Record<string, unknown>): RiskConfigOverride {
  const defaultProfile = normalizeRiskProfileId(record.defaultProfile);
  const highRiskKeywords = parseKeywords(record.highRiskKeywords);
  const unknownPayeeRequiresReview = parseBoolean(record.unknownPayeeRequiresReview);
  const profilesRecord =
    record.profiles && typeof record.profiles === "object"
      ? (record.profiles as Record<string, unknown>)
      : {};

  const buildProfileOverride = (profileKey: RiskProfileId): Partial<RiskProfileConfig> => {
    const rawProfile =
      profilesRecord[profileKey] && typeof profilesRecord[profileKey] === "object"
        ? (profilesRecord[profileKey] as Record<string, unknown>)
        : {};

    return {
      maxTransferWithoutConfirm: parseNumber(rawProfile.maxTransferWithoutConfirm) ?? undefined,
      minBalanceThreshold: parseNumber(rawProfile.minBalanceThreshold) ?? undefined,
      explanationTone:
        rawProfile.explanationTone === "cautious" ||
        rawProfile.explanationTone === "balanced" ||
        rawProfile.explanationTone === "light"
          ? rawProfile.explanationTone
          : undefined,
      unknownPayeeMinimumAmount: parseNumber(rawProfile.unknownPayeeMinimumAmount) ?? undefined,
      unknownPayeeSeverity: parseSeverity(rawProfile.unknownPayeeSeverity) ?? undefined,
      highRiskKeywordSeverity: parseSeverity(rawProfile.highRiskKeywordSeverity) ?? undefined,
    };
  };

  return {
    defaultProfile: defaultProfile ?? undefined,
    highRiskKeywords,
    unknownPayeeRequiresReview: unknownPayeeRequiresReview ?? undefined,
    profiles: {
      conservative: buildProfileOverride("conservative"),
      balanced: buildProfileOverride("balanced"),
      flexible: buildProfileOverride("flexible"),
    },
  };
}

async function readRiskConfigFromFirestore(db: Firestore | null) {
  if (!db) {
    return null;
  }

  try {
    const snapshot = await db.doc("appConfig/risk").get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    if (!data) {
      return null;
    }

    return parseRiskConfigRecord(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function loadRiskConfig(options?: {
  db?: Firestore | null;
  env?: NodeJS.ProcessEnv;
}) {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();
  const envOverride = readRiskConfigFromEnv(options?.env);
  const firestoreOverride = await readRiskConfigFromFirestore(db);

  let config = DEFAULT_RISK_CONFIG;

  if (envOverride) {
    config = mergeRiskConfig(config, envOverride, "env");
  }

  if (firestoreOverride) {
    config = mergeRiskConfig(config, firestoreOverride, "firestore");
  }

  latestRiskConfigSource = config.source;
  return config;
}

export function resolveRiskConfig(config: RiskConfig, requestedProfile?: RiskProfileId | null): ResolvedRiskConfig {
  const activeProfile = requestedProfile ?? config.defaultProfile;

  return {
    ...config,
    ...config.profiles[activeProfile],
    requestedProfile: activeProfile,
  };
}

export function getLatestRiskConfigSource() {
  return latestRiskConfigSource;
}
