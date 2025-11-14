# 키움 AI 자동매매 플랫폼

## Overview
The Kiwoom AI Automatic Trading Platform is a professional-grade, AI-powered automated trading platform leveraging Kiwoom Securities REST API and OpenAI GPT-4. It offers real-time trading, AI-driven investment analysis, and automated trading recommendations. The platform targets commercial quality, featuring robust authentication, real-time WebSocket market data, PWA support, and mobile optimization. Its core purpose is to provide an advanced, AI-driven solution for automated stock trading and investment analysis, aiming for high reliability and user experience.

## User Preferences
- 자세한 설명을 선호합니다
- 반복적 개발을 원합니다
- 주요 변경 전 확인 필요
- 폴더 Z 변경 금지
- 파일 Y 변경 금지

## System Architecture

### UI/UX Decisions
The platform utilizes the "Neo-Fintech Storm UI" design system with a cyberpunk color palette (neon cyan/purple/green/red). It incorporates dynamic visual feedback through CSS animations like `gradient-flow`, `pulse-glow`, `price-pulse`, and `float-particle`. Design elements include glassmorphism cards, neon glow effects for text and borders, and gradient texts. Accessibility for `prefers-reduced-motion` is also supported.

### Technical Implementations

#### Backend
- **Framework**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) for data storage and session management
- **Authentication**: Passport.js (Local, Google/Kakao OAuth)
- **ORM**: Drizzle ORM
- **Real-time**: WebSocket for market data

#### Frontend
- **Framework**: React + TypeScript + Vite
- **Routing**: Wouter
- **State Management**: TanStack Query (server state)
- **UI Components**: Shadcn UI
- **Styling**: Tailwind CSS

#### Database Schema
Key tables include `users`, `kiwoom_accounts`, `holdings`, `orders`, `ai_models`, `ai_recommendations`, `watchlist`, `alerts`, `user_settings`, `trading_logs`, `condition_formulas`, `condition_results`, `chart_formulas`, `watchlist_signals`, `financial_snapshots`, `market_issues`, `auto_trading_settings`, `trading_performance`.

#### API Endpoints
Endpoints cover authentication, account management, order execution, stock information (real-time quotes, charts, financials), AI analysis, watchlist management, user settings, trading logs, and condition search functionalities.

#### AI Analysis
GPT-4 is used for stock analysis, portfolio optimization, and reliability scoring, integrating financial statements, liquidity, Rainbow Chart analysis, theme analysis, news analysis, and institutional investor tracking.

#### Automated Trading
Supports CRUD operations for AI models, activation/deactivation, recommendation generation, and automated execution based on 10-line Rainbow Chart strategies. A learning system analyzes trading performance, learns successful/failed patterns, and auto-optimizes AI model parameters daily.

#### Real-time System
Utilizes WebSockets for real-time market data with resilience features like exponential backoff and heartbeats.

#### PWA
`manifest.json` and service workers enable offline support, caching strategies (Network-first for API, Cache-first for static assets), and automatic updates.

#### Security
Session-based authentication (PostgreSQL storage), CSRF protection, AES-256-GCM encryption for API keys, rate limiting, and security headers (helmet.js) for XSS/clickjacking defense and HTTPS enforcement are implemented.

#### Conditional Search System
**Backend**: Features a formula parsing and evaluation engine, chart signal generation, financial data fetching, and market issue tracking.
**Frontend**: Provides a UI for managing conditions, real-time screening, a chart signal watchlist, and a condition editor.

#### Rainbow Chart System
Implements a 10-line Rainbow Chart based on 2-year high/low prices. Line 5 represents the exact 50% retracement (PRIMARY BUY ZONE). The system identifies primary buy/sell zones and generates automated recommendations (strong-buy, buy, sell, strong-sell).

### Feature Specifications
- **User Authentication**: Local email/password, Google OAuth, Kakao OAuth.
- **Kiwoom Account Integration**: CRUD operations, balance/holdings inquiry.
- **Real-time Dashboard**: Portfolio pie chart, 30-day asset trend.
- **Trading Interface**: Real-time quotes, daily charts, 10-level order book, order panel.
- **AI Analysis Dashboard**: GPT-4 stock analysis, portfolio optimization, reliability score.
- **Automated Trading System**: AI model CRUD, activation/deactivation, recommendation generation, learning system.
- **Trade History & Logs**: Order/execution details, trading logs, statistical dashboard.
- **Watchlist & Price Alerts**.
- **PWA Mobile Optimization**.

## External Dependencies
- **Kiwoom Securities REST API**: Stock trading and market data.
- **OpenAI API (GPT-4)**: AI-based investment analysis.
- **Google OAuth**: User authentication.
- **Kakao OAuth**: User authentication.
- **Neon (PostgreSQL)**: Managed PostgreSQL database.