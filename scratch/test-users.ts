import fs from 'fs'
import path from 'path'

// Load .env.local manually before importing database repos
try {
  const envPath = path.resolve(__dirname, '../.env.local')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const firstEq = trimmed.indexOf('=')
        if (firstEq !== -1) {
          const key = trimmed.substring(0, firstEq).trim()
          let val = trimmed.substring(firstEq + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1)
          }
          process.env[key] = val
        }
      }
    })
  }
} catch (e) {
  console.error('Failed to load .env.local', e)
}

import { getAllSalesUsers } from '../database/repos/sales-users'
import { getProjectOrders } from '../database/repos/orders'
import { getAllQuotations } from '../database/repos/quotations'

async function main() {
  try {
    const salesUsers = await getAllSalesUsers()
    const userMap = new Map()
    for (const u of salesUsers) {
      if (u.userId) userMap.set(u.userId, u)
    }

    const orders = await getProjectOrders()
    const quotations = await getAllQuotations()

    const activeUserIds = new Set<string>()
    for (const o of orders) {
      if (o.prjOwner) activeUserIds.add(o.prjOwner)
    }
    for (const q of quotations) {
      if (q.qOwner) activeUserIds.add(q.qOwner)
      if (q.createdBy) activeUserIds.add(q.createdBy)
    }

    const salesUserList = Array.from(activeUserIds)
      .map((id) => { const u = userMap.get(id); return { id, name: u?.name || id, email: u?.email || '' } })
      .sort((a, b) => a.name.localeCompare(b.name))

    console.log('--- SALES USER LIST ---')
    console.log(JSON.stringify(salesUserList.slice(0, 15), null, 2))
  } catch (err) {
    console.error(err)
  }
}

main()
