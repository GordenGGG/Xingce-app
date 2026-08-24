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

async function callDeepSeek(apiKey, systemPrompt, userContent, temperature = 0.4, model = "deepseek-chat") {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: 8192,
  };
  // deepseek-reasoner 不支持 temperature 参数
  if (model !== "deepseek-reasoner") body.temperature = temperature;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000), // 防止调用挂死
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) throw { status: 401, message: "API Key 无效，请检查后重试" };
    throw { status: response.status, message: "DeepSeek API 调用失败: " + err };
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ===== DeepSeek Responses API（内置 web_search 联网搜索，用于政治理论模块） =====
async function callDeepSeekSearch(apiKey, systemPrompt, userContent) {
  const response = await fetch("https://api.deepseek.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userContent }] },
      ],
    }),
    signal: AbortSignal.timeout(120000), // 联网搜索较慢，120s 上限
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) throw { status: 401, message: "API Key 无效，请检查后重试" };
    throw { status: response.status, message: "DeepSeek 联网搜索调用失败: " + err };
  }

  const data = await response.json();
  // Responses API 输出：output 数组中的 message 项，content 里 type=output_text 的 text
  const outputs = data.output || [];
  return outputs
    .filter((o) => o.type === "message")
    .map((o) => (o.content || []).map((c) => (c.type === "output_text" ? c.text : "")).join(""))
    .join("");
}

// 解析标准化：优先解析双层输出协议的 JSON 结构头，字段缺失时回退旧正则
function parseAnalysis(raw, module) {
  const fallback = {
    module,
    question: "",
    solution: raw,
    answer: "",
    knowledgePoints: [],
    tips: "",
    difficulty: "",
    answerSuspicious: false,
    rawMarkdown: raw,
  };

  // 第一步：尝试解析 JSON 结构头（<<<JSON_START>>> ... <<<JSON_END>>>）
  let structured = null;
  try {
    const m = raw.match(/<<<JSON_START>>>\s*([\s\S]*?)\s*<<<JSON_END>>>/);
    if (m) structured = JSON.parse(m[1].trim());
  } catch (e) {
    structured = null;
  }

  // 第二步：旧正则回退（JSON 缺失或某字段缺失时使用；兼容新旧两种标题写法）
  const questionMatch = raw.match(/(?:##\s*一、题目原文|###\s*📌\s*题目原文)\s*\n([\s\S]*?)(?=##|###|####|🔑|$)/);
  const answerMatch = raw.match(/(?:###\s*✅\s*正确答案|###\s*正确答案)\s*\n([\s\S]*?)(?=###|####|📚|⚠️|$)/);
  const knowledgeMatch = raw.match(/(?:###\s*📚\s*核心知识点[积累学]*|###\s*核心知识点)\s*\n([\s\S]*?)(?=###|####|⚠️|$)/);
  const tipsMatch = raw.match(/(?:###\s*⚠️\s*同类陷阱[预警]*|###\s*⚠️\s*同类题型速查卡|###\s*避坑指南|###\s*⚠️\s*第四步[：:]\s*避坑指南)\s*\n([\s\S]*?)(?=####|##|$)/);
  const fallbackKnowledge = knowledgeMatch
    ? knowledgeMatch[1]
        .trim()
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => l.replace(/^[\d.\-•]+\s*/, "").trim())
    : [];

  // 剥离 JSON 结构头，正文 Markdown 保持干净（用于渲染/保存/导出/对话上下文）
  const cleanedRaw = raw.replace(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>\s*/g, "").trim();

  return {
    module,
    question: (structured && structured.question) || (questionMatch ? questionMatch[1].trim() : ""),
    answer: (structured && structured.answer) || (answerMatch ? answerMatch[1].trim() : ""),
    solution: cleanedRaw, // 完整 Markdown 作为 solution
    knowledgePoints: Array.isArray(structured && structured.knowledgePoints) && structured.knowledgePoints.length
      ? structured.knowledgePoints
      : fallbackKnowledge,
    tips: (structured && structured.trap) || (tipsMatch ? tipsMatch[1].trim() : ""),
    difficulty: (structured && structured.difficulty) || "",
    answerSuspicious: !!(structured && structured.answerSuspicious),
    rawMarkdown: cleanedRaw,
  };
}

// ===== 本地关键词预分类（命中时省去一次 LLM 调用） =====
function classifyLocally(text) {
  if (!text) return null;
  const rules = [
    { module: "资料分析", kws: ["同比", "环比", "增长率", "增长量", "百分点", "现期", "基期", "复合增长率", "增速", "降幅"] },
    { module: "数量关系", kws: ["方程", "工程问题", "行程", "利润", "排列组合", "概率", "几何", "浓度", "容斥", "最值", "等差数列", "等比数列", "追及", "相遇", "牛吃草"] },
    { module: "判断推理", kws: ["图形推理", "类比推理", "定义判断", "逻辑判断", "翻译推理", "真假推理", "充分条件", "必要条件", "一笔画", "对称", "最能加强", "最能削弱", "加强论证", "削弱论证", "加强项", "削弱项"] },
    { module: "言语理解", kws: ["选词填空", "成语辨析", "主旨概括", "意图判断", "标题选择", "语句排序", "语句衔接", "实词", "虚词"] },
    { module: "政治理论", kws: ["二十大", "中全会", "习近平", "新质生产力", "中国特色社会主义", "马克思主义", "党史", "党建", "总体布局", "五位一体", "收入分配", "初次分配", "再分配", "第三次分配", "共同富裕", "橄榄型分配", "转移支付", "社会保障", "基本公共服务", "民生"] },
    { module: "常识判断", kws: ["民法典", "宪法", "行政法", "刑法", "诉讼法", "历史常识", "地理常识", "科技常识", "生物常识", "物理常识", "化学常识"] },
  ];
  const hits = {};
  for (const r of rules) {
    let cnt = 0;
    for (const kw of r.kws) if (text.includes(kw)) cnt++;
    if (cnt > 0) hits[r.module] = cnt;
  }
  const best = Object.keys(hits).sort((a, b) => hits[b] - hits[a])[0];
  return best || null;
}

// ===== 阶段一：模块分类 =====
app.post("/api/classify", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "题目文本不能为空" });
  }

  // 本地关键词预分类无需 API Key，命中直接返回（省时省调用）
  const local = classifyLocally(text);
  if (local) {
    return res.json({ module: local, source: "local" });
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
    res.json({ module: finalModule, source: "llm" });
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
    // 优先本地关键词预分类，未命中再走 LLM
    const local = classifyLocally(text);
    if (local && modulePrompts[local]) {
      module = local;
    } else {
      try {
        const classPrompt = classifierPrompt.replace("{{text}}", text);
        const clsResult = await callDeepSeek(apiKey, "你是一个行测题目分类器，只输出模块名称。", classPrompt, 0.1);
        module = clsResult.trim();
        if (!modulePrompts[module]) module = "常识判断";
      } catch {
        module = "常识判断";
      }
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

    // 差异化解析模式：做对 → 巩固模式；做错/未知 → 错因深挖模式
    const judgedCorrect = !!(userAnswer && detectedCorrect
      && userAnswer.trim().toUpperCase() === detectedCorrect.trim().toUpperCase());
    if (judgedCorrect) {
      prompt += "\n\n【本题考生做对了】请切换为巩固模式：不要强行编造错因。重点回答：①这道题的核心考点与15秒内快速解题思路；②本题有什么隐蔽陷阱（即便做对也要警惕）；③同类题下次如何提速。";
    } else {
      prompt += "\n\n【本题考生做错了或答案未确认】请按错因诊断模式，结合考生思考过程深挖选错原因，直指思维漏洞，并给出纠正后的正确思路。";
    }

    // 政治理论：启用内置联网搜索（Responses API + web_search），时政以检索结果为准
    // 其余模块：数量关系/判断推理（硬推理）用 deepseek-reasoner，其余用 deepseek-chat
    let rawResult;
    if (module === "政治理论") {
      try {
        rawResult = await callDeepSeekSearch(
          apiKey,
          "你是一个专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。你已接入联网搜索：涉及最新时政（会议、政策、领导人讲话、官方表述）时，必须优先依据联网检索到的官方信息并标注来源；如检索结果与记忆冲突，以检索结果为准。直接输出最终解析，严禁描述检索过程（不要写\"我将先检索\"\"我已获取到\"等过程性语言）。",
          prompt
        );
      } catch (searchErr) {
        // 联网搜索失败时回退普通调用，保证解析可用
        console.error("联网搜索失败，回退普通解析:", searchErr.message);
        rawResult = await callDeepSeek(apiKey, "你是一个专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。", prompt, 0.4, "deepseek-chat");
      }
    } else {
      // 默认全部使用 deepseek-chat（响应快、稳定）。deepseek-reasoner 推理更严谨但耗时数倍且
      // 可能因思考过长截断输出，已默认停用；如需启用可在 callDeepSeek 第 5 参传入 "deepseek-reasoner"
      rawResult = await callDeepSeek(apiKey, "你是一个专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。", prompt, 0.4, "deepseek-chat");
    }
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
5. 关键概念用**加粗**标注
6. 用 Markdown 分点/小标题组织回答，保持与完整解析一致的排版风格（加粗、列表、层级清晰）`;

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

