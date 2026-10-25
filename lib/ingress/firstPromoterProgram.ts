export const SYLLABY_TEST_PROVIDER = "firstpromoter";
export const SYLLABY_TEST_ACCOUNT = "syllaby";
export const SYLLABY_TEST_PROGRAM = "syllaby_affiliates";
export const SYLLABY_TEST_ENVIRONMENT = "test";
export const SYLLABY_PRODUCTION_ENVIRONMENT = "production";
export const SYLLABY_TEST_PLATFORM = "syllaby";
export const SYLLABY_TEST_CURRENCY = "USD";
export const SYLLABY_CURRENCY_SOURCE = "provider_documentation";

export const SUBMAGIC_ACCOUNT = "submagic";
export const SUBMAGIC_PROGRAM = "submagic_affiliates";
export const SUBMAGIC_PLATFORM = "submagic";
export const SUBMAGIC_TEST_ENVIRONMENT = "test";
export const SUBMAGIC_PRODUCTION_ENVIRONMENT = "production";

/**
 * ISO 4217 reserves XTS for testing.
 * This marks Submagic's test receiver only. It is not a verified program currency.
 */
export const SUBMAGIC_SYNTHETIC_TEST_CURRENCY = "XTS";
export const SUBMAGIC_SYNTHETIC_CURRENCY_SOURCE = "synthetic_test_configuration";
export const AMOUNT_UNIT_MINOR_HUNDREDTHS = "minor_hundredths";

export type AmountUnit = typeof AMOUNT_UNIT_MINOR_HUNDREDTHS;
export type PostbackEnvironment = "test" | "production";

export type FirstPromoterProgramConfig = {
  provider: typeof SYLLABY_TEST_PROVIDER;
  accountScope: string;
  programScope: string;
  platform: string;
  environment: PostbackEnvironment;
  isTest: boolean;
  currencyCode: string;
  currencySource: string;
  amountUnit: AmountUnit | null;
  affiliateIdentifierVerified: boolean;
  postbackSupportVerified: boolean;
  currencyVerified: boolean;
};

function freezeConfig(config: FirstPromoterProgramConfig): FirstPromoterProgramConfig {
  return Object.freeze(config) as FirstPromoterProgramConfig;
}

export const syllabyTestConfig = freezeConfig({
  provider: SYLLABY_TEST_PROVIDER,
  accountScope: SYLLABY_TEST_ACCOUNT,
  programScope: SYLLABY_TEST_PROGRAM,
  platform: SYLLABY_TEST_PLATFORM,
  environment: SYLLABY_TEST_ENVIRONMENT,
  isTest: true,
  currencyCode: SYLLABY_TEST_CURRENCY,
  currencySource: SYLLABY_CURRENCY_SOURCE,
  amountUnit: AMOUNT_UNIT_MINOR_HUNDREDTHS,
  affiliateIdentifierVerified: true,
  postbackSupportVerified: true,
  currencyVerified: true,
});

export const syllabyProductionConfig = freezeConfig({
  provider: SYLLABY_TEST_PROVIDER,
  accountScope: SYLLABY_TEST_ACCOUNT,
  programScope: SYLLABY_TEST_PROGRAM,
  platform: SYLLABY_TEST_PLATFORM,
  environment: SYLLABY_PRODUCTION_ENVIRONMENT,
  isTest: false,
  currencyCode: SYLLABY_TEST_CURRENCY,
  currencySource: SYLLABY_CURRENCY_SOURCE,
  amountUnit: AMOUNT_UNIT_MINOR_HUNDREDTHS,
  affiliateIdentifierVerified: true,
  postbackSupportVerified: true,
  currencyVerified: true,
});

export const submagicTestConfig = freezeConfig({
  provider: SYLLABY_TEST_PROVIDER,
  accountScope: SUBMAGIC_ACCOUNT,
  programScope: SUBMAGIC_PROGRAM,
  platform: SUBMAGIC_PLATFORM,
  environment: SUBMAGIC_TEST_ENVIRONMENT,
  isTest: true,
  currencyCode: SUBMAGIC_SYNTHETIC_TEST_CURRENCY,
  currencySource: SUBMAGIC_SYNTHETIC_CURRENCY_SOURCE,
  amountUnit: AMOUNT_UNIT_MINOR_HUNDREDTHS,
  affiliateIdentifierVerified: false,
  postbackSupportVerified: false,
  currencyVerified: false,
});

/**
 * Production stays incomplete until the affiliate identifier, postback support,
 * currency, and minor-unit are verified. A secret must not fill these fields.
 */
export const submagicProductionConfig = freezeConfig({
  provider: SYLLABY_TEST_PROVIDER,
  accountScope: SUBMAGIC_ACCOUNT,
  programScope: SUBMAGIC_PROGRAM,
  platform: SUBMAGIC_PLATFORM,
  environment: SUBMAGIC_PRODUCTION_ENVIRONMENT,
  isTest: false,
  currencyCode: "",
  currencySource: "",
  amountUnit: null,
  affiliateIdentifierVerified: false,
  postbackSupportVerified: false,
  currencyVerified: false,
});

const PRODUCTION_CURRENCY_CODE = /^[A-Z]{3}$/;

export function isVerifiedProductionConfig(config: FirstPromoterProgramConfig): boolean {
  if (config.currencyCode === SUBMAGIC_SYNTHETIC_TEST_CURRENCY) return false;
  if (config.currencySource === SUBMAGIC_SYNTHETIC_CURRENCY_SOURCE) return false;
  // Shape only. A three-letter code is not evidence that the currency is verified.
  if (!PRODUCTION_CURRENCY_CODE.test(config.currencyCode)) return false;
  if (config.currencySource.trim() === "") return false;
  if (config.environment !== "production" || config.isTest !== false) return false;
  if (config.affiliateIdentifierVerified !== true) return false;
  if (config.postbackSupportVerified !== true) return false;
  if (config.currencyVerified !== true) return false;
  if (config.amountUnit !== AMOUNT_UNIT_MINOR_HUNDREDTHS) return false;
  return true;
}

export function isSubmagicProductionEnabled(): boolean {
  return isVerifiedProductionConfig(submagicProductionConfig);
}

if (
  syllabyProductionConfig.accountScope === submagicProductionConfig.accountScope ||
  syllabyProductionConfig.programScope === submagicProductionConfig.programScope ||
  syllabyProductionConfig.platform === submagicProductionConfig.platform ||
  syllabyTestConfig.accountScope === submagicTestConfig.accountScope ||
  syllabyTestConfig.programScope === submagicTestConfig.programScope ||
  syllabyTestConfig.platform === submagicTestConfig.platform
) {
  throw new Error("PROGRAM_SCOPE_COLLISION");
}
