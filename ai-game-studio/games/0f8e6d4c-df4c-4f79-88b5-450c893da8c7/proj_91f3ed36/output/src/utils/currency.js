/**
 * Currency Utility Functions
 * Shared helpers for currency name normalization and validation
 */

// Currency name mappings (camelCase <-> snake_case <-> DB column)
const CURRENCY_NAMES = {
  cosmicEssence: { snakeCase: 'cosmic_essence', dbColumn: 'cosmic_essence' },
  starlightOrbs: { snakeCase: 'starlight_orbs', dbColumn: 'starlight_orbs' },
  shadowShards: { snakeCase: 'shadow_shards', dbColumn: 'shadow_shards' },
  voidFragments: { snakeCase: 'void_fragments', dbColumn: 'void_fragments' },
  alignmentCrystals: { snakeCase: 'alignment_crystals', dbColumn: 'alignment_crystals' },
  primordialSparks: { snakeCase: 'primordial_sparks', dbColumn: 'primordial_sparks' },
};

// Reverse lookup from snake_case to camelCase
const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CURRENCY_NAMES).map(([camel, { snakeCase }]) => [snakeCase, camel])
);

/**
 * Normalize currency name to camelCase
 * @param {string} currency - Currency name in any case format
 * @returns {string} Currency name in camelCase
 */
function toCamelCase(currency) {
  if (!currency) return currency;

  // Already camelCase
  if (CURRENCY_NAMES[currency]) return currency;

  // Convert from snake_case
  if (SNAKE_TO_CAMEL[currency]) return SNAKE_TO_CAMEL[currency];

  // Manual conversion from snake_case
  if (currency.includes('_')) {
    return currency.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  return currency;
}

/**
 * Normalize currency name to snake_case
 * @param {string} currency - Currency name in any case format
 * @returns {string} Currency name in snake_case
 */
function toSnakeCase(currency) {
  if (!currency) return currency;

  // Already snake_case
  if (SNAKE_TO_CAMEL[currency]) return currency;

  // Convert from camelCase
  if (CURRENCY_NAMES[currency]) return CURRENCY_NAMES[currency].snakeCase;

  // Manual conversion from camelCase
  return currency.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Get safe database column name for a currency (prevents SQL injection)
 * @param {string} currency - Currency name in any case format
 * @returns {string} Safe database column name
 * @throws {Error} If currency is not in allowlist
 */
function getDbColumnName(currency) {
  const camelCase = toCamelCase(currency);
  const mapping = CURRENCY_NAMES[camelCase];

  if (!mapping) {
    throw new Error(`Unknown currency: ${currency}`);
  }

  return mapping.dbColumn;
}

/**
 * Check if currency name is valid
 * @param {string} currency - Currency name in any case format
 * @returns {boolean} True if valid currency
 */
function isValidCurrency(currency) {
  const camelCase = toCamelCase(currency);
  return CURRENCY_NAMES.hasOwnProperty(camelCase);
}

/**
 * Get all valid currency names in camelCase
 * @returns {string[]} Array of valid currency names
 */
function getAllCurrencyNames() {
  return Object.keys(CURRENCY_NAMES);
}

module.exports = {
  toCamelCase,
  toSnakeCase,
  getDbColumnName,
  isValidCurrency,
  getAllCurrencyNames,
  CURRENCY_NAMES,
};
