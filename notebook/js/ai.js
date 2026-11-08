// Claude で採点済みの解答用紙・問題用紙を読み取り、まちがえた問題の候補を作る（任意機能）
// API キーはこの端末の localStorage にだけ保存し、ブラウザから直接 Anthropic API に送る
import { toBase64Jpeg } from './image.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.0.0/+esm';
export const MODEL = 'claude-opus-5-5';
const KEY_NAME = 'tokinaoshi.apiKey';

export const REASON_IDS = ['careless', 'understand', 'memory', 'time', 'other'];

export function getApiKey() {
  try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; }
}
export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_NAME, key);
    else localStorage.removeItem(KEY_NAME);
  } catch { /* プライベートモードなど */ }
}

const box = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'w', 'h'],
  properties: {
    x: { type: 'integer', description: '左端（画像の幅を 1000 としたときの位置）' },
    y: { type: 'integer', description: '上端（画像の高さを 1000 としたときの位置）' },
    w: { type: 'integer', description: '幅（1000 分率）' },
    h: { type: 'integer', description: '高さ（1000 分率）' },
  },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['problems', 'notes'],
  properties: {
    notes: { type: 'string', description: '読み取りで気になったこと（読みにくい箇所など）。なければ空文字' },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'unit', 'question_text', 'my_answer', 'correct_answer', 'reason', 'answer_page', 'answer_box', 'question_page', 'question_box'],
        properties: {
          label: { type: 'string', description: '問題番号。例: 大問2 (3)' },
          unit: { type: 'string', description: '単元名。候補の中に合うものがあればそれをそのまま使う' },
          question_text: { type: 'string', description: '問題文の要約（図は「図あり」と書く）' },
          my_answer: { type: 'string', description: '解答用紙に書かれた生徒の答え。読めなければ空文字' },
          correct_answer: { type: 'string', description: '赤で書かれた正答など、分かる場合のみ。分からなければ空文字' },
          reason: { type: 'string', enum: REASON_IDS, description: 'まちがえた理由の推測' },
          answer_page: { type: 'integer', description: '解答用紙の何枚目か（1 から）。見つからなければ 0' },
          answer_box: box,
          question_page: { type: 'integer', description: '問題用紙の何枚目か（1 から）。見つからなければ 0' },
          question_box: box,
        },
      },
    },
  },
};

const SYSTEM = `あなたは日本の小学生・中学受験生のテストを読み取るアシスタントです。
写真は「採点済みの解答用紙」と「問題用紙」です。解答用紙には先生の赤ペンで ○・×・✓・レ点・部分点・正答の書きこみがあります。
やること:
1. 解答用紙で、×・✓・0点・部分点（△や減点）になっている設問をすべて見つける。○の設問はふくめない。
2. それぞれについて、問題用紙のどこにその設問があるかを探す。
3. 設問ごとに、問題番号・単元・問題文の要約・生徒の答え・正答（分かる場合のみ）・まちがえた理由の推測・それぞれの位置を返す。
位置について:
- answer_box は解答用紙上のその設問の解答らん（採点の印をふくむ）、question_box は問題用紙上のその設問（図や表もふくむ）を囲む長方形。
- x, y は左上の角、w, h は幅と高さ。画像の幅・高さをそれぞれ 1000 とした整数で、少し余白をもたせて囲む。
- 見つからないときは page を 0 にし、box はすべて 0 にする。
理由（reason）: careless=計算ミス・写しまちがいなどのケアレスミス, understand=考え方が分かっていない, memory=知識を覚えていない, time=空欄・時間切れ, other=判断できない。
推測で答えを作らないこと。読み取れない文字は空文字にし、notes に書く。`;

let sdkPromise = null;
function loadSDK() {
  if (!sdkPromise) sdkPromise = import(SDK_URL).then((m) => m.default || m.Anthropic);
  return sdkPromise;
}

// answerPages / questionPages: Blob の配列。units: その教科の単元名の配列
export async function analyzeSheets({ subject, title, units, answerPages, questionPages, onProgress }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('設定画面で Claude の API キーを入れてください。');
  if (!answerPages.length) throw new Error('解答用紙の写真を 1 枚以上入れてください。');

  onProgress?.('写真を準備しています…');
  const content = [];
  for (let i = 0; i < answerPages.length; i++) {
    content.push({ type: 'text', text: `【解答用紙 ${i + 1}枚目】` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toBase64Jpeg(answerPages[i]) } });
  }
  for (let i = 0; i < questionPages.length; i++) {
    content.push({ type: 'text', text: `【問題用紙 ${i + 1}枚目】` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toBase64Jpeg(questionPages[i]) } });
  }
  content.push({
    type: 'text',
    text: `教科: ${subject}\nテスト: ${title || '（名前なし）'}\n単元の候補: ${units.join('、') || '（なし）'}\n問題用紙の写真: ${questionPages.length ? questionPages.length + '枚' : 'なし（問題用紙の位置は 0 にする）'}\nまちがえた設問をすべて読み取ってください。`,
  });

  onProgress?.('Claude に読み取ってもらっています…（1 分ほどかかることがあります）');
  let Anthropic = null;
  let message;
  try {
    Anthropic = await loadSDK();
  } catch {
    sdkPromise = null;
    throw new Error('読み取り機能を読みこめませんでした。インターネットにつながっているか確かめてください。');
  }
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    let chars = 0;
    stream.on('text', (t) => {
      chars += t.length;
      onProgress?.(`読み取り中…（${chars} 文字）`);
    });
    message = await stream.finalMessage();
  } catch (err) {
    throw new Error(explainError(err, Anthropic));
  }

  if (message.stop_reason === 'refusal') throw new Error('この写真は読み取れませんでした。手で登録してください。');
  if (message.stop_reason === 'max_tokens') throw new Error('問題が多すぎて途中で切れました。写真を分けて読み取ってください。');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('読み取り結果の形式が正しくありませんでした。もう一度ためしてください。');
  }
  return {
    notes: data.notes || '',
    problems: (data.problems || []).map((p) => ({
      label: p.label || '',
      unit: p.unit || '',
      questionText: p.question_text || '',
      myAnswer: p.my_answer || '',
      correctAnswer: p.correct_answer || '',
      reason: REASON_IDS.includes(p.reason) ? p.reason : 'other',
      answerPage: clampPage(p.answer_page, answerPages.length),
      answerBox: toBox(p.answer_box),
      questionPage: clampPage(p.question_page, questionPages.length),
      questionBox: toBox(p.question_box),
    })),
  };
}

function clampPage(n, count) {
  const v = Math.round(Number(n));
  return v >= 1 && v <= count ? v - 1 : -1; // 0 始まり。-1 = 見つからない
}

// 1000 分率 → 0〜1 の割合（少しはみ出しても画像内に収める）
export function toBox(b) {
  if (!b || !(b.w > 0) || !(b.h > 0)) return null;
  const c = (v) => Math.min(1, Math.max(0, v / 1000));
  const x = c(b.x);
  const y = c(b.y);
  const w = Math.min(1 - x, c(b.w));
  const h = Math.min(1 - y, c(b.h));
  return w > 0.01 && h > 0.01 ? { x, y, w, h } : null;
}

function explainError(err, Anthropic) {
  if (Anthropic) {
    if (err instanceof Anthropic.AuthenticationError) return 'API キーが正しくありません。設定画面で確かめてください。';
    if (err instanceof Anthropic.PermissionDeniedError) return 'この API キーでは使えません（権限がありません）。';
    if (err instanceof Anthropic.RateLimitError) return '混み合っています。少し待ってからもう一度ためしてください。';
    if (err instanceof Anthropic.BadRequestError) return `送った内容に問題がありました（${err.message}）。写真の枚数を減らすと直ることがあります。`;
    if (err instanceof Anthropic.APIConnectionError) return 'インターネットにつながりませんでした。';
    if (err instanceof Anthropic.APIError) return `Claude API でエラーが起きました（${err.status ?? ''} ${err.message}）。`;
  }
  return `読み取りに失敗しました（${err && err.message ? err.message : err}）。`;
}
