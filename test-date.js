const parseDate = (str) => {
  if (!str) return null
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const [, d, m, y] = dashMatch
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  const iso = new Date(str)
  return isNaN(iso.getTime()) ? null : iso
}
try { parseDate(undefined) } catch(e) { console.error('undefined:', e.message) }
try { parseDate(null) } catch(e) { console.error('null:', e.message) }
