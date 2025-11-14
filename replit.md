# 키움 AI 자동매매 플랫폼

## Overview
This project is a professional AI-powered automated trading platform that leverages Kiwoom Securities REST API and OpenAI GPT-4. Its purpose is to provide real-time trading capabilities, AI-driven investment analysis, and automated trading recommendations. The platform aims for commercial-grade quality, featuring robust authentication, real-time WebSocket market data, PWA support, and mobile optimization.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to folder Z.
Do not make changes to file Y.

## System Architecture

### UI/UX Decisions
The platform utilizes a "Neo-Fintech Storm UI" design system with a cyberpunk color palette (neon cyan/purple/green/red). It incorporates CSS animations such as `gradient-flow`, `pulse-glow`, `price-pulse`, and `float-particle` for dynamic visual feedback. Design elements include glassmorphism cards, neon glow effects for text and borders, and gradient text. Accessibility for `prefers-reduced-motion` is supported.

### Technical Implementations
-   **Backend**: Node.js with Express and TypeScript, PostgreSQL (Neon) for data storage and session management, Passport.js for multi-factor authentication (Local, Google/Kakao OAuth), Drizzle ORM, and WebSockets for real-time market data.
-   **Frontend**: React with TypeScript, Vite, Wouter for routing, TanStack Query for server state management, Shadcn UI for components, and Tailwind CSS for styling.
-   **Database Schema**: Key tables include `users`, `kiwoom_accounts`, `holdings`, `orders`, `ai_models`, `ai_recommendations`, `watchlist`, `alerts`, `user_settings`, `trading_logs`, `condition_formulas`, `condition_results`, `chart_formulas`, `watchlist_signals`, `financial_snapshots`, and `market_issues`.
-   **API Endpoints**: Comprehensive API endpoints cover authentication, account management, order placement, stock information, AI analysis, watchlist, alerts, user settings, trading logs, condition search, chart formulas, and financial data.
-   **AI Analysis**: Integrates GPT-4 for stock analysis, portfolio optimization, and reliability scoring, incorporating financial statements, liquidity, and rainbow chart analysis.
-   **Automated Trading**: Supports AI model CRUD, activation/deactivation, and recommendation generation.
-   **Real-time Systems**: WebSocket for real-time market data with resilience features (exponential backoff, heartbeats).
-   **PWA**: Configured with `manifest.json` and a service worker for offline support, caching strategies (Network-first for API, Cache-first for static assets), and automatic updates.
-   **Security**: Session-based authentication with PostgreSQL store, CSRF protection, API key encryption (AES-256-GCM), rate limiting, and security headers (helmet.js) for XSS/clickjacking defense and HTTPS enforcement.
-   **Conditional Search System**: Backend includes formula parsing and evaluation engine for chart signals, financial data fetching, and market issue tracking. Frontend provides UI for condition management, real-time screening, chart signal watchlist, and formula editing.
-   **Rainbow Chart System**: Implements a 10-line Rainbow Chart based on 2-year high/low for identifying primary buy/sell zones and generating automated recommendations.

### Feature Specifications
-   User authentication: Local email/password, Google OAuth, Kakao OAuth.
-   Kiwoom account integration: CRUD for accounts, balance/holdings inquiry.
-   Real-time dashboard: Portfolio pie charts, 30-day asset trends.
-   Trading interface: Real-time prices, daily charts, 10-level order book, order panel.
-   AI analysis dashboard: GPT-4 stock analysis, portfolio optimization, reliability scores.
-   Automated trading system: AI model CRUD, activation/deactivation, recommendation generation.
-   Transaction history and logs: Order/execution details, trading logs, statistical dashboard.
-   Watchlist and price alerts.
-   PWA with mobile optimization.

## External Dependencies
-   **Kiwoom Securities REST API**: For stock trading and market data.
-   **OpenAI API (GPT-4)**: For AI-powered investment analysis.
-   **Google OAuth**: For user authentication.
-   **Kakao OAuth**: For user authentication.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database for data storage and session management.