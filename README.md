# Sales Dashboard with Invoice & Payment Management

A comprehensive business dashboard featuring Google OAuth authentication, real-time sales analytics, and detailed invoice/payment tracking.

## Features

### 1. **Authentication**
- Google OAuth sign-in with email validation against authorized users
- Session management with localStorage persistence
- Protected dashboard routes with automatic redirection to login

### 2. **Sales Overview Dashboard**
- **KPI Cards**: Monitor key metrics
  - Total Quotations (count)
  - Total Projects (count)
  - Total Sales (including tax)
  - Total Material Price
  - Total Service Price
  
- **Charts & Analytics**
  - Sales Revenue Trend (line chart)
  - Sales by Type breakdown (pie chart)
  - Price Composition Trend (stacked bar chart)
  
- **Data Tables**
  - Top Projects with customer and status
  - Top Sales Persons with performance metrics
  - Sales Summary by type with win rates

### 3. **Invoice & Payment Dashboard**
- **Summary Cards**
  - Total Outstanding Amount
  - Paid This Month
  - Overdue Invoices Count
  - Total Invoiced Amount
  
- **Filters**
  - Payment Status (All/Paid/Due/Overdue)
  - Customer (per-customer filtering)
  - Quick reset filter button
  
- **Invoice Table**
  - Invoice Number
  - Customer Name
  - Invoice Date
  - Due Date
  - Amount (formatted in Rupiah)
  - Payment Status (with color-coded badges)
  - Payment Date
  - Payment Method
  - Notes/Description
  - Overdue indicator (days overdue)
  
- **Customer Payment Summary**
  - Per-customer totals
  - Invoiced vs. Paid vs. Outstanding breakdown
  - Overdue amount per customer
  - Color-coded amounts (green for paid, orange for outstanding, red for overdue)

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Authentication**: @react-oauth/google with email validation
- **Charts**: Recharts for data visualization
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Data Management**: Custom React hooks with TypeScript
- **UI Components**: shadcn/ui

## Project Structure

```
app/
├── layout.tsx                    # Root layout with OAuth & Auth providers
├── page.tsx                      # Home page (redirects to login)
├── login/
│   └── page.tsx                  # Google OAuth login page
└── dashboard/
    ├── layout.tsx                # Dashboard sidebar & navigation
    ├── sales/
    │   └── page.tsx              # Sales Overview dashboard
    └── invoices/
        └── page.tsx              # Invoice & Payment dashboard

lib/
├── types.ts                      # TypeScript type definitions
├── hooks.ts                      # Custom React hooks for data management
├── auth-context.tsx              # Authentication context provider
└── utils.ts                      # Utility functions

components/
├── kpi-card.tsx                  # KPI card component
└── status-badge.tsx              # Status badge with color coding
```

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

**How to get Google Client ID:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Select "Web Application"
6. Add your domain to Authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
7. Copy the Client ID and paste it in `.env.local`

### 2. Authorized Users

The login page validates users against a predefined list. To add authorized users, edit `/app/login/page.tsx`:

```typescript
const ALLOWED_USERS = [
  'user1@example.com',
  'user2@example.com',
  'admin@example.com',
  'test@gmail.com',
]
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Mode

For testing without Google OAuth setup, use the **Quick Login (Dev)** button on the login page to quickly log in with test credentials.

## Data Structure

### Invoice Data
All invoice and sales data is managed through custom hooks in `lib/hooks.ts`. The data layer is structured for easy integration with:
- Google Sheets (via Sheets API)
- Backend APIs
- Databases (Neon, Supabase, etc.)

### Mock Data
The application comes with comprehensive mock data:
- 6 sample invoices with various statuses (paid, due, overdue)
- 5 customers with payment histories
- 5 sales projects with project details
- 5 top-performing sales persons
- Sales analytics data with trends

To replace mock data with real data, update the hooks in `lib/hooks.ts`.

## Customization

### Adding New Customers
Edit mock customers in `lib/hooks.ts`:
```typescript
const mockCustomers: Customer[] = [
  { id: '6', name: 'New Company', email: 'info@newcompany.com', phone: '+62-21-123-4567' },
  // ...
]
```

### Modifying Chart Data
Update the `useSalesData()` hook to include your actual sales metrics.

### Changing Currency
The app uses Indonesian Rupiah (Rp) by default. To change:
1. Update currency formatting in table cells
2. Modify the `formatCurrency()` function in invoice page
3. Update KPI card formatting

## Features Coming Soon

- Export invoices to PDF
- Email notifications for overdue invoices
- Advanced filtering and date range selection
- Dashboard customization
- Multi-language support
- Dark mode

## Troubleshooting

### Login Not Working
- Ensure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly
- Check that your email is in the `ALLOWED_USERS` list
- Verify browser cookies are enabled

### Dashboard Not Displaying
- Clear localStorage: `localStorage.clear()`
- Log out and log back in
- Check browser console for errors (F12)

### Charts Not Rendering
- Ensure Recharts dependency is installed: `pnpm ls recharts`
- Check browser console for rendering errors
- Try clearing browser cache

## Production Deployment

1. Set environment variables in your hosting platform (Vercel, etc.)
2. Update Google OAuth authorized domains
3. Replace mock data with real database/API connections
4. Configure proper error handling and logging
5. Set up SSL/HTTPS for secure data transmission
6. Enable CORS properly if using external APIs

## License

This project is part of the Vercel v0 demonstration.
