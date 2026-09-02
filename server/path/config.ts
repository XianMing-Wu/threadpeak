import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ENV_NAMES = [
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL_NAME",
  "ZHIHU_API_BASE_URL",
  "ZHIHU_ACCESS_SECRET",
  "THREADPEAK_ALLOW_LIVE_CALLS",
] as const;

export const SEARCH_SUFFICIENCY = {
  minUniqueValidSources: 4,
  minCoveredQueryAngles: 4,
  minExcerptCodePoints: 80,
} as const;

export const PATH_BUDGETS_MS = {
  recentSearch: 2_200,
  expandedSearch: 1_300,
  primaryGeneration: 3_000,
  fallbackGeneration: 2_500,
  localWork: 1_000,
  total: 50_000,
  fallbackMinRemaining: 12_000,
} as const;

export const SEARCH_WINDOWS_DAYS = {
  recent: 365,
  expanded: 1_095,
} as const;

export const PROVIDER_LIMITS = {
  zhihuResultLimit: 8,
  zhihuMaxResponseBytes: 1_048_576,
  deepseekMaxResponseBytes: 2_097_152,
  rejectedExcerptBytes: 32 * 1024,
  maxIssueCount: 32,
  maxIssueCodePoints: 500,
  maxInFlightSearches: 5,
} as const;

const PathRuntimeConfigSchema = z
  .object({
    deepseekBaseUrl: z.string().url(),
    deepseekApiKey: z.string().min(1),
    deepseekModelName: z.string().min(1),
    zhihuApiBaseUrl: z.string().url(),
    zhihuAccessSecret: z.string().min(1),
    allowLiveCalls: z.boolean(),
    listenHost: z.literal("127.0.0.1"),
    listenPort: z.literal(5033),
  })
  .strict();

export type PathRuntimeConfig = z.infer<typeof PathRuntimeConfigSchema>;

const parseDotEnv = (
  contents: string,
  allow: (key: string) => boolean,
): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (allow(key)) values[key] = value;
  }
  return values;
};

const envFilePath = () => resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");

const loadEnvFile = (): Record<string, string> => {
  try {
    return parseDotEnv(
      readFileSync(envFilePath(), "utf8"),
      (key) => ENV_NAMES.includes(key as (typeof ENV_NAMES)[number]),
    );
  } catch {
    return {};
  }
};

export const readApplicationDatabaseUrl = (): string | undefined => {
  const fromProcess = process.env.DATABASE_URL?.trim();
  if (fromProcess !== undefined && fromProcess !== "") return fromProcess;
  try {
    const fromFile = parseDotEnv(
      readFileSync(envFilePath(), "utf8"),
      (key) => key === "DATABASE_URL",
    ).DATABASE_URL?.trim();
    return fromFile === undefined || fromFile === "" ? undefined : fromFile;
  } catch {
    return undefined;
  }
};

const readEnv = (name: (typeof ENV_NAMES)[number], fileEnv: Record<string, string>) =>
  process.env[name] ?? fileEnv[name];

export const loadPathRuntimeConfig = (
  input: Partial<Record<(typeof ENV_NAMES)[number], string>> = {},
): PathRuntimeConfig => {
  const fileEnv = loadEnvFile();
  const allowLiveRaw = input.THREADPEAK_ALLOW_LIVE_CALLS
    ?? readEnv("THREADPEAK_ALLOW_LIVE_CALLS", fileEnv)
    ?? "0";
  return PathRuntimeConfigSchema.parse({
    deepseekBaseUrl: input.DEEPSEEK_BASE_URL ?? readEnv("DEEPSEEK_BASE_URL", fileEnv),
    deepseekApiKey: input.DEEPSEEK_API_KEY ?? readEnv("DEEPSEEK_API_KEY", fileEnv),
    deepseekModelName: input.DEEPSEEK_MODEL_NAME ?? readEnv("DEEPSEEK_MODEL_NAME", fileEnv) ?? "deepseek-chat",
    zhihuApiBaseUrl: input.ZHIHU_API_BASE_URL ?? readEnv("ZHIHU_API_BASE_URL", fileEnv),
    zhihuAccessSecret: input.ZHIHU_ACCESS_SECRET ?? readEnv("ZHIHU_ACCESS_SECRET", fileEnv),
    allowLiveCalls: allowLiveRaw === "1" || allowLiveRaw === "true",
    listenHost: "127.0.0.1",
    listenPort: 5033,
  });
};

export const loadTestConfig = (): PathRuntimeConfig =>
  PathRuntimeConfigSchema.parse({
    deepseekBaseUrl: "https://deepseek.test/v1",
    deepseekApiKey: "test-deepseek-key",
    deepseekModelName: "deepseek-chat",
    zhihuApiBaseUrl: "https://zhihu.test/api/v1",
    zhihuAccessSecret: "test-zhihu-secret",
    allowLiveCalls: false,
    listenHost: "127.0.0.1",
    listenPort: 5033,
  });
