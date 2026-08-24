const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// 加载 Prompt 模板
const classifierPrompt = require("./prompts/classifier");
const modulePrompts = {
  "政治理论": require("./prompts/politics"),
  "常识判断": require("./prompts/common_sense"),
  "言语理解": require("./prompts/verbal"),
  "数量关系": require("./prompts/quantitative"),
  "判断推理": require("./prompts/judgment"),
  "资料分析": require("./prompts/data_analysis"),
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function getApiKey(req) {
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey && envKey !== "sk-your-api-key-here") return envKey;
  return req.body.apiKey || "";
}

async function callDeepSeek(apiKey, systemPrompt, userContent, temperature = 0.4) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) throw { status: 401, message: "API Key 无效，请检查后重试" };
    throw { status: response.status, message: "DeepSeek API 调用失败: " + err };
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// 解析标准化
function parseAnalysis(raw, module) {
  const fallback = {
    module,
    question: "",
    solution: raw,
    answer: "",
    knowledgePoints: [],
    tips: "",
    rawMarkdown: raw,
  };

  try {
    const questionMatch = raw.match(/###\s*📌\s*题目原文\s*\n([\s\S]*?)(?=###|🔑|$)/);
    const answerMatch = raw.match(/###\s*✅\s*正确答案\s*\n([\s\S]*?)(?=###|📚|⚠️|$)/);
    const knowledgeMatch = raw.match(/###\s*📚\s*核心知识点[积学]*\s*\n([\s\S]*?)(?=###|⚠️|$)/);
    const tipsMatch = raw.match(/###\s*⚠️\s*同类陷阱[预]*\s*\n([\s\S]*?)(?=$)/);

    return {
      module,
      question: questionMatch ? questionMatch[1].trim() : "",
      answer: answerMatch ? answerMatch[1].trim() : "",
      solution: raw, // 完整 Markdown 作为 solution
      knowledgePoints: knowledgeMatch
        ? knowledgeMatch[1]
            .trim()
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => l.replace(/^[\d.\-•]+\s*/, "").trim())
        : [],
      tips: tipsMatch ? tipsMatch[1].trim() : "",
      rawMarkdown: raw,
    };
  } catch {
    return fallback;
  }
}

// ===== 阶段一：模块分类 =====
app.post("/api/classify", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "题目文本不能为空" });
  }

  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "no_api_key", message: "请先在设置中配置 DeepSeek API Key" });
  }

  try {
    const prompt = classifierPrompt.replace("{{text}}", text);
    const result = await callDeepSeek(apiKey, "你是一个行测题目分类器，只输出模块名称。", prompt, 0.1);
    const module = result.trim();
    const validModules = ["政治理论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析"];
    const finalModule = validModules.includes(module) ? module : "常识判断";
    res.json({ module: finalModule });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "分类失败" });
  }
});

// ===== 阶段二：深度解析 =====
app.post("/api/analyze", async (req, res) => {
  const { text, module: forceModule, userThought, userAnswer, detectedCorrect } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "题目文本不能为空" });
  }

  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "no_api_key", message: "请先在设置中配置 DeepSeek API Key" });
  }

  // 确定使用的模块 Prompt
  let module = forceModule;
  if (!module || !modulePrompts[module]) {
    try {
      const classPrompt = classifierPrompt.replace("{{text}}", text);
      const clsResult = await callDeepSeek(apiKey, "你是一个行测题目分类器，只输出模块名称。", classPrompt, 0.1);
      module = clsResult.trim();
      if (!modulePrompts[module]) module = "常识判断";
    } catch {
      module = "常识判断";
    }
  }

  // 深度解析
  try {
    let prompt = modulePrompts[module];
    prompt = prompt.replace("{{text}}", text.trim());

    // 注入考生思考过程（缺省提示，引导模型按通用模式分析错因）
    const thought = userThought && userThought.trim()
      ? userThought.trim()
      : "（考生未提供思考过程——请按通用模式分析可能的错因）";
    prompt = prompt.replace("{{userThought}}", thought);

    // 注入考生答案（缺省提示）
    const answer = userAnswer && userAnswer.trim()
      ? userAnswer.trim()
      : "（未提供）";
    prompt = prompt.replace("{{userAnswer}}", answer);

    // 注入 OCR/正则识别到的正确答案；未识别时填缺省值，避免占位符原样发送给模型
    const correct = detectedCorrect && detectedCorrect.trim()
      ? detectedCorrect.trim()
      : "（未识别）";
    prompt = prompt.replace("{{correctAnswer}}", correct);
    if (detectedCorrect && detectedCorrect.trim()) {
      // 同步把"题目原文"板块的示例标注（**正确答案**：X）替换为真实答案
      prompt = prompt.replace(/\*\*正确答案\*\*[：:]\s*[A-DX]?/g, "**正确答案**：" + correct);
    }

    const rawResult = await callDeepSeek(apiKey, "你是一个专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。", prompt, 0.4);
    const analysis = parseAnalysis(rawResult, module);
    res.json(analysis);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "解析失败" });
  }
});

// ===== 接续对话 =====
app.post("/api/chat", async (req, res) => {
  const { questionText, analysisText, history, message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "no_api_key", message: "请先在设置中配置 DeepSeek API Key" });
  }

  const systemPrompt = `你是一位耐心、专业的行测辅导老师。现在学生正在针对一道行测题目进行追问。
你了解这道题的完整内容和解析。请根据学生的追问，给出针对性、详细的解答。

题目原文：
${questionText || "（无）"}

完整解析：
${analysisText || "（无）"}

对话规则：
1. 如果学生问某个选项为什么错，请深入展开该选项的"设错本质"
2. 如果学生说"我当时的思路是…"，请仔细分析这个思路的漏洞，指出错因，并给出正确思路
3. 如果学生表达困惑，请用更通俗、更生动的方式解释
4. 回答要具体、有针对性，像私教一对一辅导
5. 关键概念用**加粗**标注`;

  const recentHistory = (history || []).slice(-10);

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((h) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.5,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401) throw { status: 401, message: "API Key 无效" };
      throw { status: response.status, message: "DeepSeek 调用失败: " + err };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答。";

    res.json({ reply });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "对话失败" });
  }
});


// ===== AI 识别答案（OCR提取不到时的降级方案） =====
app.post('/api/detect-answer', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '文本为空' });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'no_api_key' });

  try {
    const prompt = '下面是一道行测题目。请从题目文字中识别正确答案和\"我的答案\"（或\"你的答案\"）。只输出JSON格式，不要其他内容：\n\n' + text + '\n\n输出格式：{"correct":"A/B/C/D或空","userAnswer":"A/B/C/D或空"}\n如果找不到，对应字段输出空字符串。';

    const content = await callDeepSeek(apiKey, '你是一个行测题目答案提取器，只输出JSON。', prompt, 0.1);
    const cleaned = content.replace(/`json\n?/g, '').replace(/`\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '识别失败' });
  }
});


function getDashScopeKey(req) {
  const envKey = process.env.DASHSCOPE_API_KEY;
  if (envKey && envKey !== "sk-your-dashscope-key-here") return envKey;
  return req.body.dashscopeApiKey || "";
}

// ===== Qwen-VL 看图识字 =====
app.post("/api/ocr-vision", async (req, res) => {
  const { imageData } = req.body;
  if (!imageData) return res.status(400).json({ error: "图片数据不能为空" });

  const apiKey = getDashScopeKey(req);
  if (!apiKey) return res.status(401).json({ error: "no_api_key", message: "请先在设置中配置 DashScope API Key" });

  try {
    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "qwen-vl-plus",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageData } },
            { type: "text", text: "请仔细阅读这张行测题目截图（公务员考试行测真题），精确提取信息并以JSON返回。\n\n【格式规则 - 严格遵守】\n- 所有数字和符号原样输出，不要改变格式\n- 分数统一写成 a/b 形式（如 14/25，不要用 LaTeX）\n- 百分号保持原样（如 55%）\n- 数学公式中的数字直接写（如 2:3、x+3=5）\n- 标点符号保持原文（中文用中文标点，英文用英文标点）\n- 选项必须分行排列，每个选项独占一行，格式为 A. 选项内容、B. 选项内容、C. 选项内容、D. 选项内容\n\n【答案提取 - 最重要】\n截图底部通常有统计表，表头是「正确答案 你的答案 全站正确率 答题用时 易错项」。\n请从统计表中准确提取：\n1. 如果有「你的答案」列（说明这题做错了）：第一列是正确答案，第二列是你的答案。例如数据行「A D 55% 31B D」→ correctAnswer=A，userAnswer=D\n2. 如果没有「你的答案」列（说明这题做对了）：只有一列答案，此时 userAnswer 必须等于 correctAnswer。例如「B 87x 1920 比 A」→ correctAnswer=B，userAnswer=B\n3. 百分号可能被识别成 x 或 X，时间可能被识别成奇怪的数字，不要被干扰，只专注提取答案字母\n4. 答案只能是 A/B/C/D 四个字母之一\n5. 【重要】如果统计表缺失、被截断、模糊不清，或无法 100% 确认答案字母，对应字段必须返回空字符串\"\"，严禁猜测字母。宁可空着让用户手动确认，也不要给出错误的答案\n6. 答案列字母通常是统计表数据行中最靠前的字母，注意区分 B/D、C/G、O/Q 等形近字母\n\n【JSON格式】\n{\n  \"question\": \"题目完整原文（含选项，保持排版）\",\n  \"correctAnswer\": \"A/B/C/D\",\n  \"userAnswer\": \"A/B/C/D 或空字符串\"\n}\n\n只返回JSON本身，不要Markdown包裹。" }
          ]
        }],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401) return res.status(401).json({ error: "DashScope API Key 无效" });
      return res.status(response.status).json({ error: "Qwen-VL 调用失败: " + err });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    let result = { question: content, correctAnswer: "", userAnswer: "" };
    try {
      var cleaned = content;
      // Strip markdown code fences
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      const parsed = JSON.parse(cleaned);
      result.question = parsed.question || content;
      result.correctAnswer = (parsed.correctAnswer || "").toUpperCase();
      result.userAnswer = (parsed.userAnswer || "").toUpperCase();
    } catch(e) {
      result.question = content;
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "OCR识别失败" });
  }
});


// ===== SenseVoice 语音转文字 =====
app.post("/api/speech-to-text", async (req, res) => {
  const { audio, mimeType } = req.body;
  if (!audio) return res.status(400).json({ error: "音频数据不能为空" });

  const apiKey = getDashScopeKey(req);
  if (!apiKey) return res.status(401).json({ error: "no_api_key", message: "请先在设置中配置 DashScope API Key" });

  try {
    // Convert base64 to Buffer, use native FormData (Node 18+)
    const audioBuf = Buffer.from(audio, "base64");
    const form = new FormData();
    const blob = new Blob([audioBuf], { type: mimeType || "audio/webm" });
    form.append("model", "paraformer-v2");
    form.append("file", blob, "audio.webm");
    form.append("sample_rate", "16000");
    form.append("format", "webm");

    const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
      },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401) return res.status(401).json({ error: "DashScope API Key 无效" });
      return res.status(response.status).json({ error: "SenseVoice 调用失败: " + err });
    }

    const data = await response.json();
    const text = data.output?.text || (data.output?.results?.[0]?.text) || "（未识别到语音）";
    res.json({ text: text });
  } catch (err) {
    res.status(500).json({ error: err.message || "语音识别失败" });
  }
});

app.listen(PORT, () => {
  console.log(`行测备考助手已启动: http://localhost:${PORT}`);
});

