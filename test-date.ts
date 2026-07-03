import { parseDate } from './lib/utils-date-currency'
console.log('parseDate undefined:', parseDate(undefined as any))
console.log('parseDate null:', parseDate(null as any))
console.log('parseDate with time:', parseDate('7/29/2025 10:16:39'))
