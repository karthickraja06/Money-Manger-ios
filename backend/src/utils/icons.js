// Default category icon mappings
const CATEGORY_ICONS = {
  Groceries: "🛒",
  Entertainment: "🎬",
  Transport: "🚗",
  Utilities: "💡",
  Dining: "🍽️",
  Shopping: "🛍️",
  Health: "⚕️",
  Education: "📚",
  Travel: "✈️",
  Other: "📌",
};

// Merchant-specific icon overrides
const MERCHANT_ICONS = {
  starbucks: "☕",
  netflix: "🎥",
  uber: "🚗",
  amazon: "📦",
  walmart: "🏬",
  target: "🎯",
  whole_foods: "🥬",
  dunkin: "🍩",
  mcd: "🍔",
  kfc: "🍗",
  zomato: "🍜",
  swiggy: "🚚",
  booking: "🏨",
  hotels: "🏨",
  airline: "✈️",
  fuel: "⛽",
  petrol: "⛽",
  metro: "🚇",
  railway: "🚂",
  pharmacy: "💊",
  hospital: "🏥",
  gym: "💪",
  spotify: "🎵",
  prime_video: "📺",
  hotstar: "🎭",
};

/**
 * Get icon for category
 */
function getCategoryIcon(parentCategory, customIcon) {
  return customIcon || CATEGORY_ICONS[parentCategory] || CATEGORY_ICONS.Other;
}

/**
 * Get icon for merchant/transaction
 */
function getMerchantIcon(merchant, parentCategory) {
  if (!merchant) return getCategoryIcon(parentCategory);

  const merchantLower = merchant.toLowerCase();

  // Check merchant-specific mappings
  for (const [key, icon] of Object.entries(MERCHANT_ICONS)) {
    if (merchantLower.includes(key)) {
      return icon;
    }
  }

  // Fall back to category icon
  return getCategoryIcon(parentCategory);
}

/**
 * Get all available icons
 */
function getAllIcons() {
  return {
    categories: CATEGORY_ICONS,
    merchants: MERCHANT_ICONS,
  };
}

module.exports = {
  CATEGORY_ICONS,
  MERCHANT_ICONS,
  getCategoryIcon,
  getMerchantIcon,
  getAllIcons,
};
