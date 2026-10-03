/**
 * Pure helper function to generate standard short device labels for labels and tags.
 * e.g. Samsung Galaxy A54 -> "SA A54"
 *      Apple iPhone 14 Pro Max -> "IP 14 Pro Max"
 *      Xiaomi Redmi Note 12 -> "MI Note 12"
 */
const BRAND_CODE_MAP: Record<string, string> = {
  samsung: 'SA',
  apple: 'IP',
  iphone: 'IP',
  xiaomi: 'MI',
  redmi: 'MI',
  huawei: 'HW',
  oppo: 'OP',
  realme: 'RL',
  infinix: 'IN',
  tecno: 'TC',
  honor: 'HN',
  nokia: 'NK',
  google: 'GO',
  motorola: 'MO',
  vivo: 'VV',
  oneplus: '1+'
}

export function generateShortLabel(brand: string, model: string): string {
  const trimmedBrand = (brand || '').trim()
  const trimmedModel = (model || '').trim()

  if (!trimmedBrand && !trimmedModel) return ''
  if (!trimmedBrand) return trimmedModel
  if (!trimmedModel) return trimmedBrand.slice(0, 3).toUpperCase()

  const brandLower = trimmedBrand.toLowerCase()
  let code = BRAND_CODE_MAP[brandLower]

  if (!code) {
    // Find if brand contains any of the known keys
    const match = Object.keys(BRAND_CODE_MAP).find((key) => brandLower.includes(key))
    if (match) {
      code = BRAND_CODE_MAP[match]
    } else {
      code = trimmedBrand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || trimmedBrand.slice(0, 2)
    }
  }

  // Simplify model name by stripping redundant brand names at start
  let cleanModel = trimmedModel
  // Brand is free user text (custom input) — escape it, otherwise "C++" or "(" throws SyntaxError
  const escapedBrand = trimmedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`^(${escapedBrand}|galaxy|iphone|redmi)\\s*`, 'i')
  cleanModel = cleanModel.replace(regex, '').trim() || trimmedModel

  return `${code} ${cleanModel}`.trim()
}
