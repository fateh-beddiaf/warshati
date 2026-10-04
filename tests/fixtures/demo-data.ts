import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { initializeSchema } from '../../src/database/schema'
import { seedInitialData } from '../../src/database/seed'
import { createTicket, updateTicketStatus } from '../../src/database/queries/tickets'
import type { CreateTicketDTO, PaymentType } from '../../src/shared/types'

/**
 * Realistic demo shop data for visual review (screenshots) — NOT used by the app itself.
 * 14 tickets: in progress, ready (two overdue), delivered over the last three weeks,
 * cash and credit, both technicians, a couple of unpaid debts.
 * T004: the screen (1) and charging-port (2) categories require a parts cost. Most of their tickets carry
 * one; three are still missing it (in progress, ready, and one DELIVERED = provisional profit) and one
 * delivered ticket is a loss (cost above the price).
 * Run via: electron -r tsx tests/fixtures/seed-demo.run.ts <dataDir>
 */

interface DemoTicket {
  name: string
  phone: string
  brand: string
  model: string
  label: string
  category: number // 1 screen, 2 battery/port, 3 board/software, 4 general
  technician: 1 | 2 // 1 = me, 2 = partner
  price: number
  paid: number
  accessories: number[]
  /** final status */
  status: 'in_progress' | 'ready' | 'delivered'
  /** days ago the ticket was created */
  createdDaysAgo: number
  /** days ago it became ready (ready/delivered) */
  readyDaysAgo?: number
  /** days ago it was delivered (delivered) */
  deliveredDaysAgo?: number
  /** delivered but customer still owes this much */
  leftOwing?: number
  /** parts cost; omitted = not entered yet (NULL) */
  cost?: number
}

const TICKETS: DemoTicket[] = [
  {
    name: 'كريم بن يوسف',
    phone: '0555123456',
    brand: 'Samsung',
    model: 'Galaxy A54',
    label: 'SA A54',
    category: 1,
    technician: 1,
    price: 9500,
    paid: 4000,
    accessories: [3],
    status: 'in_progress',
    createdDaysAgo: 0,
    cost: 6200
  },
  {
    name: 'أمينة لعور',
    phone: '0661778899',
    brand: 'Redmi',
    model: 'Redmi Note 12',
    label: 'RD N12',
    category: 2,
    technician: 1,
    price: 2500,
    paid: 2500,
    accessories: [2],
    status: 'in_progress',
    createdDaysAgo: 1
  }, // cost missing
  {
    name: 'ياسين مرابط',
    phone: '0770123987',
    brand: 'Infinix',
    model: 'Hot 30',
    label: 'IN H30',
    category: 3,
    technician: 2,
    price: 6000,
    paid: 1000,
    accessories: [],
    status: 'in_progress',
    createdDaysAgo: 2
  },
  {
    name: 'سارة بوعلام',
    phone: '0550998877',
    brand: 'Tecno',
    model: 'Spark 10',
    label: 'TC S10',
    category: 4,
    technician: 1,
    price: 1800,
    paid: 1800,
    accessories: [4],
    status: 'in_progress',
    createdDaysAgo: 3
  },
  {
    name: 'محمد الأمين قاسمي',
    phone: '0698456123',
    brand: 'Samsung',
    model: 'Galaxy A34',
    label: 'SA A34',
    category: 1,
    technician: 2,
    price: 8200,
    paid: 8200,
    accessories: [2, 3],
    status: 'ready',
    createdDaysAgo: 2,
    readyDaysAgo: 1,
    cost: 5400
  },
  {
    name: 'لينا حداد',
    phone: '0556321478',
    brand: 'Oppo',
    model: 'A57',
    label: 'OP A57',
    category: 2,
    technician: 1,
    price: 3200,
    paid: 1500,
    accessories: [],
    status: 'ready',
    createdDaysAgo: 8,
    readyDaysAgo: 5
  }, // cost missing (overdue + missing)
  {
    name: 'عبد الرحمان سعيدي',
    phone: '0771456789',
    brand: 'Realme',
    model: 'C55',
    label: 'RL C55',
    category: 3,
    technician: 1,
    price: 7500,
    paid: 3000,
    accessories: [3],
    status: 'ready',
    createdDaysAgo: 12,
    readyDaysAgo: 9
  },
  {
    name: 'نور الهدى بلقاسم',
    phone: '0662147852',
    brand: 'Huawei',
    model: 'Y9 Prime',
    label: 'HW Y9P',
    category: 1,
    technician: 1,
    price: 5500,
    paid: 5500,
    accessories: [],
    status: 'delivered',
    createdDaysAgo: 4,
    readyDaysAgo: 3,
    deliveredDaysAgo: 2,
    cost: 3500
  },
  {
    name: 'رياض بوزيد',
    phone: '0553698741',
    brand: 'Samsung',
    model: 'Galaxy S22',
    label: 'SA S22',
    category: 1,
    technician: 1,
    price: 18000,
    paid: 18000,
    accessories: [2],
    status: 'delivered',
    createdDaysAgo: 6,
    readyDaysAgo: 5,
    deliveredDaysAgo: 4,
    cost: 12500
  },
  {
    name: 'إيمان شريف',
    phone: '0774125896',
    brand: 'Xiaomi',
    model: 'Redmi 12',
    label: 'XI R12',
    category: 2,
    technician: 2,
    price: 2200,
    paid: 2200,
    accessories: [],
    status: 'delivered',
    createdDaysAgo: 7,
    readyDaysAgo: 6,
    deliveredDaysAgo: 6,
    cost: 900
  },
  {
    name: 'عمر خليفي',
    phone: '0699852147',
    brand: 'Infinix',
    model: 'Note 30',
    label: 'IN N30',
    category: 3,
    technician: 1,
    price: 9000,
    paid: 6000,
    accessories: [3],
    status: 'delivered',
    createdDaysAgo: 10,
    readyDaysAgo: 8,
    deliveredDaysAgo: 7,
    leftOwing: 3000
  },
  {
    name: 'هدى مقراني',
    phone: '0558741236',
    brand: 'Tecno',
    model: 'Camon 20',
    label: 'TC C20',
    category: 4,
    technician: 1,
    price: 1500,
    paid: 1500,
    accessories: [],
    status: 'delivered',
    createdDaysAgo: 14,
    readyDaysAgo: 13,
    deliveredDaysAgo: 12
  },
  {
    name: 'بلال عزوز',
    phone: '0663214569',
    brand: 'Oppo',
    model: 'Reno 8',
    label: 'OP R8',
    category: 1,
    technician: 2,
    price: 12000,
    paid: 12000,
    accessories: [2, 3],
    status: 'delivered',
    createdDaysAgo: 18,
    readyDaysAgo: 17,
    deliveredDaysAgo: 15
  }, // delivered WITHOUT its cost: provisional
  {
    name: 'فاطمة الزهراء دحمان',
    phone: '0775896321',
    brand: 'Realme',
    model: '9 Pro',
    label: 'RL 9P',
    category: 2,
    technician: 1,
    price: 3500,
    paid: 2000,
    accessories: [],
    status: 'delivered',
    createdDaysAgo: 20,
    readyDaysAgo: 19,
    deliveredDaysAgo: 18,
    leftOwing: 1500,
    cost: 4000
  } // a loss
]

const daysAgoIso = (days: number, hour: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 10, 0, 0)
  return d.toISOString()
}

export function seedDemoDatabase(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  seedInitialData(db)
  // The user opts categories in from Settings; the demo shop did it for screens and charging ports
  db.prepare(`UPDATE RepairCategory SET requires_parts_cost = 1 WHERE id IN (1, 2)`).run()

  for (const demo of TICKETS) {
    const dto: CreateTicketDTO = {
      customer: { name: demo.name, phone: demo.phone, notes: '' },
      device: { brand: demo.brand, model: demo.model, short_label: demo.label },
      ticket: {
        repair_category_id: demo.category,
        price: demo.price,
        payment_type: (demo.paid >= demo.price ? 'cash' : 'credit') as PaymentType,
        amount_paid: demo.paid,
        technician_id: demo.technician,
        parts_cost: demo.cost ?? null
      },
      accessory_ids: demo.accessories
    }
    const { ticketId } = createTicket(db, dto)

    if (demo.status !== 'in_progress') {
      updateTicketStatus(db, { ticketId, newStatus: 'ready' })
    }
    if (demo.status === 'delivered') {
      const settled = demo.leftOwing ? demo.price - demo.leftOwing : demo.price
      updateTicketStatus(db, {
        ticketId,
        newStatus: 'delivered',
        paymentUpdate: {
          amount_paid: settled,
          payment_type: demo.leftOwing ? 'credit' : 'cash'
        }
      })
    }

    // Backdate so the lists, overdue badges and report periods look real
    db.prepare(`UPDATE Ticket SET created_at = ? WHERE id = ?`).run(daysAgoIso(demo.createdDaysAgo, 10), ticketId)
    db.prepare(`UPDATE StatusLog SET timestamp = ? WHERE ticket_id = ? AND new_status = 'in_progress'`).run(
      daysAgoIso(demo.createdDaysAgo, 10),
      ticketId
    )
    if (demo.readyDaysAgo !== undefined) {
      db.prepare(`UPDATE StatusLog SET timestamp = ? WHERE ticket_id = ? AND new_status = 'ready'`).run(
        daysAgoIso(demo.readyDaysAgo, 14),
        ticketId
      )
    }
    if (demo.deliveredDaysAgo !== undefined) {
      db.prepare(`UPDATE StatusLog SET timestamp = ? WHERE ticket_id = ? AND new_status = 'delivered'`).run(
        daysAgoIso(demo.deliveredDaysAgo, 16),
        ticketId
      )
    }
  }

  db.close()
}
