// news.service.ts — 네이버 뉴스 검색 API 기반 종목 뉴스 수집 서비스
// 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 필요
// 캐시: 5분간 메모리 캐싱으로 API 호출 절약

import axios from 'axios';

export interface NewsArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface NewsResult {
  articles: NewsArticle[];
  fetchedAt: string;
  query: string;
}

interface CacheEntry {
  data: NewsResult;
  expiresAt: number;
}

// ─────────────────────────────────────
// 키워드 기반 간이 감성 분류
// ─────────────────────────────────────
const POSITIVE_WORDS = [
  '상승', '급등', '신고가', '성장', '호실적', '흑자', '매수', '목표가 상향',
  '실적 개선', '수주', '계약', '호재', '긍정', '강세', '반등', '돌파', '최고',
  '증가', '확대', '개선', '호조', '우호', '낙관',
];
const NEGATIVE_WORDS = [
  '하락', '급락', '신저가', '적자', '매도', '목표가 하향', '실적 부진',
  '악재', '부정', '약세', '하향', '감소', '축소', '우려', '리스크', '손실',
  '위기', '부진', '경고', '취소', '파산', '비관',
];

function classifySentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const normalized = text.toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) if (normalized.includes(w)) score++;
  for (const w of NEGATIVE_WORDS) if (normalized.includes(w)) score--;
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

// ─────────────────────────────────────
// 뉴스 서비스 클래스
// ─────────────────────────────────────
export class NewsService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = 'https://openapi.naver.com/v1/search/news.json';
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5분 캐시

  constructor() {
    this.clientId = process.env.NAVER_CLIENT_ID || '';
    this.clientSecret = process.env.NAVER_CLIENT_SECRET || '';
  }

  get isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // ─── 종목 뉴스 조회 ───────────────────────────
  async getStockNews(stockCode: string, stockName: string, count: number = 10): Promise<NewsResult> {
    const cacheKey = `${stockCode}-${count}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    if (!this.isAvailable) {
      return { articles: [], fetchedAt: new Date().toISOString(), query: stockName };
    }

    const query = `${stockName} 주식`;

    try {
      const resp = await axios.get(this.baseUrl, {
        params: { query, display: count, sort: 'date' },
        headers: {
          'X-Naver-Client-Id': this.clientId,
          'X-Naver-Client-Secret': this.clientSecret,
        },
        timeout: 8000,
      });

      const items = resp.data?.items || [];
      const articles: NewsArticle[] = items.map((item: any) => {
        const title = stripHtml(item.title);
        const description = stripHtml(item.description);
        return {
          title,
          description,
          link: item.link || item.originallink || '',
          pubDate: item.pubDate || '',
          source: extractSource(item.link || ''),
          sentiment: classifySentiment(`${title} ${description}`),
        };
      });

      const result: NewsResult = {
        articles,
        fetchedAt: new Date().toISOString(),
        query,
      };

      this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.TTL_MS });
      return result;
    } catch (error: any) {
      console.error(`[NewsService] 뉴스 조회 실패 (${stockName}):`, error.message);
      return { articles: [], fetchedAt: new Date().toISOString(), query };
    }
  }

  // ─── 뉴스 감성 요약 (GPT 입력용 텍스트 생성) ────
  summarizeForAI(news: NewsResult): string {
    if (!news.articles.length) return '관련 뉴스 없음';
    const lines = news.articles.slice(0, 8).map((a, i) =>
      `${i + 1}. [${a.sentiment.toUpperCase()}] ${a.title} — ${a.description.slice(0, 120)}`
    );
    const positive = news.articles.filter(a => a.sentiment === 'positive').length;
    const negative = news.articles.filter(a => a.sentiment === 'negative').length;
    return `최근 뉴스 (긍정 ${positive}건 / 부정 ${negative}건 / 중립 ${news.articles.length - positive - negative}건):\n${lines.join('\n')}`;
  }
}

function extractSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const known: Record<string, string> = {
      'news.naver.com': '네이버',
      'hankyung.com': '한국경제',
      'mk.co.kr': '매일경제',
      'einfomax.co.kr': '연합인포맥스',
      'yonhapnewstv.co.kr': '연합뉴스',
      'biz.chosun.com': '조선비즈',
      'sedaily.com': '서울경제',
      'newsis.com': '뉴시스',
    };
    for (const [k, v] of Object.entries(known)) if (host.includes(k)) return v;
    return host;
  } catch {
    return '뉴스';
  }
}

let instance: NewsService | null = null;
export function getNewsService(): NewsService {
  if (!instance) instance = new NewsService();
  return instance;
}
