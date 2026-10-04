/**
 * Pure helper function to generate standard short device labels for labels and tags.
 * e.g. Samsung Galaxy A54 -> "SA A54"
 *      Apple iPhone 14 Pro Max -> "IP 14 Pro Max"
 *      Xiaomi Redmi Note 12 -> "MI Note 12"
 */
/**
 * Two-letter label codes per brand. Codes are unique per brand family; aliases of the same
 * family intentionally share a code (apple/iphone, xiaomi/redmi) — tests enforce this.
 */
export const BRAND_CODE_MAP: Record<string, string> = {
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
  oneplus: '1+',
  poco: 'PO',
  iqoo: 'IQ',
  itel: 'IT',
  condor: 'CD',
  iris: 'IR',
  'stream system': 'SS',
  brandt: 'BR',
  evertek: 'EV',
  sony: 'SN',
  lg: 'LG',
  htc: 'HT',
  blackberry: 'BB',
  asus: 'AS',
  lenovo: 'LV',
  alcatel: 'AL',
  tcl: 'TL',
  zte: 'ZT',
  nubia: 'NB',
  meizu: 'MZ',
  nothing: 'NT',
  fairphone: 'FP',
  wiko: 'WK',
  doogee: 'DG',
  ulefone: 'UL',
  blackview: 'BV',
  oukitel: 'OK',
  umidigi: 'UM',
  cubot: 'CB',
  hotwav: 'HV',
  cat: 'CT',
  energizer: 'EN',
  sharp: 'SH',
  gionee: 'GN',
  lava: 'LA',
  micromax: 'MX',
  coolpad: 'CP',
  hisense: 'HS',
  'black shark': 'BS',
  redmagic: 'RM'
}

// Brand families that share one code on purpose
export const BRAND_CODE_ALIASES: string[][] = [
  ['apple', 'iphone'],
  ['xiaomi', 'redmi']
]

export function generateShortLabel(brand: string, model: string): string {
  const trimmedBrand = (brand || '').trim()
  const trimmedModel = (model || '').trim()

  if (!trimmedBrand && !trimmedModel) return ''
  if (!trimmedBrand) return trimmedModel
  if (!trimmedModel) return trimmedBrand.slice(0, 3).toUpperCase()

  const brandLower = trimmedBrand.toLowerCase()
  let code = BRAND_CODE_MAP[brandLower]

  if (!code) {
    // Match whole words only ("Samsung Electronics" -> samsung) so short keys like "cat" or "lg"
    // can't match inside unrelated words.
    const words = brandLower.split(/[^a-z0-9+]+/).filter(Boolean)
    const match = Object.keys(BRAND_CODE_MAP).find((key) => {
      const keyWords = key.split(' ')
      return keyWords.every((w) => words.includes(w))
    })
    if (match) {
      code = BRAND_CODE_MAP[match]
    } else {
      code =
        trimmedBrand
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 2)
          .toUpperCase() || trimmedBrand.slice(0, 2)
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
