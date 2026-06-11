# Sales Dashboard - Latest Updates

## Overview
Complete redesign of all dashboard pages with unified filter experience, simplified date range inputs, and enhanced KPI metrics.

---

## Key Changes Implemented

### 1. **Unified Filter Layout - All Dashboards**

All three dashboards (Sales Overview, Invoices & Receivables, Payments Collection) now have:
- **Filters positioned at the top** for immediate access
- **Consolidated date range inputs** - single input field with "from" to "to" dates
- **Mobile-responsive filters** - collapsible on smaller screens
- **Reset buttons** for clearing all active filters

#### Sales Overview Dashboard Filters
- Date Range (dropdown selector)
- Sales Person
- Project Type
- Status

#### Invoice & Receivables Dashboard Filters
- Filter Logic (AND/OR toggle)
- Payment Status
- Invoice Status
- Project Status
- Customer
- Invoice Date Range (consolidated)

#### Payments Collection Dashboard Filters
- Payment Status
- Customer
- Payment Date Range (consolidated)

---

### 2. **Chart Period Toggle - Monthly vs Weekly View**

All trend/time-series charts now include **Monthly/Weekly toggle buttons**:
- Click to switch between monthly and weekly granularity
- Available on:
  - Sales Revenue Trend
  - Price Composition Trend
  - Sales Revenue Trend (YoY)
  - Invoice vs Payment Trend
  - Invoice Trend YoY
  - Invoice vs Payment Monthly Trend

#### Implementation
- Buttons positioned in chart header
- Blue button = selected period
- Gray button = unselected period
- Smooth toggle interaction

---

### 3. **Enhanced KPI Cards**

#### Sales Overview (5 Cards)
1. Total Quotation
2. Total Project
3. Total Sales
4. **Collection Rate (NEW)** - Percentage of invoiced amount collected
5. **DSO - Days Sales Outstanding (NEW)** - Average days to collect payment

#### Invoice & Receivables (5 Cards)
1. Total Outstanding
2. Paid This Month
3. Overdue Count
4. **DSO (Days)** - Average collection cycle
5. **Collection Rate** - Overall collection performance

#### Payments Collection (5 Cards)
1. Total Paid
2. Pending Payments
3. **Collection Rate**
4. **DSO (Days)**
5. Total Outstanding

---

### 4. **New Calculation Hooks**

Added to `/lib/hooks.ts`:

#### `useDSO(invoices: Invoice[]): number`
- Calculates Days Sales Outstanding
- Average days from invoice date to payment date
- Only includes paid invoices
- Returns: integer (days)

#### `useCollectionRate(invoices: Invoice[]): string`
- Calculates collection rate percentage
- (Total Collected / Total Invoiced) × 100
- Returns: string with 1 decimal place (e.g., "49.2%")

#### `useUninvoicedAmount(invoices, projects): number`
- Calculates projected uninvoiced revenue
- For future implementation
- Returns: amount in Rupiah

---

### 5. **New Reusable Components**

#### DateRangeFilter Component
```typescript
<DateRangeFilter
  label="Invoice Date Range"
  startDate={dateRange[0]}
  endDate={dateRange[1]}
  onStartDateChange={(date) => setDateRange([date, dateRange[1]])}
  onEndDateChange={(date) => setDateRange([dateRange[0], date])}
  onClear={() => setDateRange([null, null])}
/>
```
- Consolidated date range input (from → to)
- Clear button for quick reset
- Full-width layout option

#### ChartPeriodToggle Component
```typescript
<ChartPeriodToggle 
  period={chartPeriod} 
  onPeriodChange={setChartPeriod} 
/>
```
- Monthly/Weekly toggle buttons
- Active state highlighting
- Easy integration with charts

---

### 6. **Visual Improvements**

- **Consistent spacing** across all dashboards
- **Improved visual hierarchy** - filters → KPI cards → charts → tables
- **Color-coded KPI cards**:
  - Green: Positive metrics (Paid, Completed, Collection Rate)
  - Blue: Neutral metrics (Total amounts, DSO)
  - Amber: Warning metrics (Outstanding, Pending)
  - Red: Critical metrics (Overdue)
- **Better responsive design** - filters collapse on mobile
- **Cleaner typography** with proper font weights and sizes

---

## Technical Details

### File Changes
1. `/app/dashboard/sales/page.tsx` - Complete redesign
2. `/app/dashboard/invoices/page.tsx` - Top filters, simplified date inputs, enhanced KPIs
3. `/app/dashboard/payments/page.tsx` - Top filters, simplified date inputs, enhanced KPIs
4. `/components/date-range-filter.tsx` - NEW reusable component
5. `/components/chart-period-toggle.tsx` - NEW reusable component
6. `/lib/hooks.ts` - Added DSO, Collection Rate, Uninvoiced Amount calculations

### State Management
- Date ranges now use single `[Date | null, Date | null]` tuple
- Chart period state (`'monthly' | 'weekly'`) added to all dashboard pages
- Filter logic state managed locally on each page

---

## Data Flow

```
Filters (top section)
    ↓
KPI Summary Cards
    ↓
Charts with Period Toggle (Monthly/Weekly)
    ↓
Detailed Tables with Filtered Data
    ↓
Customer/Payment Summary Tables
```

---

## Browser Compatibility

- Chrome/Edge (latest) ✓
- Firefox (latest) ✓
- Safari (latest) ✓
- Mobile browsers ✓

---

## Future Enhancements

- Save preferred chart period to localStorage
- Add date range presets (This Month, Last Quarter, etc.)
- Export charts as images/PDF
- Animated transitions between monthly/weekly views
- Custom date range picker component (replacing browser date input)
- Advanced DSO forecasting
- Collection rate trends over time

