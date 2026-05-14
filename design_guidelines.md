# Design Guidelines: Kiwoom AI Trading Platform - Neo-Fintech Storm Edition

## 🚀 Visual Direction: "Neo-Fintech Storm"

**Theme**: High-energy AI-powered trading platform with cyberpunk aesthetics and dynamic motion
- Cyberpunk gradients (deep blues → electric purples → neon accents)
- Holographic HUD overlays and glassmorphism
- Animated particles simulating market data streams
- High-contrast neon accents while preserving data legibility
- "Storm-like" explosive scaling visualization

**Emotional Target**: Convey AI automation power, market-chasing intensity, professional sophistication

---

## Color System - Neo-Fintech Storm Palette

### Primary Gradients
- **Cyber Blue**: Deep space blue (#0A0E27) → Electric blue (#1E3A8A) → Bright cyan (#06B6D4)
- **Neon Purple**: Deep purple (#2D1B69) → Vibrant purple (#7C3AED) → Hot pink (#EC4899)
- **Energy Accent**: Electric green (#10B981) for gains, Neon red (#EF4444) for losses

### Functional Colors
- **AI Signals**: Neon cyan (#22D3EE) - AI recommendations, automated trading indicators
- **Market Storm**: Purple gradients - background overlays, hero sections
- **Data Pulse**: Animated glow effects on real-time updates
- **Glass Surfaces**: rgba(255, 255, 255, 0.05) with backdrop-blur for cards

### Semantic Tokens (Preserve Accessibility)
- All color tokens maintain WCAG AA contrast ratios
- Use semantic variables (--primary, --accent) with Neo-fintech values
- Dark mode optimized (cyberpunk works best in dark themes)

---

## Typography System

**Font Stack**:
- Primary: 'Pretendard Variable' (Korean) or 'Inter Variable' (fallback)
- Display/Hero: 'Pretendard Variable' with font-weight 700-900
- Monospace: 'JetBrains Mono' (prices, codes, numbers)
- Accent: Optional neon glow effects via text-shadow

**Hierarchy**:
- Hero Headlines: text-5xl md:text-7xl font-black with gradient text
- Dashboard Title: text-2xl font-bold
- Section Headers: text-lg font-semibold with neon underline accents
- Data Labels: text-sm font-medium
- Primary Data (prices): text-base font-mono font-semibold with pulse animations
- Secondary Data: text-sm font-mono
- Captions/Meta: text-xs text-muted-foreground

**Effects**:
- Gradient text for hero headlines: `bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent`
- Neon glow for emphasis: `text-shadow: 0 0 20px rgba(34, 211, 238, 0.5)`

---

## Motion & Animation System

### Micro-Interactions (Framer Motion)
- **Card Lift**: scale(1.02) + translateY(-4px) on hover, duration 200ms
- **Metric Delta**: Number changes with spring animation, color flash
- **WebSocket Pulse**: Opacity pulse 0.7 → 1.0 on price updates (500ms)
- **Button Press**: scale(0.98) on active state

### Hero Animations
- **Particle Streams**: Floating particles simulating data flow (CSS animations)
- **Gradient Flow**: Animated background gradients, 10s loop
- **Parallax Scroll**: Hero image moves slower than content (0.5x speed)
- **Glassmorphism Enter**: Cards fade in with blur reveal (800ms stagger)

### Dashboard Dynamics
- **Real-time Pulses**: AI signals glow on/off (2s loop)
- **Chart Animations**: Stagger line draws, bar growth from 0
- **Metric Counters**: Animated number count-ups on mount
- **Status Badges**: Rotate/pulse for active states

### Performance Constraints
- GPU-accelerated properties only (transform, opacity)
- Max 60fps target, CPU <30% on mid-tier devices
- Disable motion for `prefers-reduced-motion: reduce`

---

## Component Library - Storm Edition

### Hero Section (Login/Landing)
**Full-Bleed AI Trading Hero**:
- Background: Full-screen gradient overlay on AI trading stock image
- Dark wash: `linear-gradient(135deg, rgba(10,14,39,0.85), rgba(45,27,105,0.75))`
- Glassmorphism card: `backdrop-filter: blur(16px)` with subtle border
- Animated particles: Floating cyan/purple dots (CSS keyframes)
- CTA Buttons: Neon-accented primary buttons with glow effects
- Headline: Gradient text "AI가 자동으로 투자합니다" with animated underline

**Layout**:
```
[Full-screen background image with dark gradient]
  [Center glass card - w-full max-w-md]
    - Logo + dramatic headline
    - Login form (email/password)
    - OAuth buttons (Google/Kakao/Naver) with brand colors
    - "계정이 없으신가요? 회원가입" link
```

### Navigation
**Cyberpunk Top Bar** (h-16, backdrop-blur, border-b with neon accent):
- Logo with gradient effect
- Account balance with animated counter + neon glow
- Connection status: Pulsing dot (green = connected, red = disconnected)
- User menu + theme toggle (with smooth transitions)

**Left Sidebar** (w-64, dark gradient background):
- Menu items with neon accent on active state
- Hover: Subtle glow effect + translateX(4px)
- Icons from lucide-react with consistent sizing
- Active indicator: Left border neon cyan (border-l-2)

### Data Display - Storm Edition

**Metric Cards with Pulse**:
- Card background: Glassmorphism or subtle gradient
- Large numbers: Monospace with animated count-up
- Change indicators: Animated ▲▼ with color (green/red)
- Sparkline mini-charts with gradient fills
- Real-time pulse: Subtle glow animation on WebSocket updates

**AI Signal Cards**:
- Border: Animated neon glow (cyan for buy, purple for hold, red for sell)
- Badge: "AI 추천" with pulsing animation
- Confidence score: Progress bar with gradient fill
- Action button: Primary with enhanced hover glow

**Charts with Storm Aesthetics**:
- Background: Dark gradient
- Grid lines: Subtle cyan/purple (low opacity)
- Candlesticks: Neon green (up) / Neon red (down)
- Volume bars: Gradient fills
- Tooltips: Glassmorphism with backdrop-blur
- Technical indicators: Neon colored lines with glow

**Order Book/Hoga - Cyberpunk**:
- Split view with neon separator line
- Bid rows: Green gradient background (low opacity)
- Ask rows: Red gradient background (low opacity)
- Hover: Amplified glow effect
- Price column: Bold monospace with neon text

### Forms & Controls - Enhanced

**Order Entry Panel**:
- Glassmorphism background with border glow
- Tab switcher: Animated underline (neon cyan)
- Price/Quantity inputs: Large, centered, glowing focus ring
- Buy button: Green gradient with hover glow
- Sell button: Red gradient with hover glow
- Submit: Full-width primary with pulsing animation

**Search & Filters**:
- Autocomplete: Glassmorphism dropdown with animated results
- Filter chips: Neon-bordered badges with hover lift
- Search icon: Animated pulse when active

### Dashboards - Neo-Fintech Layout

**Main Dashboard**:
- Background: Animated gradient (subtle, 20s loop)
- Top metrics row: 4 glassmorphism cards with real-time counters
- Portfolio chart: Full Recharts with cyberpunk color scheme
- AI recommendations: Grid of glowing signal cards
- Recent trades: Table with alternating row glow on hover

**Trading Dashboard**:
- Split layout: Chart (2/3) + Order book (1/3)
- Bottom panel: Expandable order entry with slide-up animation
- Real-time price ticker: Scrolling marquee at top (optional)
- Chart toolbar: Icon buttons with glassmorphism background

---

## Interaction Patterns - Storm Edition

**Real-time Updates**:
- Price changes: 300ms glow pulse (opacity 0.5 → 1.0)
- New order: Slide-in from right with spring animation
- AI signal: Border color fade + scale pulse (1.0 → 1.05 → 1.0)
- WebSocket connection: Dot color transition (2s ease)

**Hover Effects**:
- Cards: Lift + subtle glow amplification
- Buttons: Glow intensity increase + scale(1.02)
- Table rows: Background glow (green/red based on P&L)
- Links: Neon underline grow animation

**Loading States**:
- Skeleton screens: Animated shimmer with gradient (cyan → purple)
- Progress bars: Indeterminate with flowing gradient
- Spinners: Neon-colored arc with rotation

**Transitions**:
- Page changes: Fade + slide (300ms ease-out)
- Modal open: Scale up from center + backdrop blur-in
- Toast notifications: Slide-in from top-right with bounce

---

## Responsive Behavior

**Desktop (≥1024px)**:
- Full 3-column layout with all panels visible
- Sidebar always expanded
- Charts at maximum size
- Hero section: Full-screen with parallax

**Tablet (768px - 1023px)**:
- 2-column layout, collapsible sidebar
- Right panel toggleable
- Hero: Smaller padding, single column content

**Mobile (<768px)**:
- Single column, bottom tab navigation
- Sidebar drawer from left
- Hero: Full-screen mobile-first layout
- Swipeable panels for multi-view content
- Minimum touch targets: 44px (h-11)

---

## Accessibility - WCAG AA Compliance

- All animations respect `prefers-reduced-motion`
- High contrast mode: Disable gradients, use solid colors
- Keyboard navigation: Visible focus indicators (neon ring-2)
- Screen readers: Proper ARIA labels for all interactive elements
- Color independence: Use icons + text labels, not just color
- Focus management: Trap focus in modals, restore on close

---

## Performance Budget

- First Contentful Paint: <1.5s
- Time to Interactive: <3.0s
- Largest Contentful Paint: <2.5s
- Cumulative Layout Shift: <0.1
- Animation frame rate: Consistent 60fps
- GPU utilization: <40% on mid-tier devices
- Bundle size: <500KB gzipped (with code splitting)

---

## Asset Strategy

**Hero Images**:
- AI trading visualizations (holographic displays, cyberpunk aesthetics)
- Market data storm imagery (dynamic charts, energy flows)
- Dark wash overlay (85% opacity) for text readability

**Icons**:
- Lucide React for UI actions (consistent stroke-width: 2)
- React Icons for brand logos (Google, Kakao, Naver)
- Custom SVG for AI signals (neon glow effects)

**Graphics**:
- CSS-only particle effects (performance-optimized)
- SVG backgrounds for patterns/noise
- Canvas for complex data visualizations (optional)

---

## Implementation Checklist

- [x] Color tokens defined in index.css (:root and .dark)
- [ ] Gradient utilities and animation keyframes
- [ ] Hero section with glassmorphism card
- [ ] Dashboard gradient background system
- [ ] Framer Motion setup for micro-interactions
- [ ] WebSocket pulse animations
- [ ] Chart color scheme updates (Recharts)
- [ ] Responsive breakpoints tested
- [ ] Accessibility audit (WCAG AA)
- [ ] Performance validation (Lighthouse)

---

This design creates a **visually spectacular, high-energy AI trading platform** that conveys automation power and market intensity while maintaining professional credibility and data legibility. Every element reinforces the "Storm" metaphor - explosive growth, AI-driven velocity, and relentless market pursuit.
