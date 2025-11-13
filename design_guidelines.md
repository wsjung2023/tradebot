# Design Guidelines: Kiwoom AI Trading Platform

## Design Approach

**System Selected**: Material Design with Financial Dashboard customization

**Rationale**: Professional trading platform requiring data density, real-time updates, and enterprise-grade reliability. Drawing inspiration from Bloomberg Terminal, TradingView, and Kiwoom HTS for familiar Korean user experience.

**Core Principles**:
1. Data clarity over decoration
2. Scannable information hierarchy
3. Instant visual feedback for market changes
4. Professional credibility through restraint

---

## Typography System

**Font Stack**:
- Primary: 'Pretendard' (Korean optimization) or 'Inter' (fallback)
- Monospace: 'JetBrains Mono' (for prices, codes, numbers)

**Hierarchy**:
- Dashboard Title: text-2xl font-bold
- Section Headers: text-lg font-semibold
- Data Labels: text-sm font-medium
- Primary Data (prices): text-base font-mono font-semibold
- Secondary Data: text-sm font-mono
- Captions/Meta: text-xs

**Critical**: All numerical data (prices, volumes, percentages) use monospace font for alignment.

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8** exclusively
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4
- Dense areas (order book): p-2, space-y-2

**Grid Structure**:
- Main Layout: 3-column desktop (sidebar-main-panel)
- Dashboard Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Charts: Full-width in main area (min-height-[500px])
- Tables: Full-width with horizontal scroll

**Container Widths**:
- Sidebar: w-64 (navigation)
- Main Content: flex-1 max-w-none
- Right Panel: w-80 (watchlist/orders) - collapsible on mobile

---

## Component Library

### Navigation
**Top Bar** (fixed, h-16):
- Logo + App name (left)
- Account balance summary (center) - prominent display
- User menu + mode toggle [Mock/Real] (right)
- Real-time connection status indicator

**Left Sidebar** (w-64, sticky):
- Dashboard
- Trading (with sub-items: Market, Orders, History)
- Analysis (Charts, Indicators, AI Insights)
- Portfolio
- Settings
- Minimal icons + text labels

### Data Display

**Price Cards**:
- Large monospace numbers
- Clear increase/decrease indicators (▲▼ symbols)
- Percentage change badges
- Sparkline mini-charts (optional context)

**Order Book/Hoga Table**:
- Split layout: Sell orders (top) / Buy orders (bottom)
- 10-level depth display
- Right-aligned prices (monospace)
- Left-aligned quantities
- Row hover states for interaction

**Chart Component**:
- Full-featured candlestick/line charts
- Multiple timeframe tabs (1m, 5m, 15m, 1h, 1d)
- Overlay indicators (MA lines, Bollinger Bands)
- Bottom panel for volume bars
- Technical indicator sub-charts (RSI, MACD) below main chart
- Drawing tools toolbar (minimal, icon-based)

**Data Tables**:
- Striped rows for readability
- Sortable headers with visual indicators
- Fixed header on scroll
- Row selection for bulk actions
- Dense spacing (py-2 per row)

### Forms & Controls

**Order Entry Panel**:
- Tabbed interface: Market / Limit / Conditional
- Prominent price input (large, centered)
- Quantity input with +/- steppers
- Buy/Sell action buttons (full-width, distinct)
- Order summary (calculated total)
- Submit button (prominent, bottom)

**Search & Filters**:
- Autocomplete stock search (top of trading view)
- Filter chips for quick selections
- Advanced filter drawer (slide-in from right)

**Authentication**:
- Clean, centered login form
- Social login buttons (Google, Kakao, Naver) with brand icons
- Email/password fields with validation
- "Mock Trading" vs "Real Account" mode selector on login

### Dashboards

**Main Dashboard Layout**:
- Top row: Key metrics cards (4 across) - Account Value, Today's P&L, Total Return, Win Rate
- Second row: Portfolio allocation chart (left 2/3) + Top movers list (right 1/3)
- Third row: Recent trades table (full-width)
- Fourth row: AI recommendations cards (grid)

**Trading Dashboard**:
- Left 2/3: Main chart with indicators
- Right 1/3: Order book (top) + Recent trades (bottom)
- Bottom panel: Order entry form (expandable)

**Analysis Dashboard**:
- Multi-chart layout (grid-cols-2)
- Condition scanner results (table)
- AI pattern recognition insights (cards)
- Backtesting results (charts + metrics)

---

## Interaction Patterns

**Real-time Updates**:
- Subtle flash animations on price changes (no color, just opacity pulse)
- WebSocket connection indicator (subtle dot in top bar)
- Live updating without page refresh

**Responsive Behavior**:
- Desktop: 3-column layout with all panels visible
- Tablet: 2-column, collapsible right panel
- Mobile: Single column, bottom navigation tabs, swipeable panels

**Loading States**:
- Skeleton screens for charts (no spinners)
- Progressive loading for tables
- Shimmer effect for updating data

---

## Visual Hierarchy

**Information Density**:
- Dense mode for tables (toggle available)
- Compact card layouts with clear borders
- Generous whitespace only around primary actions

**Focus Areas**:
- Current price: Largest, most prominent
- Buy/Sell buttons: High contrast, impossible to miss
- Critical alerts (margin calls): Distinct styling without relying on color

**Depth Cues**:
- Subtle shadows: shadow-sm for cards, shadow-md for modals
- Borders: border for containers, divide-y for lists
- Elevation: Modals (z-50), Dropdowns (z-40), Fixed headers (z-30)

---

## Accessibility

- High contrast ratios for all text (maintain WCAG AA)
- Keyboard navigation for all trading functions (critical for speed)
- Screen reader labels for chart data points
- Focus indicators (ring-2 ring-offset-2)
- Distinct visual markers beyond color (icons, patterns, labels)

---

## Mobile Considerations

**PWA Features**:
- Bottom tab navigation (5 tabs max)
- Swipeable chart timeframes
- Pull-to-refresh for data
- Offline chart viewing (cached data)
- Push notifications for price alerts

**Touch Optimization**:
- Minimum touch target: 44px (h-11, min-h-11)
- Spacious tap areas for order buttons
- Swipe gestures for quick actions (watchlist management)

---

This design creates a professional, data-dense trading platform that prioritizes function over form while maintaining visual polish. The system is scalable, accessible, and optimized for the high-stakes environment of stock trading.