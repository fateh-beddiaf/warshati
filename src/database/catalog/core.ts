/**
 * Seed data only — original first-run data (seed pack v1).
 * Applied once per database; never edited afterwards (add a new pack for changes).
 */
export const CORE_TECHNICIANS_V1 = [
  { name: 'أنا', isPartner: 0 },
  { name: 'الشريك', isPartner: 1 }
]

export const CORE_CATEGORIES_V1 = [
  { name: 'تغيير شاشة', split: 40.0 },
  { name: 'بطارية ومنفذ شحن', split: 50.0 },
  { name: 'صيانة بورد وسوفتوير', split: 70.0 },
  { name: 'صيانة عامة وأخرى', split: 50.0 }
]

export const CORE_ACCESSORIES_V1 = ['بدون ملحقات', 'شاحن', 'كفر / جراب', 'شريحة SIM', 'بطاقة ذاكرة SD']

export const CORE_BRANDS_V1: Record<string, string[]> = {
  Samsung: [
    'Galaxy A04',
    'Galaxy A14',
    'Galaxy A24',
    'Galaxy A34',
    'Galaxy A54',
    'Galaxy A55',
    'Galaxy S21',
    'Galaxy S22',
    'Galaxy S23',
    'Galaxy S24 Ultra'
  ],
  Xiaomi: [
    'Redmi 9A / 9C',
    'Redmi 10 / 10C',
    'Redmi 12 / 12C',
    'Redmi Note 10',
    'Redmi Note 11',
    'Redmi Note 12',
    'Redmi Note 13 Pro',
    'Poco X3 Pro',
    'Poco X5 Pro',
    'Poco F5'
  ],
  Huawei: ['Y9 2019 / Prime', 'Y7P / Y6P', 'Nova 7i', 'Nova 9', 'Nova 10', 'P30 Lite', 'P40 Pro'],
  Oppo: ['A16 / A17', 'A54 / A55', 'A58 / A78', 'Reno 6', 'Reno 8', 'Reno 10'],
  Realme: ['C11 / C21', 'C33 / C35', 'C53 / C55', 'Realme 9', 'Realme 11 Pro'],
  Infinix: ['Smart 6 / 7 / 8', 'Hot 11 / 12 Play', 'Hot 30 / 40', 'Note 12 / 30'],
  Tecno: ['Pop 5 / 7', 'Spark 8 / 10 / 20', 'Camon 18 / 20'],
  Honor: ['Honor X6 / X7', 'Honor X8 / X9a', 'Honor 90']
}
