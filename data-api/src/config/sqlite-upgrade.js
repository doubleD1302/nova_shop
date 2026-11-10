// Cột được bổ sung trong SQLite fallback sau phiên bản cũ. Không tự tạo giá trị lịch sử.
const additions = {
  shops: { suspended_by: 'INTEGER', suspended_at: 'TEXT' },
  categories: { parent_id: 'INTEGER', image_url: 'TEXT' },
  products: { reviewed_by: 'INTEGER', reviewed_at: 'TEXT' },
  product_images: { alt_text: 'TEXT', source_page_url: 'TEXT', author: 'TEXT', license_name: 'TEXT', license_url: 'TEXT' },
  orders: { idempotency_key: 'TEXT', request_hash: 'TEXT', voucher_code: 'TEXT', subtotal: 'REAL', shipping_fee: 'REAL', discount_amount: 'REAL' },
  shop_orders: { subtotal: 'REAL', discount_amount: 'REAL', shipping_method: 'TEXT', shipping_name: 'TEXT', cancel_reason: 'TEXT', cancelled_at: 'TEXT', delivered_at: 'TEXT' },
  order_items: { shop_id: 'INTEGER', product_slug: 'TEXT', variant_attributes: 'TEXT', sku: 'TEXT', image_url: 'TEXT', unit_price: 'REAL', original_price: 'REAL', line_total: 'REAL' },
  reviews: { order_item_id: 'INTEGER', seller_reply: 'TEXT', replied_by: 'INTEGER', replied_at: 'TEXT' },
  abuse_reports: { evidence_url: 'TEXT', resolved_by: 'INTEGER', resolved_at: 'TEXT' },
  vouchers: { used_count: 'INTEGER', updated_at: 'TEXT' },
  cart_items: { qty: 'INTEGER' },
  demo_seller_payouts: { created_at: 'TEXT' },
  demo_payout_withdrawals: { request_key: 'TEXT' },
  chat_conversations: { last_message_at: 'TEXT' },
  chat_messages: { attachments: 'TEXT', is_read: 'INTEGER' },
}

export function upgradeLocalColumns(db) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const added = []
    for (const [table, columns] of Object.entries(additions)) {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
      if (!exists) continue
      const present = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name))
      for (const [name, type] of Object.entries(columns)) {
        if (present.has(name)) continue
        db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${type}`)
        added.push(`${table}.${name}`)
      }
      if (table === 'cart_items' && added.includes('cart_items.qty') && present.has('quantity')) {
        db.exec('UPDATE cart_items SET qty = quantity WHERE qty IS NULL')
      }
      if (table === 'order_items') {
        if (added.includes('order_items.unit_price') && present.has('price')) db.exec('UPDATE order_items SET unit_price = price WHERE unit_price IS NULL')
        if (added.includes('order_items.line_total') && present.has('price') && present.has('qty')) db.exec('UPDATE order_items SET line_total = price * qty WHERE line_total IS NULL')
      }
    }
    db.exec('COMMIT')
    return added
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
