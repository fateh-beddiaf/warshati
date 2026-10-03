import type Database from 'better-sqlite3'

export function seedInitialData(db: Database.Database): void {
  const insertTechnician = db.prepare(`INSERT OR IGNORE INTO Technician (name, is_partner) VALUES (?, ?)`)
  const insertCategory = db.prepare(
    `INSERT OR IGNORE INTO RepairCategory (name, default_split_percentage) VALUES (?, ?)`
  )
  const insertAccessory = db.prepare(`INSERT OR IGNORE INTO Accessories (name) VALUES (?)`)
  const insertBrand = db.prepare(`INSERT OR IGNORE INTO Brand (name) VALUES (?)`)
  const insertModel = db.prepare(
    `INSERT OR IGNORE INTO Model (brand_id, name) VALUES ((SELECT id FROM Brand WHERE name = ?), ?)`
  )

  const seedTransaction = db.transaction(() => {
    // 1. Technicians
    const technicians = [
      { name: 'أنا', isPartner: 0 },
      { name: 'الشريك', isPartner: 1 }
    ]
    for (const tech of technicians) {
      insertTechnician.run(tech.name, tech.isPartner)
    }

    // 2. Repair Categories
    const categories = [
      { name: 'تغيير شاشة', split: 40.0 },
      { name: 'بطارية ومنفذ شحن', split: 50.0 },
      { name: 'صيانة بورد وسوفتوير', split: 70.0 },
      { name: 'صيانة عامة وأخرى', split: 50.0 }
    ]
    for (const cat of categories) {
      insertCategory.run(cat.name, cat.split)
    }

    // 3. Accessories
    const accessories = ['بدون ملحقات', 'شاحن', 'كفر / جراب', 'شريحة SIM', 'بطاقة ذاكرة SD']
    for (const acc of accessories) {
      insertAccessory.run(acc)
    }

    // 4. Brands & Models
    const brandsWithModels: Record<string, string[]> = {
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
      Apple: [
        'iPhone X / XS',
        'iPhone 11',
        'iPhone 11 Pro Max',
        'iPhone 12',
        'iPhone 12 Pro Max',
        'iPhone 13',
        'iPhone 13 Pro Max',
        'iPhone 14',
        'iPhone 14 Pro Max',
        'iPhone 15',
        'iPhone 15 Pro Max'
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
      Huawei: [
        'Y9 2019 / Prime',
        'Y7P / Y6P',
        'Nova 7i',
        'Nova 9',
        'Nova 10',
        'P30 Lite',
        'P40 Pro'
      ],
      Oppo: [
        'A16 / A17',
        'A54 / A55',
        'A58 / A78',
        'Reno 6',
        'Reno 8',
        'Reno 10'
      ],
      Realme: [
        'C11 / C21',
        'C33 / C35',
        'C53 / C55',
        'Realme 9',
        'Realme 11 Pro'
      ],
      Infinix: [
        'Smart 6 / 7 / 8',
        'Hot 11 / 12 Play',
        'Hot 30 / 40',
        'Note 12 / 30'
      ],
      Tecno: [
        'Pop 5 / 7',
        'Spark 8 / 10 / 20',
        'Camon 18 / 20'
      ],
      Honor: [
        'Honor X6 / X7',
        'Honor X8 / X9a',
        'Honor 90'
      ]
    }

    for (const [brand, models] of Object.entries(brandsWithModels)) {
      insertBrand.run(brand)
      for (const model of models) {
        insertModel.run(brand, model)
      }
    }
  })

  seedTransaction()
}
