import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('429') || msg.includes('503') || msg.includes('UNAVAILABLE');
      if (!isTransient || i === retries) break;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

const MODE_INSTRUCTIONS: Record<string, string> = {
  counselor: `Bạn là Cố vấn Tâm lý Học đường & Chuyên gia Rèn luyện Tập trung Deep Work của nền tảng Mindful AI (dành cho học sinh THPT).
Nhiệm vụ:
1. Lắng nghe ấm áp, không phán xét, giúp học sinh nhận diện "Bất hòa nhận thức số" (Cognitive Digital Dissonance - CDS-HS) như lướt video ngắn để né tránh bài khó, ảo giác "lướt 5 phút", hoặc cảm giác dằn vặt cuối buổi tối.
2. Đưa ra gợi ý hành động nhỏ gọn, thực tế (ví dụ: chia bài thành 10 phút đầu, thở 4-7-8, đặt điện thoại ngoài bàn học, bắt đầu 1 phiên Deep Work 25 phút).
3. Nếu phát hiện dấu hiệu khủng hoảng tâm lý nghiêm trọng, luôn nhắc nhẹ học sinh kết nối Tổng đài Quốc gia 111 (miễn phí 24/7) hoặc phòng tư vấn tâm lý trường.
Phong cách: Tiếng Việt tự nhiên, gần gũi với học sinh THPT, súc tích (khoảng 120–200 từ), trình bày rõ ràng bằng gạch đầu dòng ngắn khi cần.`,

  math: `Bạn là Gia sư Toán THPT tận tâm trên nền tảng Mindful AI.
Nhiệm vụ:
1. Hướng dẫn giải từng bước rõ ràng theo phương pháp gợi mở Socratic — không chỉ đưa đáp án mà giải thích bản chất công thức, điều kiện áp dụng và lỗi sai thường gặp.
2. Hỗ trợ Đại số, Giải tích, Hình học không gian, Xác suất thống kê THPT.
3. Trình bày công thức toán học sạch sẽ, dễ đọc trên màn hình web (dùng ký hiệu Unicode rõ ràng như √, ∫, π, ≤, ≥, ^2 hoặc Markdown gọn), cuối câu trả lời gợi ý 1 bài tập hoặc bước thực hành 10 phút Deep Work.`,

  literature: `Bạn là Gia sư Ngữ văn THPT sâu sắc và truyền cảm hứng trên Mindful AI.
Nhiệm vụ:
1. Giúp học sinh lập dàn ý nghị luận xã hội, phân tích tác phẩm văn học, tìm luận điểm sắc bén và dẫn chứng thuyết phục.
2. Hướng dẫn cách viết mở bài ấn tượng, kết bài giàu chiều sâu mà không sáo rỗng.
3. Gợi ý cách đọc sâu (Deep Reading) 15–25 phút không bị ngắt quãng bởi mạng xã hội.`,

  english: `Bạn là Gia sư Tiếng Anh THPT trên Mindful AI (luyện thi tốt nghiệp THPT & IELTS cơ bản).
Nhiệm vụ:
1. Giải thích ngữ pháp, từ vựng theo ngữ cảnh, viết lại câu, sửa lỗi bài viết và luyện đọc hiểu.
2. Giải thích bằng tiếng Việt dễ hiểu kèm ví dụ tiếng Anh chuẩn xác và mẹo ghi nhớ nhanh.
3. Khuyến khích học sinh thực hành ngay 3–5 câu ngắn trong phiên học tập trung.`,
};

interface CounselorBody {
  mode?: string;
  message?: string;
  history?: Array<{ role: string; text: string }>;
  context?: {
    treeName?: string;
    level?: number;
    lastCdsScore?: number | null;
    todayFocusMins?: number;
    streakDays?: number;
  };
}

interface JournalBody {
  mood?: string;
  screenTime?: string;
  deepWorkNote?: string;
  distractionLesson?: string;
  gratitude?: string;
  tomorrowPlan?: string;
  cdsScore?: number | null;
}

interface BreakdownBody {
  goal?: string;
  subjectHint?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'mindful-ai-server' });
  });

  app.post('/api/ai/counselor', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as CounselorBody;
      const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
      if (!userMessage || userMessage.length > 2000) {
        res.status(400).json({ error: 'Nội dung câu hỏi phải từ 1 đến 2000 ký tự.' });
        return;
      }

      const mode = body.mode && MODE_INSTRUCTIONS[body.mode] ? body.mode : 'counselor';
      const ctx = body.context || {};
      const contextSummary = [
        ctx.treeName ? `Tên cây 3D: "${ctx.treeName}" (Cấp ${ctx.level || 1}/10)` : null,
        ctx.lastCdsScore ? `Chỉ số CDS-HS gần nhất: ${ctx.lastCdsScore}/5.0` : null,
        typeof ctx.todayFocusMins === 'number' ? `Thời gian Deep Work hôm nay: ${ctx.todayFocusMins} phút` : null,
        typeof ctx.streakDays === 'number' ? `Chuỗi ngày học: ${ctx.streakDays} ngày` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const systemInstruction =
        MODE_INSTRUCTIONS[mode] +
        (contextSummary ? `\n\nNgữ cảnh hiện tại của học sinh: ${contextSummary}.` : '');

      const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const contents = [
        ...history
          .filter((m) => m && typeof m.text === 'string' && m.text.trim())
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text.slice(0, 2000) }],
          })),
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ];

      const ai = getGeminiClient();
      const thinkingLevel = mode === 'math' ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel },
          },
        }),
      );

      const reply = (response.text || '').trim();
      if (!reply) {
        res.status(502).json({ error: 'Mô hình AI chưa trả về nội dung phản hồi.' });
        return;
      }

      res.json({ reply, mode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Gemini AI.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/analyze-journal', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as JournalBody;
      const lesson = typeof body.distractionLesson === 'string' ? body.distractionLesson.trim() : '';
      const mood = typeof body.mood === 'string' ? body.mood.trim() : '';
      const screenTime = typeof body.screenTime === 'string' ? body.screenTime.trim() : '';
      const deepWorkNote = typeof body.deepWorkNote === 'string' ? body.deepWorkNote.trim() : '';
      const gratitude = typeof body.gratitude === 'string' ? body.gratitude.trim() : '';
      const tomorrowPlan = typeof body.tomorrowPlan === 'string' ? body.tomorrowPlan.trim() : '';

      if (!lesson && !mood && !tomorrowPlan) {
        res.status(400).json({ error: 'Vui lòng nhập nội dung sổ tay trước khi phân tích.' });
        return;
      }

      const prompt = `Phân tích Sổ tay Phản chiếu Tâm lý 7 Mục của học sinh THPT dựa trên mô hình Bất hòa nhận thức số (CDS-HS):
- Cảm xúc hôm nay: ${mood || 'Không rõ'}
- Thời gian màn hình giải trí: ${screenTime || 'Không rõ'}
- Phiên Deep Work: ${deepWorkNote || 'Không rõ'}
- Điều khiến xao nhãng & bài học: ${lesson || 'Không có'}
- Điều tự hào/biết ơn: ${gratitude || 'Không có'}
- Cam kết ngày mai: ${tomorrowPlan || 'Không có'}
- Chỉ số CDS-HS gần nhất: ${body.cdsScore ? `${body.cdsScore}/5.0` : 'Chưa đo'}

Hãy trả về JSON chuẩn bằng tiếng Việt tự nhiên, thấu cảm và mang tính khoa học hành vi.`;

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là chuyên gia tâm lý học đường phân tích bẫy nhận thức số (CDS-HS) cho học sinh THPT. Hãy phản hồi ngắn gọn, thực tế, không phán xét.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                cognitiveTrap: {
                  type: Type.STRING,
                  description:
                    'Tên bẫy nhận thức ngắn gọn (tối đa 90 ký tự), ví dụ: "Ảo giác kiểm soát 5 phút" hoặc "Né tránh cảm xúc khó chịu".',
                },
                insight: {
                  type: Type.STRING,
                  description:
                    'Phân tích Socratic súc tích (2-3 câu, tối đa 360 ký tự) giải thích cơ chế tâm lý và ghi nhận nỗ lực của học sinh.',
                },
                nextStep: {
                  type: Type.STRING,
                  description:
                    'Một hành động cụ thể theo lộ trình CDS-HS cho ngày mai (1 câu, tối đa 180 ký tự).',
                },
                riskLevel: {
                  type: Type.STRING,
                  description: 'Mức độ rủi ro CDS-HS: "low", "moderate", hoặc "high".',
                },
              },
              required: ['cognitiveTrap', 'insight', 'nextStep', 'riskLevel'],
            },
          },
        }),
      );

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw) as {
        cognitiveTrap?: string;
        insight?: string;
        nextStep?: string;
        riskLevel?: string;
      };

      res.json({
        cognitiveTrap: String(parsed.cognitiveTrap || 'Nhận diện thói quen số').slice(0, 140),
        insight: String(parsed.insight || '').slice(0, 700),
        nextStep: String(parsed.nextStep || '').slice(0, 350),
        riskLevel: parsed.riskLevel === 'high' || parsed.riskLevel === 'moderate' ? parsed.riskLevel : 'low',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể phân tích Sổ tay với Gemini AI.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/breakdown-goal', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as BreakdownBody;
      const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
      if (!goal || goal.length > 400) {
        res.status(400).json({ error: 'Vui lòng nhập mục tiêu học tập từ 1 đến 400 ký tự.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Mục tiêu học tập của học sinh THPT: "${goal}". ${body.subjectHint ? `Môn ưu tiên: ${body.subjectHint}.` : ''}\nHãy chia nhỏ mục tiêu này thành 3 đến 5 nhiệm vụ học tập Deep Work cụ thể, có thể bắt đầu ngay trong 15–45 phút.`,
          config: {
            systemInstruction:
              'Bạn là cố vấn phương pháp học Deep Work cho học sinh THPT Việt Nam. Trả về danh sách nhiệm vụ ngắn gọn, rõ ràng, sát thực tế.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: 'Tên nhiệm vụ cụ thể, ngắn gọn (tối đa 120 ký tự).',
                      },
                      category: {
                        type: Type.STRING,
                        description: 'Chọn đúng 1 trong: "Toán Học", "Văn Học", "Khoa Học", "Ngoại Ngữ".',
                      },
                      estimatedMins: {
                        type: Type.INTEGER,
                        description: 'Thời lượng khuyến nghị (15, 25, 35, hoặc 45).',
                      },
                    },
                    required: ['text', 'category', 'estimatedMins'],
                  },
                },
              },
              required: ['tasks'],
            },
          },
        }),
      );

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw) as {
        tasks?: Array<{ text?: string; category?: string; estimatedMins?: number }>;
      };

      const allowedCats = new Set(['Toán Học', 'Văn Học', 'Khoa Học', 'Ngoại Ngữ']);
      const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : [])
        .slice(0, 6)
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        .map((t) => ({
          text: String(t.text).trim().slice(0, 200),
          category: t.category && allowedCats.has(t.category) ? t.category : 'Khoa Học',
          estimatedMins: Math.max(10, Math.min(90, Math.round(Number(t.estimatedMins) || 25))),
        }));

      res.json({ tasks });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể chia nhỏ mục tiêu bằng Gemini AI.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/cds-advice', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        answers?: unknown;
        score?: unknown;
        treeName?: string;
        fullname?: string;
        todayFocusMins?: number;
        streakDays?: number;
      };

      const answers = Array.isArray(body.answers)
        ? body.answers.map((v) => Math.max(1, Math.min(5, Math.round(Number(v) || 3))))
        : [];
      if (answers.length !== 10) {
        res.status(400).json({ error: 'Cần đủ 10 câu trả lời CDS-HS hợp lệ (1–5).' });
        return;
      }

      const computedScore = Number((answers.reduce((a, b) => a + b, 0) / 10).toFixed(2));
      const score = typeof body.score === 'number' && Number.isFinite(body.score) ? body.score : computedScore;

      const CDS_THEMES = [
        '1. Bồn chồn khi không kiểm tra điện thoại/MXH lúc học',
        '2. Tự nhủ lướt vài phút nhưng bị cuốn quá dự định',
        '3. Dằn vặt buổi tối vì lướt mạng thay vì ôn bài',
        '4. Thông báo MXH làm đứt mạch khi giải bài khó',
        '5. Mở app giải trí để né tránh áp lực/chán nản',
        '6. Video ngắn làm khó tập trung đọc sâu nội dung dài',
        '7. Dùng điện thoại trước ngủ ảnh hưởng giấc ngủ',
        '8. Khó giữ trọn một phiên tự học không phân tâm',
        '9. So sánh bản thân trên MXH gây áp lực tinh thần',
        '10. Mâu thuẫn giữa mục tiêu học tập và thói quen số',
      ];

      const summaryLines = CDS_THEMES.map((label, idx) => `- ${label}: ${answers[idx]}/5`).join('\n');
      const studentName = typeof body.fullname === 'string' && body.fullname.trim() ? body.fullname.trim() : 'bạn';
      const treeName = typeof body.treeName === 'string' && body.treeName.trim() ? body.treeName.trim() : 'Cây Tri Thức';

      const prompt = `Học sinh "${studentName}" (cây 3D: "${treeName}", chuỗi ${Number(body.streakDays) || 1} ngày, hôm nay đã tập trung ${Number(body.todayFocusMins) || 0} phút) vừa hoàn thành 10 câu hỏi CDS-HS ngay khi đăng nhập với điểm trung bình ${score.toFixed(2)}/5.00:
${summaryLines}

Hãy đưa ra phản hồi NGAY LẬP TỨC cho buổi học sắp tới của học sinh này theo JSON chuẩn tiếng Việt:
- Phân tích sát những mục có điểm cao nhất (4-5) để khuyên cách giữ tập trung hiệu quả ngay trong buổi học này (gợi ý cụ thể thời lượng Deep Work 15/25/45 phút, âm thanh Alpha/Beta/Theta/Mưa rừng hoặc nhịp thở 4-7-8).
- Gửi một lời chúc chân thành, ấm áp và tiếp lửa động lực cho buổi học hôm nay.`;

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là Linh Mộc Quản Gia & Cố vấn Tâm lý học đường Mindful AI. Hãy phản hồi ngắn gọn, ấm áp, tích cực, sát thực tế cho học sinh THPT chuẩn bị vào buổi học.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                statusLabel: {
                  type: Type.STRING,
                  description: 'Nhãn trạng thái ngắn gọn (tối đa 45 ký tự), VD: "Tâm trí vững vàng" hoặc "Dễ xao nhãng nhẹ".',
                },
                studyAdvice: {
                  type: Type.STRING,
                  description: 'Lời khuyên cụ thể cho buổi học ngay lúc này dựa trên các câu điểm cao (2-3 câu, tối đa 340 ký tự).',
                },
                recommendedFocusMins: {
                  type: Type.INTEGER,
                  description: 'Thời lượng phiên Deep Work khuyến nghị cho buổi học này: 15, 25, hoặc 45.',
                },
                recommendedSound: {
                  type: Type.STRING,
                  description: 'Chế độ âm thanh khuyến nghị: "alpha", "beta", "theta", hoặc "rain".',
                },
                warmWish: {
                  type: Type.STRING,
                  description: 'Lời chúc ấm áp, truyền động lực cho buổi học hôm nay (1-2 câu, tối đa 220 ký tự).',
                },
              },
              required: ['statusLabel', 'studyAdvice', 'recommendedFocusMins', 'recommendedSound', 'warmWish'],
            },
          },
        }),
      );

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw) as {
        statusLabel?: string;
        studyAdvice?: string;
        recommendedFocusMins?: number;
        recommendedSound?: string;
        warmWish?: string;
      };

      const validMins = [15, 25, 45];
      const minsRaw = Math.round(Number(parsed.recommendedFocusMins) || 25);
      const recommendedFocusMins = validMins.includes(minsRaw) ? minsRaw : score >= 3.4 ? 15 : 25;
      const validSounds = new Set(['alpha', 'beta', 'theta', 'rain']);
      const recommendedSound =
        parsed.recommendedSound && validSounds.has(parsed.recommendedSound) ? parsed.recommendedSound : 'rain';

      if (!parsed.studyAdvice || !parsed.warmWish) {
        res.status(502).json({ error: 'Gemini AI chưa trả về đầy đủ lời khuyên và lời chúc.' });
        return;
      }

      res.json({
        statusLabel: String(parsed.statusLabel || 'Sẵn sàng học tập').slice(0, 60),
        studyAdvice: String(parsed.studyAdvice).slice(0, 500),
        recommendedFocusMins,
        recommendedSound,
        warmWish: String(parsed.warmWish).slice(0, 320),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo lời khuyên từ Gemini AI.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/deepwork-reflection-questions', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        durationMins?: number;
        intention?: string;
        taskText?: string;
        interruptionCount?: number;
        awaySecs?: number;
        soundMode?: string;
        isGroupSession?: boolean;
        groupSize?: number;
        lastCdsScore?: number | null;
        fullname?: string;
        treeName?: string;
      };

      const durationMins = Math.max(1, Math.min(240, Math.round(Number(body.durationMins) || 25)));
      const interruptionCount = Math.max(0, Math.round(Number(body.interruptionCount) || 0));
      const awaySecs = Math.max(0, Math.round(Number(body.awaySecs) || 0));
      const intention = typeof body.intention === 'string' && body.intention.trim()
        ? body.intention.trim().slice(0, 140)
        : 'Tập trung tự học';
      const taskText = typeof body.taskText === 'string' && body.taskText.trim()
        ? body.taskText.trim().slice(0, 200)
        : '';
      const soundLabelMap: Record<string, string> = {
        none: 'Im lặng',
        alpha: 'Sóng Alpha 10Hz',
        beta: 'Sóng Beta 18Hz',
        theta: 'Sóng Theta 6Hz',
        rain: 'Tiếng Mưa Rừng',
      };
      const soundLabel = soundLabelMap[body.soundMode || 'none'] || 'Im lặng';
      const studentName = typeof body.fullname === 'string' && body.fullname.trim() ? body.fullname.trim() : 'bạn';
      const treeName = typeof body.treeName === 'string' && body.treeName.trim() ? body.treeName.trim() : 'Cây Tri Thức';

      const prompt = `Học sinh "${studentName}" (cây 3D "${treeName}") vừa hoàn thành một phiên Deep Work với dữ liệu thực tế sau:
- Thời lượng tập trung: ${durationMins} phút (${body.isGroupSession ? `Học nhóm ${body.groupSize || 2} người` : 'Học cá nhân'})
- Mục tiêu phiên học: "${intention}"${taskText ? ` (Nhiệm vụ gắn kèm: "${taskText}")` : ''}
- Âm thanh nền sử dụng: ${soundLabel}
- Số lần rời tab / gián đoạn trong phiên: ${interruptionCount} lần (tổng thời gian rời tab: ${awaySecs} giây)
- Chỉ số CDS-HS gần nhất: ${typeof body.lastCdsScore === 'number' ? `${body.lastCdsScore.toFixed(2)} / 5.0` : 'Chưa đo'}

Dựa CHÍNH XÁC trên dữ liệu phiên học trên, hãy tạo bộ "Tự phản chiếu" ngắn gọn giúp học sinh tự nâng cao nhận thức về Bất hòa nhận thức số (CDS-HS):
1. Viết 1 nhận xét ngắn (1-2 câu) ghi nhận kết quả phiên học dựa trên số phút, mục tiêu và số lần gián đoạn.
2. Đặt ĐÚNG 3 câu hỏi ngắn, dễ hiểu bằng tiếng Việt:
   - Câu 1: Về mức độ nhập tâm & cảm xúc khi làm mục tiêu "${intention}" (hoặc sự phù hợp của môi trường ${soundLabel}).
   - Câu 2: Về nhận thức CDS-HS / xung lực số trong phiên (${interruptionCount > 0 ? `hỏi nhẹ nhàng về khoảnh khắc ${interruptionCount} lần rời tab ${awaySecs}s — do cần tra cứu hay bị thôi thúc kiểm tra mạng/né tránh bài khó` : 'hỏi về cách học sinh đã vượt qua thôi thúc cầm điện thoại/mở tab giải trí trong suốt phiên'}).
   - Câu 3: Về bài học hoặc điều chỉnh nhỏ nhất cho phiên tập trung tiếp theo.
3. Với mỗi câu hỏi, gợi ý 3 lựa chọn trả lời nhanh ngắn gọn (mỗi chip dưới 45 ký tự) để học sinh có thể chọn 1 chạm hoặc tự viết.`;

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là chuyên gia tâm lý học đường & phương pháp Deep Work Mindful AI. Hãy đặt 3 câu hỏi tự phản chiếu ấm áp, không phán xét, súc tích, giúp học sinh THPT tự nhận diện Bất hòa nhận thức số (CDS-HS).',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sessionAssessment: {
                  type: Type.STRING,
                  description: 'Nhận xét ngắn gọn 1-2 câu dựa trực tiếp trên dữ liệu phiên học.',
                },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: {
                        type: Type.STRING,
                        description: 'Mã câu hỏi: "q1", "q2", hoặc "q3".',
                      },
                      focusArea: {
                        type: Type.STRING,
                        description: 'Nhãn chủ đề ngắn (tối đa 35 ký tự), VD: "Độ sâu tập trung", "Nhận thức CDS-HS", "Bước tiếp theo".',
                      },
                      question: {
                        type: Type.STRING,
                        description: 'Câu hỏi phản chiếu ngắn gọn, 1 câu rõ ràng (tối đa 190 ký tự).',
                      },
                      quickChips: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Đúng 3 gợi ý trả lời nhanh ngắn gọn (mỗi gợi ý tối đa 45 ký tự).',
                      },
                    },
                    required: ['id', 'focusArea', 'question', 'quickChips'],
                  },
                },
              },
              required: ['sessionAssessment', 'questions'],
            },
          },
        }),
      );

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw) as {
        sessionAssessment?: string;
        questions?: Array<{
          id?: string;
          focusArea?: string;
          question?: string;
          quickChips?: string[];
        }>;
      };

      const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
        .filter((q) => q && typeof q.question === 'string' && q.question.trim())
        .slice(0, 3)
        .map((q, idx) => ({
          id: q.id || `q${idx + 1}`,
          focusArea: String(q.focusArea || `Phản chiếu #${idx + 1}`).slice(0, 45),
          question: String(q.question).trim().slice(0, 240),
          quickChips: (Array.isArray(q.quickChips) ? q.quickChips : [])
            .filter((c) => typeof c === 'string' && c.trim())
            .slice(0, 3)
            .map((c) => c.trim().slice(0, 60)),
        }));

      if (!parsed.sessionAssessment || questions.length < 3) {
        res.status(502).json({ error: 'Gemini AI chưa trả về đủ 3 câu hỏi tự phản chiếu.' });
        return;
      }

      res.json({
        sessionAssessment: String(parsed.sessionAssessment).trim().slice(0, 360),
        questions,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo câu hỏi tự phản chiếu với Gemini AI.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/deepwork-reflection-feedback', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        durationMins?: number;
        intention?: string;
        interruptionCount?: number;
        awaySecs?: number;
        focusScore?: number;
        lastCdsScore?: number | null;
        answers?: Array<{ question?: string; answer?: string }>;
      };

      const answers = Array.isArray(body.answers)
        ? body.answers
            .filter((a) => a && typeof a.question === 'string' && typeof a.answer === 'string' && a.answer.trim())
            .slice(0, 3)
        : [];

      if (answers.length === 0) {
        res.status(400).json({ error: 'Vui lòng trả lời ít nhất 1 câu hỏi phản chiếu.' });
        return;
      }

      const qaLines = answers
        .map((a, idx) => `${idx + 1}. Hỏi: ${a.question}\n   Trả lời: ${a.answer?.trim().slice(0, 300)}`)
        .join('\n');

      const prompt = `Dữ liệu phiên Deep Work vừa hoàn thành:
- Thời lượng: ${Number(body.durationMins) || 25} phút | Mục tiêu: "${String(body.intention || 'Tập trung').slice(0, 140)}"
- Số lần rời tab: ${Number(body.interruptionCount) || 0} lần (${Number(body.awaySecs) || 0}s)
- Tự đánh giá mức nhập tâm: ${Number(body.focusScore) || 4}/5
- Chỉ số CDS-HS trước đó: ${typeof body.lastCdsScore === 'number' ? `${body.lastCdsScore.toFixed(2)}/5.0` : 'Chưa đo'}

Câu trả lời tự phản chiếu của học sinh:
${qaLines}

Hãy phân tích ngắn gọn giúp học sinh tự nâng cao nhận thức về Bất hòa nhận thức số (CDS-HS):
- Chỉ ra trạng thái/khuynh hướng nhận thức số (cognitiveTrap) một cách tích cực hoặc mang tính soi chiếu.
- Viết cdsInsight (2-3 câu) giúp học sinh hiểu rõ mối liên hệ giữa cảm xúc, thói quen số và sự tập trung của mình.
- Đề xuất 1 hành động nhỏ cụ thể (nextMicroHabit) cho phiên Deep Work kế tiếp.`;

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là Cố vấn Tâm lý Học đường Mindful AI. Phản hồi súc tích, thấu cảm, giàu tính tự nhận thức về CDS-HS bằng tiếng Việt.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                cognitiveTrap: {
                  type: Type.STRING,
                  description: 'Nhãn nhận diện khuynh hướng tập trung / CDS-HS (tối đa 100 ký tự).',
                },
                cdsInsight: {
                  type: Type.STRING,
                  description: 'Phân tích phản hồi 2-3 câu giúp nâng cao nhận thức CDS-HS (tối đa 420 ký tự).',
                },
                nextMicroHabit: {
                  type: Type.STRING,
                  description: 'Một thói quen nhỏ cụ thể cho phiên học tiếp theo (1 câu, tối đa 200 ký tự).',
                },
              },
              required: ['cognitiveTrap', 'cdsInsight', 'nextMicroHabit'],
            },
          },
        }),
      );

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw) as {
        cognitiveTrap?: string;
        cdsInsight?: string;
        nextMicroHabit?: string;
      };

      if (!parsed.cdsInsight) {
        res.status(502).json({ error: 'Gemini AI chưa trả về phân tích tự phản chiếu.' });
        return;
      }

      res.json({
        cognitiveTrap: String(parsed.cognitiveTrap || 'Nhận thức chủ động số').trim().slice(0, 140),
        cdsInsight: String(parsed.cdsInsight).trim().slice(0, 700),
        nextMicroHabit: String(parsed.nextMicroHabit || 'Giữ điện thoại ngoài tầm tay trong 15 phút đầu.').trim().slice(0, 350),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể phân tích tự phản chiếu với Gemini AI.';
      res.status(500).json({ error: msg });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mindful AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
