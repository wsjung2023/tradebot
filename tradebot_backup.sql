--
-- PostgreSQL database dump
--

\restrict jJikasgkFe02BQT77wmxGWuuh0YPuHIejhc995K5igrjl4wAoBGraxicaRW0MPb

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_council_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_council_sessions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    session_data jsonb NOT NULL,
    final_action text,
    final_confidence numeric(5,2),
    target_price numeric(12,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_council_sessions OWNER TO postgres;

--
-- Name: ai_council_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_council_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_council_sessions_id_seq OWNER TO postgres;

--
-- Name: ai_council_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_council_sessions_id_seq OWNED BY public.ai_council_sessions.id;


--
-- Name: ai_model_specs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_model_specs (
    id integer NOT NULL,
    model_id text NOT NULL,
    provider text NOT NULL,
    display_name text NOT NULL,
    strengths jsonb DEFAULT '[]'::jsonb NOT NULL,
    best_for jsonb DEFAULT '[]'::jsonb NOT NULL,
    context_window integer,
    input_cost_per_1m numeric(10,6),
    output_cost_per_1m numeric(10,6),
    speed_tier text,
    reasoning_score integer,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_model_specs OWNER TO postgres;

--
-- Name: ai_model_specs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_model_specs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_model_specs_id_seq OWNER TO postgres;

--
-- Name: ai_model_specs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_model_specs_id_seq OWNED BY public.ai_model_specs.id;


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_models (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    model_name text NOT NULL,
    model_type text NOT NULL,
    description text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    performance jsonb,
    total_trades integer DEFAULT 0 NOT NULL,
    win_rate numeric(5,2),
    total_return numeric(8,4),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_models OWNER TO postgres;

--
-- Name: ai_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_models_id_seq OWNER TO postgres;

--
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- Name: ai_recommendations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_recommendations (
    id integer NOT NULL,
    model_id integer NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    action text NOT NULL,
    confidence numeric(5,2) NOT NULL,
    target_price numeric(12,2),
    reasoning text,
    indicators jsonb,
    is_executed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone
);


ALTER TABLE public.ai_recommendations OWNER TO postgres;

--
-- Name: ai_recommendations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_recommendations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_recommendations_id_seq OWNER TO postgres;

--
-- Name: ai_recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_recommendations_id_seq OWNED BY public.ai_recommendations.id;


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    alert_type text NOT NULL,
    target_value numeric(12,2),
    is_triggered boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    triggered_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: analysis_material_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_material_snapshots (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    corp_code text,
    financial_summary jsonb,
    market_issues jsonb,
    filing_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    news_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    collected_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_material_snapshots OWNER TO postgres;

--
-- Name: analysis_material_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analysis_material_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analysis_material_snapshots_id_seq OWNER TO postgres;

--
-- Name: analysis_material_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analysis_material_snapshots_id_seq OWNED BY public.analysis_material_snapshots.id;


--
-- Name: auto_trading_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auto_trading_settings (
    id integer NOT NULL,
    model_id integer NOT NULL,
    default_position_size numeric(12,2) DEFAULT 1000000 NOT NULL,
    max_position_size numeric(12,2) DEFAULT 10000000 NOT NULL,
    max_daily_trades integer DEFAULT 5 NOT NULL,
    rainbow_line_settings jsonb DEFAULT '[]'::jsonb NOT NULL,
    center_buy_line integer DEFAULT 50 NOT NULL,
    min_ai_confidence numeric(5,2) DEFAULT 70 NOT NULL,
    require_good_financials boolean DEFAULT true NOT NULL,
    require_high_liquidity boolean DEFAULT true NOT NULL,
    require_market_issue boolean DEFAULT false NOT NULL,
    theme_weight numeric(5,2) DEFAULT 20 NOT NULL,
    news_weight numeric(5,2) DEFAULT 15 NOT NULL,
    financials_weight numeric(5,2) DEFAULT 25 NOT NULL,
    liquidity_weight numeric(5,2) DEFAULT 20 NOT NULL,
    institutional_weight numeric(5,2) DEFAULT 20 NOT NULL,
    enable_dynamic_exit boolean DEFAULT true NOT NULL,
    stale_period_days integer DEFAULT 5 NOT NULL,
    surge_threshold numeric(5,2) DEFAULT 10 NOT NULL,
    volume_spike_multiplier numeric(5,2) DEFAULT 3 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auto_trading_settings OWNER TO postgres;

--
-- Name: auto_trading_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auto_trading_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auto_trading_settings_id_seq OWNER TO postgres;

--
-- Name: auto_trading_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auto_trading_settings_id_seq OWNED BY public.auto_trading_settings.id;


--
-- Name: chart_formulas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chart_formulas (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    formula_name text NOT NULL,
    formula_type text NOT NULL,
    description text,
    formula_ast jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_formula text NOT NULL,
    output_type text DEFAULT 'line'::text NOT NULL,
    color text,
    line_weight integer DEFAULT 1 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chart_formulas OWNER TO postgres;

--
-- Name: chart_formulas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chart_formulas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chart_formulas_id_seq OWNER TO postgres;

--
-- Name: chart_formulas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chart_formulas_id_seq OWNED BY public.chart_formulas.id;


--
-- Name: company_filings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_filings (
    id integer NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    corp_code text,
    rcept_no text NOT NULL,
    report_nm text NOT NULL,
    flr_nm text,
    rcept_dt text,
    link text,
    source text DEFAULT 'dart'::text NOT NULL,
    payload jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_filings OWNER TO postgres;

--
-- Name: company_filings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.company_filings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_filings_id_seq OWNER TO postgres;

--
-- Name: company_filings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.company_filings_id_seq OWNED BY public.company_filings.id;


--
-- Name: condition_formulas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.condition_formulas (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    condition_name text NOT NULL,
    description text,
    formula_ast jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_formula text,
    market_type text DEFAULT 'ALL'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    is_real_time_monitoring boolean DEFAULT false NOT NULL,
    match_count integer DEFAULT 0 NOT NULL,
    last_matched_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.condition_formulas OWNER TO postgres;

--
-- Name: condition_formulas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.condition_formulas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.condition_formulas_id_seq OWNER TO postgres;

--
-- Name: condition_formulas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.condition_formulas_id_seq OWNED BY public.condition_formulas.id;


--
-- Name: condition_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.condition_results (
    id integer NOT NULL,
    condition_id integer NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    match_score numeric(5,2),
    current_price numeric(12,2),
    volume integer,
    change_rate numeric(8,4),
    is_market_issue boolean DEFAULT false NOT NULL,
    has_good_financials boolean DEFAULT false NOT NULL,
    has_high_liquidity boolean DEFAULT false NOT NULL,
    passed_filters boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.condition_results OWNER TO postgres;

--
-- Name: condition_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.condition_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.condition_results_id_seq OWNER TO postgres;

--
-- Name: condition_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.condition_results_id_seq OWNED BY public.condition_results.id;


--
-- Name: entry_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entry_points (
    id integer NOT NULL,
    council_session_id integer,
    stock_code text NOT NULL,
    entry_price numeric(12,2),
    stop_loss numeric(12,2),
    take_profit numeric(12,2),
    position_size integer,
    signal_confluence integer,
    executed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entry_points OWNER TO postgres;

--
-- Name: entry_points_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entry_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entry_points_id_seq OWNER TO postgres;

--
-- Name: entry_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entry_points_id_seq OWNED BY public.entry_points.id;


--
-- Name: financial_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financial_snapshots (
    id integer NOT NULL,
    stock_code text NOT NULL,
    fiscal_year integer NOT NULL,
    revenue numeric(16,2),
    operating_profit numeric(16,2),
    net_income numeric(16,2),
    total_assets numeric(16,2),
    total_liabilities numeric(16,2),
    total_equity numeric(16,2),
    debt_ratio numeric(8,4),
    roe numeric(8,4),
    roa numeric(8,4),
    is_healthy boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.financial_snapshots OWNER TO postgres;

--
-- Name: financial_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.financial_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.financial_snapshots_id_seq OWNER TO postgres;

--
-- Name: financial_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.financial_snapshots_id_seq OWNED BY public.financial_snapshots.id;


--
-- Name: holdings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.holdings (
    id integer NOT NULL,
    account_id integer NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    quantity integer NOT NULL,
    average_price numeric(12,2) NOT NULL,
    current_price numeric(12,2),
    profit_loss numeric(12,2),
    profit_loss_rate numeric(8,4),
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.holdings OWNER TO postgres;

--
-- Name: holdings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.holdings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.holdings_id_seq OWNER TO postgres;

--
-- Name: holdings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.holdings_id_seq OWNED BY public.holdings.id;


--
-- Name: kiwoom_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kiwoom_accounts (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    account_number text NOT NULL,
    account_type text NOT NULL,
    account_name text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kiwoom_accounts OWNER TO postgres;

--
-- Name: kiwoom_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kiwoom_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kiwoom_accounts_id_seq OWNER TO postgres;

--
-- Name: kiwoom_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kiwoom_accounts_id_seq OWNED BY public.kiwoom_accounts.id;


--
-- Name: learning_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.learning_records (
    id integer NOT NULL,
    model_id integer NOT NULL,
    period_start timestamp without time zone,
    period_end timestamp without time zone,
    total_trades integer,
    win_rate numeric(5,2),
    avg_return numeric(8,4),
    pattern_insights jsonb,
    applied_changes jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.learning_records OWNER TO postgres;

--
-- Name: learning_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.learning_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.learning_records_id_seq OWNER TO postgres;

--
-- Name: learning_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.learning_records_id_seq OWNED BY public.learning_records.id;


--
-- Name: market_issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_issues (
    id integer NOT NULL,
    issue_date text NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    issue_type text NOT NULL,
    issue_title text,
    issue_description text,
    impact_level text DEFAULT 'medium'::text NOT NULL,
    related_theme text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.market_issues OWNER TO postgres;

--
-- Name: market_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.market_issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.market_issues_id_seq OWNER TO postgres;

--
-- Name: market_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.market_issues_id_seq OWNED BY public.market_issues.id;


--
-- Name: news_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_articles (
    id integer NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    title text NOT NULL,
    description text,
    link text NOT NULL,
    source text,
    sentiment text DEFAULT 'neutral'::text NOT NULL,
    published_at timestamp without time zone,
    payload jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.news_articles OWNER TO postgres;

--
-- Name: news_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.news_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.news_articles_id_seq OWNER TO postgres;

--
-- Name: news_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.news_articles_id_seq OWNED BY public.news_articles.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    account_id integer NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    order_type text NOT NULL,
    order_method text NOT NULL,
    order_price numeric(12,2),
    order_quantity integer NOT NULL,
    executed_quantity integer DEFAULT 0 NOT NULL,
    executed_price numeric(12,2),
    order_status text NOT NULL,
    order_number text,
    is_auto_trading boolean DEFAULT false NOT NULL,
    ai_model_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    executed_at timestamp without time zone
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: trading_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trading_logs (
    id integer NOT NULL,
    account_id integer NOT NULL,
    action text NOT NULL,
    details jsonb NOT NULL,
    success boolean NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trading_logs OWNER TO postgres;

--
-- Name: trading_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trading_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trading_logs_id_seq OWNER TO postgres;

--
-- Name: trading_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trading_logs_id_seq OWNED BY public.trading_logs.id;


--
-- Name: trading_performance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trading_performance (
    id integer NOT NULL,
    model_id integer NOT NULL,
    order_id integer,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    entry_price numeric(12,2) NOT NULL,
    exit_price numeric(12,2),
    quantity integer NOT NULL,
    profit_loss numeric(12,2),
    profit_loss_rate numeric(8,4),
    holding_days integer,
    is_win boolean,
    entry_rainbow_line integer,
    entry_ai_confidence numeric(5,2),
    entry_conditions jsonb,
    exit_reason text,
    exit_rainbow_line integer,
    exit_conditions jsonb,
    theme_score numeric(5,2),
    news_score numeric(5,2),
    financials_score numeric(5,2),
    liquidity_score numeric(5,2),
    institutional_score numeric(5,2),
    entry_time timestamp without time zone DEFAULT now() NOT NULL,
    exit_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trading_performance OWNER TO postgres;

--
-- Name: trading_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trading_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trading_performance_id_seq OWNER TO postgres;

--
-- Name: trading_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trading_performance_id_seq OWNED BY public.trading_performance.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    default_account_id integer,
    trading_mode text DEFAULT 'mock'::text NOT NULL,
    auto_trading_enabled boolean DEFAULT false NOT NULL,
    risk_level text DEFAULT 'medium'::text NOT NULL,
    max_daily_loss numeric(12,2),
    notification_settings jsonb,
    theme text DEFAULT 'light'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    kiwoom_app_key text,
    kiwoom_app_secret text,
    price_alert_enabled boolean DEFAULT true NOT NULL,
    trade_alert_enabled boolean DEFAULT true NOT NULL,
    ai_model text DEFAULT 'gpt-5.1'::text NOT NULL
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- Name: user_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_settings_id_seq OWNER TO postgres;

--
-- Name: user_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_settings_id_seq OWNED BY public.user_settings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password text,
    name text,
    profile_image text,
    auth_provider text DEFAULT 'local'::text NOT NULL,
    auth_provider_id text,
    is_email_verified boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: watchlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.watchlist (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    target_price numeric(12,2),
    alert_enabled boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.watchlist OWNER TO postgres;

--
-- Name: watchlist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.watchlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.watchlist_id_seq OWNER TO postgres;

--
-- Name: watchlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.watchlist_id_seq OWNED BY public.watchlist.id;


--
-- Name: watchlist_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.watchlist_signals (
    id integer NOT NULL,
    watchlist_id integer NOT NULL,
    chart_formula_id integer,
    signal_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    current_signal text,
    signal_strength numeric(5,2),
    last_calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.watchlist_signals OWNER TO postgres;

--
-- Name: watchlist_signals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.watchlist_signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.watchlist_signals_id_seq OWNER TO postgres;

--
-- Name: watchlist_signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.watchlist_signals_id_seq OWNED BY public.watchlist_signals.id;


--
-- Name: watchlist_sync_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.watchlist_sync_snapshots (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    stock_code text NOT NULL,
    stock_name text NOT NULL,
    source text DEFAULT 'kiwoom_hts'::text NOT NULL,
    synced_price numeric(12,2),
    raw_payload jsonb,
    synced_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.watchlist_sync_snapshots OWNER TO postgres;

--
-- Name: watchlist_sync_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.watchlist_sync_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.watchlist_sync_snapshots_id_seq OWNER TO postgres;

--
-- Name: watchlist_sync_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.watchlist_sync_snapshots_id_seq OWNED BY public.watchlist_sync_snapshots.id;


--
-- Name: ai_council_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_council_sessions ALTER COLUMN id SET DEFAULT nextval('public.ai_council_sessions_id_seq'::regclass);


--
-- Name: ai_model_specs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_specs ALTER COLUMN id SET DEFAULT nextval('public.ai_model_specs_id_seq'::regclass);


--
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- Name: ai_recommendations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations ALTER COLUMN id SET DEFAULT nextval('public.ai_recommendations_id_seq'::regclass);


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: analysis_material_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_material_snapshots ALTER COLUMN id SET DEFAULT nextval('public.analysis_material_snapshots_id_seq'::regclass);


--
-- Name: auto_trading_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_trading_settings ALTER COLUMN id SET DEFAULT nextval('public.auto_trading_settings_id_seq'::regclass);


--
-- Name: chart_formulas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_formulas ALTER COLUMN id SET DEFAULT nextval('public.chart_formulas_id_seq'::regclass);


--
-- Name: company_filings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_filings ALTER COLUMN id SET DEFAULT nextval('public.company_filings_id_seq'::regclass);


--
-- Name: condition_formulas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condition_formulas ALTER COLUMN id SET DEFAULT nextval('public.condition_formulas_id_seq'::regclass);


--
-- Name: condition_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condition_results ALTER COLUMN id SET DEFAULT nextval('public.condition_results_id_seq'::regclass);


--
-- Name: entry_points id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_points ALTER COLUMN id SET DEFAULT nextval('public.entry_points_id_seq'::regclass);


--
-- Name: financial_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_snapshots ALTER COLUMN id SET DEFAULT nextval('public.financial_snapshots_id_seq'::regclass);


--
-- Name: holdings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings ALTER COLUMN id SET DEFAULT nextval('public.holdings_id_seq'::regclass);


--
-- Name: kiwoom_accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kiwoom_accounts ALTER COLUMN id SET DEFAULT nextval('public.kiwoom_accounts_id_seq'::regclass);


--
-- Name: learning_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_records ALTER COLUMN id SET DEFAULT nextval('public.learning_records_id_seq'::regclass);


--
-- Name: market_issues id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_issues ALTER COLUMN id SET DEFAULT nextval('public.market_issues_id_seq'::regclass);


--
-- Name: news_articles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_articles ALTER COLUMN id SET DEFAULT nextval('public.news_articles_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: trading_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_logs ALTER COLUMN id SET DEFAULT nextval('public.trading_logs_id_seq'::regclass);


--
-- Name: trading_performance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_performance ALTER COLUMN id SET DEFAULT nextval('public.trading_performance_id_seq'::regclass);


--
-- Name: user_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings ALTER COLUMN id SET DEFAULT nextval('public.user_settings_id_seq'::regclass);


--
-- Name: watchlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist ALTER COLUMN id SET DEFAULT nextval('public.watchlist_id_seq'::regclass);


--
-- Name: watchlist_signals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_signals ALTER COLUMN id SET DEFAULT nextval('public.watchlist_signals_id_seq'::regclass);


--
-- Name: watchlist_sync_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_sync_snapshots ALTER COLUMN id SET DEFAULT nextval('public.watchlist_sync_snapshots_id_seq'::regclass);


--
-- Data for Name: ai_council_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_council_sessions (id, user_id, stock_code, stock_name, session_data, final_action, final_confidence, target_price, created_at) FROM stdin;
\.


--
-- Data for Name: ai_model_specs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_model_specs (id, model_id, provider, display_name, strengths, best_for, context_window, input_cost_per_1m, output_cost_per_1m, speed_tier, reasoning_score, is_active, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_models (id, user_id, model_name, model_type, description, config, is_active, performance, total_trades, win_rate, total_return, created_at, updated_at) FROM stdin;
1	64bf8329-93be-4faf-bde4-c36a808dc719	레인보우 차트 AI	technical	업데이트된 레인보우 차트 AI	{"riskLevel": "medium", "rainbowLines": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], "tradingFrequency": "daily"}	f	\N	0	\N	\N	2025-11-28 09:05:33.917938	2025-11-28 09:05:44.608
\.


--
-- Data for Name: ai_recommendations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_recommendations (id, model_id, stock_code, stock_name, action, confidence, target_price, reasoning, indicators, is_executed, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts (id, user_id, stock_code, stock_name, alert_type, target_value, is_triggered, is_active, triggered_at, created_at) FROM stdin;
\.


--
-- Data for Name: analysis_material_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.analysis_material_snapshots (id, user_id, stock_code, stock_name, corp_code, financial_summary, market_issues, filing_ids, news_ids, collected_at, created_at) FROM stdin;
\.


--
-- Data for Name: auto_trading_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auto_trading_settings (id, model_id, default_position_size, max_position_size, max_daily_trades, rainbow_line_settings, center_buy_line, min_ai_confidence, require_good_financials, require_high_liquidity, require_market_issue, theme_weight, news_weight, financials_weight, liquidity_weight, institutional_weight, enable_dynamic_exit, stale_period_days, surge_threshold, volume_spike_multiplier, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: chart_formulas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chart_formulas (id, user_id, formula_name, formula_type, description, formula_ast, raw_formula, output_type, color, line_weight, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: company_filings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_filings (id, stock_code, stock_name, corp_code, rcept_no, report_nm, flr_nm, rcept_dt, link, source, payload, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: condition_formulas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.condition_formulas (id, user_id, condition_name, description, formula_ast, raw_formula, market_type, is_active, is_real_time_monitoring, match_count, last_matched_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: condition_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.condition_results (id, condition_id, stock_code, stock_name, match_score, current_price, volume, change_rate, is_market_issue, has_good_financials, has_high_liquidity, passed_filters, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: entry_points; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entry_points (id, council_session_id, stock_code, entry_price, stop_loss, take_profit, position_size, signal_confluence, executed, created_at) FROM stdin;
\.


--
-- Data for Name: financial_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.financial_snapshots (id, stock_code, fiscal_year, revenue, operating_profit, net_income, total_assets, total_liabilities, total_equity, debt_ratio, roe, roa, is_healthy, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: holdings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.holdings (id, account_id, stock_code, stock_name, quantity, average_price, current_price, profit_loss, profit_loss_rate, updated_at) FROM stdin;
1	24	A007370	진양제약	510	0.00	4580.00	0.00	-27.8900	2026-03-17 23:03:18.813245
2	24	A011150	CJ씨푸드	300	0.00	2690.00	0.00	-12.4400	2026-03-17 23:03:18.924303
3	24	A012700	리드코프	200	0.00	3560.00	0.00	-31.8300	2026-03-17 23:03:18.927505
4	24	A014940	오리엔탈정공	200	0.00	7270.00	0.00	-14.9200	2026-03-17 23:03:18.931033
5	24	A053160	프리엠스	320	0.00	7700.00	0.00	-36.9600	2026-03-17 23:03:18.934349
6	24	A078590	휴림에이텍	1000	0.00	912.00	0.00	-8.7400	2026-03-17 23:03:18.938411
7	24	A088350	한화생명	200	0.00	5250.00	0.00	3.9300	2026-03-17 23:03:18.942436
8	24	A090410	덕신이피씨	1900	0.00	1234.00	0.00	-23.1600	2026-03-17 23:03:18.945847
9	24	A160550	NEW	400	0.00	1785.00	0.00	-31.9000	2026-03-17 23:03:18.948828
10	24	A217270	넵튠	280	0.00	4360.00	0.00	-39.9300	2026-03-17 23:03:18.952374
11	24	A321820	아티스트컴퍼니	100	0.00	3700.00	0.00	-66.3400	2026-03-17 23:03:18.955758
12	24	A370090	퓨런티어	200	0.00	13620.00	0.00	-31.4900	2026-03-17 23:03:18.959393
13	24	A440320	오픈놀	850	0.00	3440.00	0.00	-43.4800	2026-03-17 23:03:18.963017
\.


--
-- Data for Name: kiwoom_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kiwoom_accounts (id, user_id, account_number, account_type, account_name, is_active, created_at) FROM stdin;
1	71eda860-ccb0-47d6-9665-c3475212980d	12345678_RvKi	mock	테스트모의계좌_D-u7	t	2025-11-28 08:05:35.026993
2	71eda860-ccb0-47d6-9665-c3475212980d	87654321_mQg_	real	실전투자테스트_tZ87	t	2025-11-28 08:06:32.069195
3	c63aa8f0-b0ac-4d69-a624-b17f5fd9b295	99999999_hmdH	mock	거래테스트계좌	t	2025-11-28 08:15:28.160206
4	de03b5db-37ed-4863-8be9-f27a70f15158	test_123-789012	mock	테스트계좌	t	2025-11-28 08:20:40.018986
5	cfad6a4a-eab9-4d0b-aea7-8f5fae3dff74	88888888_6h-8	mock	브라우저테스트계좌	t	2025-11-28 08:23:10.726935
6	ec649333-d3d0-44a0-8953-8fc06a26248e	77777777_wSLI	mock	최종테스트계좌	t	2025-11-28 08:28:02.278515
7	221dd26f-f3cb-464b-ad44-d6ea1ae8ee01	88888888_xPE2	mock	세션테스트계좌	t	2025-11-28 08:34:19.154069
8	5ce2ec17-97e2-4b73-a652-d06de425f1bd	99999999_1qdV	mock	트래킹계좌	t	2025-11-28 08:39:38.780873
9	a6f22348-a745-4d12-a7b0-ff5bfdf5e203	12121212_YMUQ	mock	거래테스트계좌	t	2025-11-28 08:43:05.126181
10	64bf8329-93be-4faf-bde4-c36a808dc719	1234567811	mock	테스트계좌	t	2025-11-28 09:00:37.626902
11	686a2c85-d83e-40c8-a8f4-fd7717fa01c7	8888888811	mock	최종테스트계좌	t	2025-11-28 09:12:24.931316
12	58dae16a-9c40-43a9-9fc4-ac2a1a0cbc60	9999999911	mock	지정가테스트계좌	t	2025-11-28 09:23:14.375683
13	e183fabc-e748-479a-9f73-20cd12dc9359	1234567811	mock	테스트계좌	t	2025-11-28 09:30:22.937834
14	edfd52e2-a70d-4a4c-8574-962a0d2672f5	1234567811	mock	테스트계좌	t	2025-11-28 09:35:12.59591
15	24c764b8-df3a-4131-8890-2dad2d543831	4444444411	mock	테스트계좌	t	2025-11-28 09:42:20.254013
16	24bd4c29-253e-46d8-84c6-05ce830faf96	5555555511	mock	테스트계좌	t	2025-11-28 09:45:10.24916
18	654fe369-2258-46e0-8048-768bd8849ad1	8120816611	mock	가상이	t	2026-03-02 09:08:06.2689
17	2092499e-7b55-4210-9025-cfa60f89c4c1	8120816611	mock	모의계좌	t	2026-03-02 06:04:38.976103
24	2092499e-7b55-4210-9025-cfa60f89c4c1	5919064711	real	위탁종합주거래	t	2026-03-17 21:43:26.686065
\.


--
-- Data for Name: learning_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.learning_records (id, model_id, period_start, period_end, total_trades, win_rate, avg_return, pattern_insights, applied_changes, created_at) FROM stdin;
\.


--
-- Data for Name: market_issues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.market_issues (id, issue_date, stock_code, stock_name, issue_type, issue_title, issue_description, impact_level, related_theme, created_at) FROM stdin;
\.


--
-- Data for Name: news_articles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.news_articles (id, stock_code, stock_name, title, description, link, source, sentiment, published_at, payload, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, account_id, stock_code, stock_name, order_type, order_method, order_price, order_quantity, executed_quantity, executed_price, order_status, order_number, is_auto_trading, ai_model_id, created_at, executed_at) FROM stdin;
2	10	005930	삼성전자	buy	market	\N	1	0	\N	pending	MOCK1764320563567	f	\N	2025-11-28 09:02:43.510973	\N
3	10	035720	카카오	sell	limit	55000.00	5	0	\N	pending	MOCK1764320632485	f	\N	2025-11-28 09:03:52.450989	\N
4	11	005930	삼성전자	buy	market	\N	10	0	\N	pending	MOCK1764321145121	f	\N	2025-11-28 09:12:25.090124	\N
5	12	005930	삼성전자	buy	limit	75000.00	5	0	\N	pending	MOCK1764321794586	f	\N	2025-11-28 09:23:14.558538	\N
6	12	005930	삼성전자	sell	limit	80000.00	3	0	\N	pending	MOCK1764321794765	f	\N	2025-11-28 09:23:14.740146	\N
7	12	000660	SK하이닉스	buy	market	\N	10	0	\N	pending	MOCK1764321794944	f	\N	2025-11-28 09:23:14.919621	\N
8	17	005930	005930	buy	market	\N	1	0	\N	pending	\N	f	\N	2026-03-11 10:42:31.935316	\N
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
JoyMZz91fGEnNOcJ0ADTVLgvG0Roijnm	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-01T05:59:37.934Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"2092499e-7b55-4210-9025-cfa60f89c4c1"}}	2026-04-01 07:58:27
2ADBES0e7OOG83LZJo12g2557K5lsUyV	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-07T14:29:37.478Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"2092499e-7b55-4210-9025-cfa60f89c4c1"}}	2026-04-17 11:09:14
0zZgAe8xvNxCokWfgMIK5fNTGV71Nko3	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-17T00:51:34.586Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"2092499e-7b55-4210-9025-cfa60f89c4c1"}}	2026-04-17 02:43:29
\.


--
-- Data for Name: trading_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trading_logs (id, account_id, action, details, success, error_message, created_at) FROM stdin;
1	10	place_order	{"order": {"id": 2, "accountId": 10, "aiModelId": null, "createdAt": "2025-11-28T09:02:43.510Z", "orderType": "buy", "stockCode": "005930", "stockName": "삼성전자", "executedAt": null, "orderPrice": null, "orderMethod": "market", "orderNumber": "MOCK1764320563567", "orderStatus": "pending", "executedPrice": null, "isAutoTrading": false, "orderQuantity": 1, "executedQuantity": 0}, "kiwoomResponse": {"msg1": "주문이 접수되었습니다 (STUB)", "rt_cd": "0", "msg_cd": "0000", "output": {"ODNO": "MOCK1764320563567", "ORD_TMD": "090243", "KRX_FWDG_ORD_ORGNO": "MOCK1764320563567"}}}	t	\N	2025-11-28 09:02:43.600081
2	10	place_order	{"order": {"id": 3, "accountId": 10, "aiModelId": null, "createdAt": "2025-11-28T09:03:52.450Z", "orderType": "sell", "stockCode": "035720", "stockName": "카카오", "executedAt": null, "orderPrice": "55000.00", "orderMethod": "limit", "orderNumber": "MOCK1764320632485", "orderStatus": "pending", "executedPrice": null, "isAutoTrading": false, "orderQuantity": 5, "executedQuantity": 0}, "kiwoomResponse": {"msg1": "주문이 접수되었습니다 (STUB)", "rt_cd": "0", "msg_cd": "0000", "output": {"ODNO": "MOCK1764320632485", "ORD_TMD": "090352", "KRX_FWDG_ORD_ORGNO": "MOCK1764320632485"}}}	t	\N	2025-11-28 09:03:52.512441
3	11	place_order	{"order": {"id": 4, "accountId": 11, "aiModelId": null, "createdAt": "2025-11-28T09:12:25.090Z", "orderType": "buy", "stockCode": "005930", "stockName": "삼성전자", "executedAt": null, "orderPrice": null, "orderMethod": "market", "orderNumber": "MOCK1764321145121", "orderStatus": "pending", "executedPrice": null, "isAutoTrading": false, "orderQuantity": 10, "executedQuantity": 0}, "kiwoomResponse": {"msg1": "주문이 접수되었습니다 (STUB)", "rt_cd": "0", "msg_cd": "0000", "output": {"ODNO": "MOCK1764321145121", "ORD_TMD": "091225", "KRX_FWDG_ORD_ORGNO": "MOCK1764321145121"}}}	t	\N	2025-11-28 09:12:25.151017
4	12	place_order	{"order": {"id": 5, "accountId": 12, "aiModelId": null, "createdAt": "2025-11-28T09:23:14.558Z", "orderType": "buy", "stockCode": "005930", "stockName": "삼성전자", "executedAt": null, "orderPrice": "75000.00", "orderMethod": "limit", "orderNumber": "MOCK1764321794586", "orderStatus": "pending", "executedPrice": null, "isAutoTrading": false, "orderQuantity": 5, "executedQuantity": 0}, "kiwoomResponse": {"msg1": "주문이 접수되었습니다 (STUB)", "rt_cd": "0", "msg_cd": "0000", "output": {"ODNO": "MOCK1764321794586", "ORD_TMD": "092314", "KRX_FWDG_ORD_ORGNO": "MOCK1764321794586"}}}	t	\N	2025-11-28 09:23:14.619557
5	12	place_order	{"order": {"id": 6, "accountId": 12, "aiModelId": null, "createdAt": "2025-11-28T09:23:14.740Z", "orderType": "sell", "stockCode": "005930", "stockName": "삼성전자", "executedAt": null, "orderPrice": "80000.00", "orderMethod": "limit", "orderNumber": "MOCK1764321794765", "orderStatus": "pending", "executedPrice": null, "isAutoTrading": false, "orderQuantity": 3, "executedQuantity": 0}, "kiwoomResponse": {"msg1": "주문이 접수되었습니다 (STUB)", "rt_cd": "0", "msg_cd": "0000", "output": {"ODNO": "MOCK1764321794765", "ORD_TMD": "092314", "KRX_FWDG_ORD_ORGNO": "MOCK1764321794765"}}}	t	\N	2025-11-28 09:23:14.789004
6	12	place_order	{"order": {"id": 7, "accountId": 12, "aiModelId": null, "createdAt": "2025-11-28T09:23:14.919Z", "orderType": "buy", "stockCode": "000660", "stockName": "SK하이닉스", "executedAt": null, "orderPrice": null, "orderMethod": "market", "orderNumber": "MOCK1764321794944", "orderStatus": "pending", "executedPrice": null, "isAutoTrading": false, "orderQuantity": 10, "executedQuantity": 0}, "kiwoomResponse": {"msg1": "주문이 접수되었습니다 (STUB)", "rt_cd": "0", "msg_cd": "0000", "output": {"ODNO": "MOCK1764321794944", "ORD_TMD": "092314", "KRX_FWDG_ORD_ORGNO": "MOCK1764321794944"}}}	t	\N	2025-11-28 09:23:14.968639
\.


--
-- Data for Name: trading_performance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trading_performance (id, model_id, order_id, stock_code, stock_name, entry_price, exit_price, quantity, profit_loss, profit_loss_rate, holding_days, is_win, entry_rainbow_line, entry_ai_confidence, entry_conditions, exit_reason, exit_rainbow_line, exit_conditions, theme_score, news_score, financials_score, liquidity_score, institutional_score, entry_time, exit_time, created_at) FROM stdin;
\.


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, default_account_id, trading_mode, auto_trading_enabled, risk_level, max_daily_loss, notification_settings, theme, updated_at, kiwoom_app_key, kiwoom_app_secret, price_alert_enabled, trade_alert_enabled, ai_model) FROM stdin;
1	50170d2e-62a2-48d8-a496-80b662d8bf6d	\N	mock	f	medium	\N	\N	light	2025-11-14 07:42:57.828254	\N	\N	t	t	gpt-4
2	53b4c096-3a7b-47b9-9b55-b7db4a7758e0	\N	mock	f	medium	\N	\N	light	2025-11-14 07:43:21.010303	\N	\N	t	t	gpt-4
3	81c33d07-deed-49a7-9521-6ae08c0ddbd8	\N	mock	f	medium	\N	\N	light	2025-11-14 07:47:46.055395	\N	\N	t	t	gpt-4
4	204f4e4f-439c-4364-84cb-a17870d1366d	\N	mock	f	medium	\N	\N	light	2025-11-14 07:56:50.370824	\N	\N	t	t	gpt-4
5	4ca564c7-a33d-417f-bc45-fe42f131f634	\N	mock	f	medium	\N	\N	light	2025-11-14 09:09:15.693	\N	\N	t	t	gpt-5.1-chat-latest
6	9d62b617-cb94-44f7-9112-c79311a7b684	\N	mock	f	medium	\N	\N	light	2025-11-28 08:00:45.339972	\N	\N	t	t	gpt-5.1
7	71eda860-ccb0-47d6-9665-c3475212980d	\N	mock	f	medium	\N	\N	light	2025-11-28 08:04:44.648646	\N	\N	t	t	gpt-5.1
8	a3371009-d5ae-4afb-a29e-4610fc122d51	\N	mock	f	medium	\N	\N	light	2025-11-28 08:09:32.111865	\N	\N	t	t	gpt-5.1
9	c63aa8f0-b0ac-4d69-a624-b17f5fd9b295	\N	mock	f	medium	\N	\N	light	2025-11-28 08:14:43.535783	\N	\N	t	t	gpt-5.1
10	de03b5db-37ed-4863-8be9-f27a70f15158	\N	mock	f	medium	\N	\N	light	2025-11-28 08:19:38.935803	\N	\N	t	t	gpt-5.1
11	cfad6a4a-eab9-4d0b-aea7-8f5fae3dff74	\N	mock	f	medium	\N	\N	light	2025-11-28 08:22:52.342949	\N	\N	t	t	gpt-5.1
12	ec649333-d3d0-44a0-8953-8fc06a26248e	\N	mock	f	medium	\N	\N	light	2025-11-28 08:27:27.512055	\N	\N	t	t	gpt-5.1
13	221dd26f-f3cb-464b-ad44-d6ea1ae8ee01	\N	mock	f	medium	\N	\N	light	2025-11-28 08:33:48.167576	\N	\N	t	t	gpt-5.1
14	5ce2ec17-97e2-4b73-a652-d06de425f1bd	\N	mock	f	medium	\N	\N	light	2025-11-28 08:38:55.163785	\N	\N	t	t	gpt-5.1
15	a6f22348-a745-4d12-a7b0-ff5bfdf5e203	\N	mock	f	medium	\N	\N	light	2025-11-28 08:42:25.948356	\N	\N	t	t	gpt-5.1
16	2839c6fa-fb4a-4a7d-8bb2-ae18936daf6e	\N	mock	f	medium	\N	\N	light	2025-11-28 08:54:53.736649	\N	\N	t	t	gpt-5.1
17	5eb1716f-a8d3-415c-a918-c30f3e6eb826	\N	mock	f	medium	\N	\N	light	2025-11-28 08:59:21.806479	\N	\N	t	t	gpt-5.1
18	64bf8329-93be-4faf-bde4-c36a808dc719	\N	mock	f	medium	\N	\N	dark	2025-11-28 09:06:43.146	\N	\N	t	t	gpt-5.1
19	686a2c85-d83e-40c8-a8f4-fd7717fa01c7	\N	mock	f	medium	\N	\N	light	2025-11-28 09:12:24.612482	\N	\N	t	t	gpt-5.1
20	58dae16a-9c40-43a9-9fc4-ac2a1a0cbc60	\N	mock	f	medium	\N	\N	light	2025-11-28 09:23:14.121312	\N	\N	t	t	gpt-5.1
21	e183fabc-e748-479a-9f73-20cd12dc9359	\N	mock	f	medium	\N	\N	light	2025-11-28 09:28:18.528978	\N	\N	t	t	gpt-5.1
22	edfd52e2-a70d-4a4c-8574-962a0d2672f5	\N	mock	f	medium	\N	\N	light	2025-11-28 09:33:52.812294	\N	\N	t	t	gpt-5.1
23	7d853880-5c6f-4fa2-bd70-4ef2f6e3d564	\N	mock	f	medium	\N	\N	light	2025-11-28 09:37:47.599905	\N	\N	t	t	gpt-5.1
24	6859228a-c78f-47a8-98d7-a89ab592f237	\N	mock	f	medium	\N	\N	light	2025-11-28 09:39:55.967203	\N	\N	t	t	gpt-5.1
25	24c764b8-df3a-4131-8890-2dad2d543831	\N	mock	f	medium	\N	\N	light	2025-11-28 09:42:05.708989	\N	\N	t	t	gpt-5.1
26	24bd4c29-253e-46d8-84c6-05ce830faf96	\N	mock	f	medium	\N	\N	light	2025-11-28 09:44:50.914753	\N	\N	t	t	gpt-5.1
27	faad4c8b-76dd-4e24-9692-0913f1da3330	\N	mock	f	medium	\N	\N	light	2025-12-12 10:39:59.96463	\N	\N	t	t	gpt-5.1
28	6493e749-3380-4e16-a8ef-6d64e7e121da	\N	mock	f	medium	\N	\N	light	2026-01-25 01:28:11.698987	\N	\N	t	t	gpt-5.1
29	2092499e-7b55-4210-9025-cfa60f89c4c1	\N	mock	f	medium	\N	\N	light	2026-03-18 02:16:21.384	\N	\N	t	t	gpt-5.1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, name, profile_image, auth_provider, auth_provider_id, is_email_verified, created_at) FROM stdin;
654fe369-2258-46e0-8048-768bd8849ad1	mainstop@naver.com	$2b$10$Yaf/8BqGfYDyhu687Sf5e.tnLFnkI16vcAOOxX8X3E18Jj2mx/IGC	test	\N	local	\N	f	2025-11-14 07:40:00.29448
c16fab90-068d-4c6f-81b3-2e3bc4b90c8b	test@test.com	$2b$10$taY3Jo8XMmQMureNdmLd5uOLmsr8mlnvEM2uYv1PokYQnyenR9fYG	테스트	\N	local	\N	f	2025-11-14 07:41:56.233337
50170d2e-62a2-48d8-a496-80b662d8bf6d	newuser@test.com	$2b$10$UpR8RwHz0icrsgM83PcEDe8l6wCPkJ1Rg8vo3Q0XhNAle9O/JA8hq	신규사용자	\N	local	\N	f	2025-11-14 07:42:57.808513
53b4c096-3a7b-47b9-9b55-b7db4a7758e0	testuser2@test.com	$2b$10$txYHh6uIKa.Qs.tSkvSN9ep.Mg/qy7ZdOvHtnFjlaUK8ukE/nhE0C	테스트유저2	\N	local	\N	f	2025-11-14 07:43:20.988291
81c33d07-deed-49a7-9521-6ae08c0ddbd8	scantest@example.com	$2b$10$zvZfsN5ATujDiLYuxRouQOZ7o.RMUwZKt/gW2vJFZylynozGAb29q	테스트사용자	\N	local	\N	f	2025-11-14 07:47:46.013758
204f4e4f-439c-4364-84cb-a17870d1366d	e2etest@example.com	$2b$10$lrTX6njb7ydUQMGO/FYY4.gefjbIVQvlSpuKZA4karh3enf6eDUz2	E2E테스트	\N	local	\N	f	2025-11-14 07:56:50.333895
4ca564c7-a33d-417f-bc45-fe42f131f634	test_yvUmAxZvnT@example.com	$2b$10$otw7KhkW17kOEyjIPGeT.OR9c1eKpR/CE5nHEu.06Ah4V7BqTUzgG	Test User	\N	local	\N	f	2025-11-14 09:07:46.219212
9d62b617-cb94-44f7-9112-c79311a7b684	cyclone_test_UiF9d88I@test.com	$2b$10$4TSw37hvb.RqM.KLrNOPO.8j7f6xUmkBUpUVuvZNVBV61Vr4AIc8O	테스트유저_xAq4Sm	\N	local	\N	f	2025-11-28 08:00:45.308619
71eda860-ccb0-47d6-9665-c3475212980d	account_test_AbNluuRK@test.com	$2b$10$21nlgMd47JVt8HJlWtZORu0D6POevpNTu.LkM2Jffy3j2OhLOv0/C	계좌테스트_OuPGrJ	\N	local	\N	f	2025-11-28 08:04:44.619666
a3371009-d5ae-4afb-a29e-4610fc122d51	trading_test_gyiXnzjt@test.com	$2b$10$52UGLZZ8GHGFgUl2jSKwyOVmLmn6h3ZUj83a8d.XftuabANWvmSYq	거래테스트_NSutsl	\N	local	\N	f	2025-11-28 08:09:32.089541
c63aa8f0-b0ac-4d69-a624-b17f5fd9b295	trading_v2_ziFtzjO0@test.com	$2b$10$tR/AsfsJtCrHuDgnDUScnO7OzTwel2HbPHh.ycEx4QapQjqwFJwBe	거래테스트_Z4rTu8	\N	local	\N	f	2025-11-28 08:14:43.507364
de03b5db-37ed-4863-8be9-f27a70f15158	session_debug_6hs_Szam@test.com	$2b$10$tSHuU7KYR2XCPO.T//msxu6DlQl6IRqhUUaArhSx9NYvjFMSAxhzq	세션테스트_JopYAs	\N	local	\N	f	2025-11-28 08:19:38.908373
cfad6a4a-eab9-4d0b-aea7-8f5fae3dff74	browser_only_tgoO09uX@test.com	$2b$10$Qc8vIYt/INpwM0GvsMepUegmSmyyWwZmMMdnLlYhW3DpFbAB5dl4q	브라우저테스트_FsOIde	\N	local	\N	f	2025-11-28 08:22:52.31205
ec649333-d3d0-44a0-8953-8fc06a26248e	final_debug_bIrQR0SU@test.com	$2b$10$WHnwb0xnlRc1juiu90jdQO63uW1qa/cSyLHR5QBCmq8F9iOynLQMq	최종테스트_AGuLOH	\N	local	\N	f	2025-11-28 08:27:27.484259
221dd26f-f3cb-464b-ad44-d6ea1ae8ee01	session_fix_jWONhZyn@test.com	$2b$10$Ft8MkpkC2bKySuKSZdBkmepDtsuPqdiBncuU0PkcKKOU2IbtIdEiO	세션테스트_etXd1Q	\N	local	\N	f	2025-11-28 08:33:48.129589
5ce2ec17-97e2-4b73-a652-d06de425f1bd	tracking_o2pHKXDN@test.com	$2b$10$HMdKCeRWxmdbFKpoY/QY1.UReaSRUj0mAAamwn3uvdcvEn7NmAm6K	트래킹_iMyKIE	\N	local	\N	f	2025-11-28 08:38:55.122578
a6f22348-a745-4d12-a7b0-ff5bfdf5e203	trading_70EhUdwM@test.com	$2b$10$cONy70TOwpeK7aMXemxVLu8mr3fbFfGYRhmwH..2tZ4ZD9Lw7nypq	거래테스트_hSPKXT	\N	local	\N	f	2025-11-28 08:42:25.919466
2839c6fa-fb4a-4a7d-8bb2-ae18936daf6e	manual_test_1764320093@test.com	$2b$10$sUYPFeL5bpSQJZYWtVDYkegrv6hoPaKKjGE6oW6m1do8bhli1gtSu	수동테스트	\N	local	\N	f	2025-11-28 08:54:53.712891
5eb1716f-a8d3-415c-a918-c30f3e6eb826	api_test_1764320359@test.com	$2b$10$HEuYKs9eVXm.1UIHyc.V6Oc2UfFnhNKHi8F4EqmmT/SfL/xT7s8Xq	API테스트	\N	local	\N	f	2025-11-28 08:59:21.777447
64bf8329-93be-4faf-bde4-c36a808dc719	secure_auto_1764320434@test.com	$2b$10$GDjNnJ1s/kORId/73V3o4e.IHEqyUBYQGMMONSoYMP5OKX/oLJwki	보안자동	\N	local	\N	f	2025-11-28 09:00:37.277408
686a2c85-d83e-40c8-a8f4-fd7717fa01c7	final_test_1764321144@test.com	$2b$10$W2KWIqEsazUEDE4tbPs5mOPVHi2lcBAfwQkmWrOturdn0yVRtPvOa	최종테스트	\N	local	\N	f	2025-11-28 09:12:24.593068
58dae16a-9c40-43a9-9fc4-ac2a1a0cbc60	limit_test_1764321793@test.com	$2b$10$SmDE76yGZNXmFQPvLQxZ.ORtvfwITv.M.CyCQ1pr5NLLkr0mQExXG	지정가테스트	\N	local	\N	f	2025-11-28 09:23:14.098141
e183fabc-e748-479a-9f73-20cd12dc9359	test_order_1lHHRi@test.com	$2b$10$wpwRY3XRy8qEYpV5Waer4Osb68yWkpDufIGp3L9fNdVhDJQGDrspa	주문테스트	\N	local	\N	f	2025-11-28 09:28:18.502235
edfd52e2-a70d-4a4c-8574-962a0d2672f5	order_test_SwC4yX@test.com	$2b$10$6jCJ/1ikXwb6806pJTBhjOcUv4dYqMa/iFZRtmM96kPf4rXqsZaN2	주문테스트	\N	local	\N	f	2025-11-28 09:33:52.771131
7d853880-5c6f-4fa2-bd70-4ef2f6e3d564	session_test_1764322667@test.com	$2b$10$7ZzzJ5KMhArN3OVfYCa5/O1kQoAT0npb6i7ZoF03Sys58ofFM.q1i	세션테스트	\N	local	\N	f	2025-11-28 09:37:47.57515
6859228a-c78f-47a8-98d7-a89ab592f237	ordertest_u72HGW@test.com	$2b$10$lIQaEf8mQzkjD2SZQ2oqFuA9rhyEt1RSRXjWvCSFonzWEABWy1z2C	주문테스트	\N	local	\N	f	2025-11-28 09:39:55.934661
24c764b8-df3a-4131-8890-2dad2d543831	ordertest_8BDUVd@test.com	$2b$10$b9L6LZe8kS1dBExZ3Y4t1.AL6uPmPMOCjAB3xU0Gyv.NBOXjp3r7C	주문테스트	\N	local	\N	f	2025-11-28 09:42:05.687049
24bd4c29-253e-46d8-84c6-05ce830faf96	ordertest_QyLIcc@test.com	$2b$10$si8xGPKI87ZIiU4za0WXVuHuJsPcXnHa46lc1EHj0k4z3gJZwieDa	주문테스트	\N	local	\N	f	2025-11-28 09:44:50.872663
faad4c8b-76dd-4e24-9692-0913f1da3330	tutorial_Cs95aZ@test.com	$2b$10$Q1eKG8rZ/AHdFUUlEkdj0.331itQggOT.IsC6su/2sBfTZK2I3iyu	튜토리얼테스트_1nog	\N	local	\N	f	2025-12-12 10:39:59.935258
6493e749-3380-4e16-a8ef-6d64e7e121da	mobile_2cuTAJ@test.com	$2b$10$IcCPJ./hM7kGt2t74mDSlOrdiQ51SXGi2OXQAOcKC9IlFHlKrNcTy	모바일테스트_87Ti	\N	local	\N	f	2026-01-25 01:28:11.675865
2092499e-7b55-4210-9025-cfa60f89c4c1	mainstop3@gmail.com	\N	WS J	https://lh3.googleusercontent.com/a/ACg8ocKwWtrv1SnI6wB7Y8lUd972ymB3HM7xAs47b3VMLagNVAvjqCcy=s96-c	google	103819952004278742900	t	2026-03-02 05:59:37.673544
\.


--
-- Data for Name: watchlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.watchlist (id, user_id, stock_code, stock_name, target_price, alert_enabled, notes, created_at) FROM stdin;
1	64bf8329-93be-4faf-bde4-c36a808dc719	005930	삼성전자	75000.00	t	\N	2025-11-28 09:06:25.563397
\.


--
-- Data for Name: watchlist_signals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.watchlist_signals (id, watchlist_id, chart_formula_id, signal_data, current_signal, signal_strength, last_calculated_at, updated_at) FROM stdin;
\.


--
-- Data for Name: watchlist_sync_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.watchlist_sync_snapshots (id, user_id, stock_code, stock_name, source, synced_price, raw_payload, synced_at, updated_at) FROM stdin;
\.


--
-- Name: ai_council_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_council_sessions_id_seq', 1, false);


--
-- Name: ai_model_specs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_model_specs_id_seq', 1, false);


--
-- Name: ai_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_models_id_seq', 1, true);


--
-- Name: ai_recommendations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_recommendations_id_seq', 1, false);


--
-- Name: alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alerts_id_seq', 1, true);


--
-- Name: analysis_material_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.analysis_material_snapshots_id_seq', 1, false);


--
-- Name: auto_trading_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auto_trading_settings_id_seq', 1, false);


--
-- Name: chart_formulas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chart_formulas_id_seq', 1, false);


--
-- Name: company_filings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.company_filings_id_seq', 1, false);


--
-- Name: condition_formulas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.condition_formulas_id_seq', 1, false);


--
-- Name: condition_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.condition_results_id_seq', 1, false);


--
-- Name: entry_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.entry_points_id_seq', 1, false);


--
-- Name: financial_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.financial_snapshots_id_seq', 1, false);


--
-- Name: holdings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.holdings_id_seq', 13, true);


--
-- Name: kiwoom_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kiwoom_accounts_id_seq', 24, true);


--
-- Name: learning_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.learning_records_id_seq', 1, false);


--
-- Name: market_issues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.market_issues_id_seq', 1, false);


--
-- Name: news_articles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.news_articles_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 8, true);


--
-- Name: trading_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trading_logs_id_seq', 6, true);


--
-- Name: trading_performance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trading_performance_id_seq', 1, false);


--
-- Name: user_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_settings_id_seq', 29, true);


--
-- Name: watchlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.watchlist_id_seq', 2, true);


--
-- Name: watchlist_signals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.watchlist_signals_id_seq', 1, false);


--
-- Name: watchlist_sync_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.watchlist_sync_snapshots_id_seq', 1, false);


--
-- Name: ai_council_sessions ai_council_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_council_sessions
    ADD CONSTRAINT ai_council_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_model_specs ai_model_specs_model_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_specs
    ADD CONSTRAINT ai_model_specs_model_id_unique UNIQUE (model_id);


--
-- Name: ai_model_specs ai_model_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_specs
    ADD CONSTRAINT ai_model_specs_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_recommendations ai_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: analysis_material_snapshots analysis_material_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_material_snapshots
    ADD CONSTRAINT analysis_material_snapshots_pkey PRIMARY KEY (id);


--
-- Name: auto_trading_settings auto_trading_settings_model_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_trading_settings
    ADD CONSTRAINT auto_trading_settings_model_id_unique UNIQUE (model_id);


--
-- Name: auto_trading_settings auto_trading_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_trading_settings
    ADD CONSTRAINT auto_trading_settings_pkey PRIMARY KEY (id);


--
-- Name: chart_formulas chart_formulas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_formulas
    ADD CONSTRAINT chart_formulas_pkey PRIMARY KEY (id);


--
-- Name: company_filings company_filings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_filings
    ADD CONSTRAINT company_filings_pkey PRIMARY KEY (id);


--
-- Name: condition_formulas condition_formulas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condition_formulas
    ADD CONSTRAINT condition_formulas_pkey PRIMARY KEY (id);


--
-- Name: condition_results condition_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condition_results
    ADD CONSTRAINT condition_results_pkey PRIMARY KEY (id);


--
-- Name: entry_points entry_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_points
    ADD CONSTRAINT entry_points_pkey PRIMARY KEY (id);


--
-- Name: financial_snapshots financial_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_snapshots
    ADD CONSTRAINT financial_snapshots_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: kiwoom_accounts kiwoom_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kiwoom_accounts
    ADD CONSTRAINT kiwoom_accounts_pkey PRIMARY KEY (id);


--
-- Name: learning_records learning_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_records_pkey PRIMARY KEY (id);


--
-- Name: market_issues market_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_issues
    ADD CONSTRAINT market_issues_pkey PRIMARY KEY (id);


--
-- Name: news_articles news_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: trading_logs trading_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_logs
    ADD CONSTRAINT trading_logs_pkey PRIMARY KEY (id);


--
-- Name: trading_performance trading_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_performance
    ADD CONSTRAINT trading_performance_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: watchlist watchlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_pkey PRIMARY KEY (id);


--
-- Name: watchlist_signals watchlist_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_signals
    ADD CONSTRAINT watchlist_signals_pkey PRIMARY KEY (id);


--
-- Name: watchlist_sync_snapshots watchlist_sync_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_sync_snapshots
    ADD CONSTRAINT watchlist_sync_snapshots_pkey PRIMARY KEY (id);


--
-- Name: ai_council_sessions ai_council_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_council_sessions
    ADD CONSTRAINT ai_council_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_models ai_models_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_recommendations ai_recommendations_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_model_id_ai_models_id_fk FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: analysis_material_snapshots analysis_material_snapshots_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_material_snapshots
    ADD CONSTRAINT analysis_material_snapshots_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: auto_trading_settings auto_trading_settings_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_trading_settings
    ADD CONSTRAINT auto_trading_settings_model_id_ai_models_id_fk FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- Name: chart_formulas chart_formulas_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_formulas
    ADD CONSTRAINT chart_formulas_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: condition_formulas condition_formulas_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condition_formulas
    ADD CONSTRAINT condition_formulas_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: condition_results condition_results_condition_id_condition_formulas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condition_results
    ADD CONSTRAINT condition_results_condition_id_condition_formulas_id_fk FOREIGN KEY (condition_id) REFERENCES public.condition_formulas(id) ON DELETE CASCADE;


--
-- Name: entry_points entry_points_council_session_id_ai_council_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_points
    ADD CONSTRAINT entry_points_council_session_id_ai_council_sessions_id_fk FOREIGN KEY (council_session_id) REFERENCES public.ai_council_sessions(id) ON DELETE SET NULL;


--
-- Name: holdings holdings_account_id_kiwoom_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_account_id_kiwoom_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.kiwoom_accounts(id) ON DELETE CASCADE;


--
-- Name: kiwoom_accounts kiwoom_accounts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kiwoom_accounts
    ADD CONSTRAINT kiwoom_accounts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: learning_records learning_records_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_records
    ADD CONSTRAINT learning_records_model_id_ai_models_id_fk FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- Name: orders orders_account_id_kiwoom_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_account_id_kiwoom_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.kiwoom_accounts(id) ON DELETE CASCADE;


--
-- Name: orders orders_ai_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_ai_model_id_ai_models_id_fk FOREIGN KEY (ai_model_id) REFERENCES public.ai_models(id);


--
-- Name: trading_logs trading_logs_account_id_kiwoom_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_logs
    ADD CONSTRAINT trading_logs_account_id_kiwoom_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.kiwoom_accounts(id) ON DELETE CASCADE;


--
-- Name: trading_performance trading_performance_model_id_ai_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_performance
    ADD CONSTRAINT trading_performance_model_id_ai_models_id_fk FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- Name: trading_performance trading_performance_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_performance
    ADD CONSTRAINT trading_performance_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: user_settings user_settings_default_account_id_kiwoom_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_default_account_id_kiwoom_accounts_id_fk FOREIGN KEY (default_account_id) REFERENCES public.kiwoom_accounts(id);


--
-- Name: user_settings user_settings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watchlist_signals watchlist_signals_chart_formula_id_chart_formulas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_signals
    ADD CONSTRAINT watchlist_signals_chart_formula_id_chart_formulas_id_fk FOREIGN KEY (chart_formula_id) REFERENCES public.chart_formulas(id);


--
-- Name: watchlist_signals watchlist_signals_watchlist_id_watchlist_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_signals
    ADD CONSTRAINT watchlist_signals_watchlist_id_watchlist_id_fk FOREIGN KEY (watchlist_id) REFERENCES public.watchlist(id) ON DELETE CASCADE;


--
-- Name: watchlist_sync_snapshots watchlist_sync_snapshots_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist_sync_snapshots
    ADD CONSTRAINT watchlist_sync_snapshots_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watchlist watchlist_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jJikasgkFe02BQT77wmxGWuuh0YPuHIejhc995K5igrjl4wAoBGraxicaRW0MPb

