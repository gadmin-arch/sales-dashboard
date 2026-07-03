import { calculateTerRate } from '../lib/finance-ap-helpers'
import fs from 'fs'

const data = JSON.parse(fs.readFileSync('scratch/ter_rates.json', 'utf8'))

const taxable = 13279681
const category = 'K/2'

console.log("Taxable:", taxable)
console.log("Category:", category)
const rate = calculateTerRate(taxable, category, data)
console.log("Rate applied:", rate)
console.log("PPh 21:", Math.round(taxable * rate))
