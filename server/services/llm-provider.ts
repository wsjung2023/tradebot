// llm-provider.ts — LLM 백엔드 추상화 (provider-pluggable)
//
// 원칙: OpenAI 경로가 기본이며 동작·결과가 바뀌지 않는다(wrap, don't replace).
// Claude API / Claude CLI(구독) / 로컬모델은 추가 옵션으로만 붙는다.
// 선택: env LLM_PROVIDER (기본 'openai'). 미설정·기존 배포는 자동으로 openai → 회귀 없음.
import type OpenAI from 'openai';

export type LlmMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface LlmCompletionResult {
  content: string; // JSON 문자열 (호출부에서 JSON.parse)
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCompletionParams {
  model: string;
  messages: LlmMessage[];
  temperature?: number; // reasoning 모델은 호출부에서 이미 undefined로 처리됨
}

export interface LlmProvider {
  readonly name: string;
  createJsonCompletion(params: LlmCompletionParams): Promise<LlmCompletionResult>;
}

// ── 공통 헬퍼 ────────────────────────────────────────────────────────────────

function flattenContent(content: LlmMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part: any) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text') return String(part?.text || '');
      return '';
    })
    .join('\n');
}

// 모델이 생성한 텍스트에서 첫 번째 JSON 객체만 추출 (코드블록/설명 섞여도 복구)
function extractJsonObject(text: string): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return '{}';
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

// ── OpenAI (기본, 동작 무변경) ───────────────────────────────────────────────

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  constructor(private readonly openai: OpenAI) {}

  async createJsonCompletion({ model, messages, temperature }: LlmCompletionParams): Promise<LlmCompletionResult> {
    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      ...(temperature !== undefined && { temperature }),
      response_format: { type: 'json_object' },
    });
    const promptTokens = Number(completion.usage?.prompt_tokens ?? 0);
    const completionTokens = Number(completion.usage?.completion_tokens ?? 0);
    return {
      content: completion.choices?.[0]?.message?.content || '{}',
      promptTokens,
      completionTokens,
      totalTokens: Number(completion.usage?.total_tokens ?? promptTokens + completionTokens),
    };
  }
}

// ── Claude API (선택, 지연 로드 — SDK 미설치 시 호출 시점에만 에러) ───────────

export class ClaudeApiProvider implements LlmProvider {
  readonly name = 'claude_api';
  constructor(
    private readonly apiKey: string,
    private readonly defaultModel = 'claude-sonnet-4-6',
  ) {}

  async createJsonCompletion({ model, messages, temperature }: LlmCompletionParams): Promise<LlmCompletionResult> {
    // 동적 import: 패키지가 없으면 컴파일/기본 경로에 영향 없이 호출 시점에만 실패
    const pkg = '@anthropic-ai/sdk';
    let Anthropic: any;
    try {
      Anthropic = (await import(pkg)).default;
    } catch {
      throw new Error('LLM_PROVIDER=claude_api 사용에는 Anthropic SDK가 필요합니다: npm i @anthropic-ai/sdk');
    }
    if (!this.apiKey) throw new Error('LLM_PROVIDER=claude_api 사용에는 ANTHROPIC_API_KEY가 필요합니다.');

    const client = new Anthropic({ apiKey: this.apiKey });
    const useModel = model?.startsWith('claude') ? model : this.defaultModel;
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => flattenContent((m as any).content))
      .filter(Boolean)
      .join('\n\n');
    const convo = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: flattenContent((m as any).content) }));

    const resp = await client.messages.create({
      model: useModel,
      max_tokens: 4096,
      system: `${system}\n\n반드시 유효한 JSON 객체만 출력하세요. 코드블록이나 설명 없이 JSON만.`.trim(),
      messages: convo,
      ...(temperature !== undefined && { temperature }),
    });
    const text = (resp.content || [])
      .map((b: any) => (b?.type === 'text' ? b.text : ''))
      .join('');
    const promptTokens = Number(resp.usage?.input_tokens ?? 0);
    const completionTokens = Number(resp.usage?.output_tokens ?? 0);
    return {
      content: extractJsonObject(text),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
}

// ── Claude CLI 구독 (선택, 의존성 없음 — 서버에 인증된 claude CLI 필요) ───────

export class ClaudeCliProvider implements LlmProvider {
  readonly name = 'claude_cli';
  constructor(private readonly defaultModel?: string) {}

  async createJsonCompletion({ model, messages }: LlmCompletionParams): Promise<LlmCompletionResult> {
    const { spawn } = await import('node:child_process');
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => flattenContent((m as any).content))
      .filter(Boolean)
      .join('\n\n');
    const convo = messages
      .filter((m) => m.role !== 'system')
      .map((m) => flattenContent((m as any).content))
      .filter(Boolean)
      .join('\n\n');
    // 동적 값은 전부 stdin으로 전달 → argv 이스케이프 문제 회피 (고정 플래그만 argv)
    const prompt = `${system}\n\n${convo}\n\n반드시 유효한 JSON 객체만 출력하세요. 코드블록이나 설명 없이 JSON만.`.trim();

    const useModel = model?.startsWith('claude') ? model : this.defaultModel;
    const args = ['-p', '--output-format', 'json'];
    if (useModel && /^[\w.:-]+$/.test(useModel)) args.push('--model', useModel);

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn('claude', args, { shell: true });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d.toString()));
      child.stderr.on('data', (d) => (err += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(`claude CLI exit ${code}: ${err.slice(0, 500)}`));
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });

    // CLI는 { type:'result', result:'<text>', usage:{input_tokens,output_tokens} } 형태의 JSON 봉투를 출력
    let resultText = stdout;
    let promptTokens = 0;
    let completionTokens = 0;
    try {
      const envelope = JSON.parse(stdout);
      if (envelope && typeof envelope === 'object') {
        if (typeof envelope.result === 'string') resultText = envelope.result;
        promptTokens = Number(envelope.usage?.input_tokens ?? 0);
        completionTokens = Number(envelope.usage?.output_tokens ?? 0);
      }
    } catch {
      // 봉투가 아니면 stdout 자체를 결과 텍스트로 취급
    }
    return {
      content: extractJsonObject(resultText),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createLlmProvider(openai: OpenAI): LlmProvider {
  const kind = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  switch (kind) {
    case 'claude_api':
      return new ClaudeApiProvider(process.env.ANTHROPIC_API_KEY || '', process.env.CLAUDE_MODEL || 'claude-sonnet-4-6');
    case 'claude_cli':
      return new ClaudeCliProvider(process.env.CLAUDE_MODEL);
    case 'openai':
    default:
      return new OpenAiProvider(openai);
  }
}
