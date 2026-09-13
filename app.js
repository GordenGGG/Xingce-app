// ===== 行测备考助手 v2.0 PWA =====
var DS_KEY='xingce_ds', DK_KEY='xingce_dk';
function gk(k){return localStorage.getItem(k)||''}
function sk(k,v){localStorage.setItem(k,v.trim())}
function ck(k){localStorage.removeItem(k)}
function hasDS(){return gk(DS_KEY).length>0}
function hasDK(){return gk(DK_KEY).length>0}

function toast(m,t){t=t||'';var e=document.getElementById('toast');e.textContent=m;e.className='toast '+t+' show';clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove('show')},2500)}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}

// ===== 版本模式（完整版 / Lite版） =====
var MODE_STORAGE_KEY='xingce_mode';
function getMode(){return localStorage.getItem(MODE_STORAGE_KEY)||'full'}
function setMode(m){localStorage.setItem(MODE_STORAGE_KEY,m==='lite'?'lite':'full')}
function isLiteMode(){return getMode()==='lite'}
function applyMode(m){
  setMode(m);
  document.querySelectorAll('.mode-opt').forEach(function(b){b.classList.toggle('active',b.dataset.mode===m)});
  var lite=(m==='lite');
  document.body.classList.toggle('mode-lite',lite);
  var ab=document.getElementById('analyzeBtn');
  if(ab&&!ab.disabled)ab.textContent=lite?'\u{1F916} \u5F00\u59CB\u89E3\u6790\uFF08Lite\uFF09':'\u{1F916} \u5F00\u59CB\u89E3\u6790';
}
function initModeSwitch(){
  document.querySelectorAll('.mode-opt').forEach(function(b){b.addEventListener('click',function(){applyMode(b.dataset.mode)})});
  applyMode(getMode());
}

// ===== DeepSeek API =====
async function callDS(system,user,temp){temp=temp||0.4;
  var r=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gk(DS_KEY)},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:system},{role:'user',content:user}],temperature:temp,max_tokens:8192})});
  if(!r.ok){var e=await r.text();if(r.status===401)throw new Error('DeepSeek Key 无效');throw new Error(e)}
  var d=await r.json();return d.choices[0].message.content
}

// ===== DeepSeek Responses API（内置 web_search 联网搜索，用于政治理论/常识判断） =====
async function callDSSearch(system,user){
  var r=await fetch('https://api.deepseek.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gk(DS_KEY)},body:JSON.stringify({model:'deepseek-chat',tools:[{type:'web_search'}],input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:user}]}],max_output_tokens:8192})});
  if(!r.ok){var e=await r.text();if(r.status===401)throw new Error('DeepSeek Key 无效');throw new Error(e)}
  var d=await r.json();
  // 只取【最后一个】message 的 output_text，避免把思考草稿/工具过程拼进正文
  var outs=d.output||[];var msgs=outs.filter(function(o){return o.type==='message'});
  var fin=msgs[msgs.length-1];if(!fin)return '';
  return (fin.content||[]).filter(function(c){return c.type==='output_text'}).map(function(c){return c.text||''}).join('');
}

// ===== 思考过程评分（Lite版专用） =====
async function scoreThought(module,text,userThought,userAnswer,detectedCorrect,analysis){
  try{
    var judgment=(userAnswer&&detectedCorrect&&userAnswer.trim().toUpperCase()===detectedCorrect.trim().toUpperCase())?'做对了':'做错了';
    var sys='你是一位严格、客观的行测评分老师。你的唯一标准是真实反映学生『对这道题的掌握程度』，绝不讨好、绝不虚高。请根据学生写出的「思考过程」，按标准评分并只输出一个 JSON 对象。';
    var user='【模块】'+module+'\n【题目原文】\n'+(text||'（无）')+'\n【正确答案】'+(detectedCorrect||'（未识别）')+'\n【学生答案】'+(userAnswer||'（未选）')+'\n【对错】'+judgment+'\n【学生思考过程】\n'+(userThought||'（未填写）')+'\n【解析参考】\n'+(analysis||'（无）')+
      '\n\n【评分标准】以下每项按 0-10 打分，须有明确依据，不许凭感觉：\n'+
      '1. basis 判断依据充分度(权重最大)：每个判断是否给出可陈述的硬理由(语义/搭配/逻辑/考点)，而非『感觉/直觉』；说出『不知道原因』要扣分。\n'+
      '2. precision 辨析精度：是否触及近义词辨析、设错本质、语境呼应线索；能否识别自己的不确定点。\n'+
      '3. correctness 结果正确性：最终答案是否正确。\n'+
      '4. logic 逻辑严密性：推理是否自洽、不跳跃、不循环、前后一致。\n'+
      '5. knowledge 知识准确度：有无概念性/常识性错误。\n'+
      '\n【权重】总分 = basis*0.30 + precision*0.20 + correctness*0.20 + logic*0.15 + knowledge*0.15，四舍五入到整数，满分 100。\n'+
      '\n【蒙对识别】若 correctness 较高但 basis < 5，说明是『蒙对』，必须在 montai 字段填 true。\n'+
      '\n【输出格式】只输出以下 JSON（不要 Markdown 代码块、不要多余文字）：\n'+
      '{"total":数字,"grade":"优秀|良好|中等|待提升|需加强","basis":数字,"precision":数字,"correctness":数字,"logic":数字,"knowledge":数字,"strengths":["优势1"],"weaknesses":["短板1"],"montai":true,"next":["建议1"]}';
    var raw=await callDS(sys,user,0.2);
    var s=(raw||'').replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim();
    var m=s.match(/\{[\s\S]*\}/);if(m)s=m[0];
    var p=JSON.parse(s);
    var clamp=function(n){return Math.max(0,Math.min(10,Number(n)||0))};
    var f={basis:clamp(p.basis),precision:clamp(p.precision),correctness:clamp(p.correctness),logic:clamp(p.logic),knowledge:clamp(p.knowledge)};
    var montai=!!p.montai;
    var effCorrect=montai?Math.round(f.correctness*0.5):f.correctness;
    var total=Math.round(f.basis*0.30+f.precision*0.20+effCorrect*0.20+f.logic*0.15+f.knowledge*0.15);
    total=Math.max(0,Math.min(100,total));
    var grade=total>=85?'优秀':total>=70?'良好':total>=60?'中等':'待提升';
    if(montai&&(grade==='良好'||grade==='优秀'))grade='中等';
    return{total:total,grade:grade,scores:f,strengths:(p.strengths||[]).slice(0,3),weaknesses:(p.weaknesses||[]).slice(0,3),montai:montai,next:(p.next||[]).slice(0,3)};
  }catch(e){console.error('评分失败',e);return null}
}

// ===== 思考过程评分卡渲染 =====
function renderScoreCard(data){
  var el=document.getElementById('scoreCard');if(!el)return;
  var s=data.score;
  if(!s){el.style.display='none';el.innerHTML='';return}
  var bar=function(v,label){return '<div class="score-row"><span class="score-label">'+label+'</span><span class="score-bar"><span class="score-fill" style="width:'+(v*10)+'%"></span></span><span class="score-num">'+v+'/10</span></div>'};
  var gc='grade-'+(s.total>=85?'ex':s.total>=70?'good':s.total>=60?'mid':'low');
  var montai=s.montai?'<div class="score-montai">⚠️ 本题存在“蒙对”——答案对了但判断依据不足，已据此下调总分。请重点补“为什么这么选”。</div>':'';
  var strengths=(s.strengths||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('');
  var weaknesses=(s.weaknesses||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('');
  var next=(s.next||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('');
  el.innerHTML='<div class="score-head"><span class="score-total '+gc+'">'+s.total+'<small>/100</small></span><span class="score-grade '+gc+'">'+(s.grade||'中等')+'</span></div>'+
    '<div class="score-body">'+bar(s.scores.basis,'判断依据')+bar(s.scores.precision,'辨析精度')+bar(s.scores.correctness,'结果正确')+bar(s.scores.logic,'逻辑严密')+bar(s.scores.knowledge,'知识准确')+'</div>'+
    montai+
    ((strengths||weaknesses||next)?'<div class="score-detail">'+
      (strengths?'<div class="score-col"><h4>你的优势</h4><ul>'+strengths+'</ul></div>':'')+
      (weaknesses?'<div class="score-col"><h4>你的短板</h4><ul>'+weaknesses+'</ul></div>':'')+
      (next?'<div class="score-col"><h4>下一步重点</h4><ul>'+next+'</ul></div>':'')+'</div>':'')+
    '<div class="score-foot">🧮 分数仅反映“这道题你的思考过程质量”，用于自我对标、看到进步轨迹</div>';
  el.style.display='block';
}

// ===== Qwen-VL OCR =====

// 从「标签:值」逐列转述确定性提取答案（决策全在代码，不靠模型判断）
function extractStat(s){
  s=(s||'').replace(/\s+/g,' ');
  var correct='',user='',hasUser=false;
  var m=s.match(/正确答案\s*[:：]\s*([A-Da-d])/i); if(m) correct=m[1].toUpperCase();
  if(/你的答案\s*[:：]/i.test(s)){ hasUser=true; var mu=s.match(/你的答案\s*[:：]\s*([A-Da-d])/i); if(mu) user=mu[1].toUpperCase(); }
  if(!hasUser) user=correct;
  return {correct:correct,user:user};
}

// 单次视觉识别调用
async function callQwenVlRaw(imageData,promptText){
  var r=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gk(DS_KEY)},body:JSON.stringify({model:'deepseek-v4-flash-vision-exp',messages:[{role:'user',content:[{type:'image_url',image_url:{url:imageData}},{type:'text',text:promptText}]}],max_tokens:2000,temperature:0.1})});
  if(!r.ok){var e=await r.text();if(r.status===401)throw new Error('DeepSeek Key 无效');throw new Error('视觉识别调用失败: '+e)}
  var d=await r.json();return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||'';
}

// 解析模型返回：优先 JSON，失败则正则兜底（避免偶发非规范 JSON 导致空结果）
function parseStatJson(content){
  var q=content,statTable='',directC='',directU='';
  try{
    var j=JSON.parse(content.replace(/^```json\s*/i,'').replace(/```\s*$/i,''));
    q=j.question||content;statTable=j.statTable||'';
    directC=(j.correctAnswer||'').toUpperCase();directU=(j.userAnswer||'').toUpperCase();
  }catch(e){
    q=content;
    var mC=content.match(/正确答案\s*[:：]\s*([A-Da-d])/);
    var mU=content.match(/你的答案\s*[:：]\s*([A-Da-d])/);
    if(mC)statTable='正确答案: '+mC[1];
    if(mU)statTable=(statTable?statTable+'\n':'')+'你的答案: '+mU[1];
  }
  return {q:q,statTable:statTable,directC:directC,directU:directU};
}

// OCR 提示词（与本地版完全一致）
var OCR_FULL_PROMPT = `请仔细阅读这张行测题目截图（公务员考试行测真题），精确提取信息并以JSON返回。

【格式规则 - 严格遵守】
- 所有数字和符号原样输出，不要改变格式
- 分数统一写成 a/b 形式（如 14/25，不要用 LaTeX）
- 百分号保持原样（如 55%）
- 数学公式中的数字直接写（如 2:3、x+3=5）
- 标点符号保持原文（中文用中文标点，英文用英文标点）
- 选项必须分行排列，每个选项独占一行，格式为 A. 选项内容、B. 选项内容、C. 选项内容、D. 选项内容

【统计表转述 - 只抄写，不判断】
截图底部通常有统计表（卡片式，每格上方是标签、下方是值）。请把它【原样逐列转述】，每个卡片单独一行，格式「标签: 值」，不要判断哪个是正确答案：
正确答案: A
你的答案: D
全站正确率: 19%
答题用时: 7秒
易错项: C
⚠️ 有哪个卡片就抄哪一行；若做对（无「你的答案」卡片）就少一行「你的答案」。一个都不能漏，尤其第二列「你的答案」卡片若存在务必抄出。值照抄（字母/百分比/时间，D/A、C/G 形近请仔细分辨）；看不清写「看不清」；「你的答案」与「易错项」是两列，即使值相同（如都是A）也要各抄一行，不可合并【JSON格式】
{
  "question": "题目完整原文（含选项，保持排版）",
  "statTable": "正确答案: D  全站正确率: 33% 答题用时: 30秒  易错项: C"
}

只返回JSON本身，不要Markdown包裹。`;

// 全图识别：DeepSeek vision 偶发空结果 → 自动重试最多 3 次（与本地版一致）
async function callQwenVL(imageData){
  var lastQ='',fullAns={correct:'',user:''},fullParsed={q:'',statTable:'',directC:'',directU:''};
  for(var attempt=0;attempt<3;attempt++){
    var content=await callQwenVlRaw(imageData,OCR_FULL_PROMPT);
    fullParsed=parseStatJson(content);
    lastQ=fullParsed.q||lastQ;
    fullAns=extractStat(fullParsed.statTable);
    if(fullAns.correct||fullParsed.directC)break; // 拿到答案即成功
  }
  var result={question:lastQ,correctAnswer:fullAns.correct||fullParsed.directC,userAnswer:fullAns.user||fullParsed.directU};
  // 做对兜底：有正确答案但无我的答案时，视为做对
  if(result.correctAnswer&&!result.userAnswer)result.userAnswer=result.correctAnswer;
  return result;
}

// ===== SenseVoice ASR =====
async function callASR(audioBase64,mimeType){
  var b=Uint8Array.from(atob(audioBase64),function(c){return c.charCodeAt(0)});
  var fd=new FormData();fd.append('model','paraformer-v2');fd.append('file',new Blob([b],{type:mimeType||'audio/webm'}),'audio.webm');fd.append('sample_rate','16000');fd.append('format','webm');
  var r=await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',{method:'POST',headers:{'Authorization':'Bearer '+gk(DK_KEY)},body:fd});
  if(!r.ok){var e=await r.text();throw new Error(e)}
  var d=await r.json();return d.output?.text||d.output?.results?.[0]?.text||''
}

// ===== Settings =====
function openSettings(){
  document.getElementById('apiKeyInput').value=gk(DS_KEY);document.getElementById('apiKeyInput').type='password';
  document.getElementById('toggleKeyBtn').textContent='\u{1F441}\uFE0F';
  document.getElementById('dashscopeKeyInput').value=gk(DK_KEY);document.getElementById('dashscopeKeyInput').type='password';
  document.getElementById('toggleDashKeyBtn').textContent='\u{1F441}\uFE0F';
  document.getElementById('settingsModal').style.display='flex';
}
document.getElementById('settingsBtn').addEventListener('click',openSettings);
document.getElementById('closeSettingsBtn').addEventListener('click',function(){document.getElementById('settingsModal').style.display='none'});
document.getElementById('settingsModal').addEventListener('click',function(e){if(e.target===document.getElementById('settingsModal'))document.getElementById('settingsModal').style.display='none'});
document.getElementById('toggleKeyBtn').addEventListener('click',function(){var i=document.getElementById('apiKeyInput');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'\u{1F441}\uFE0F':'\u{1F648}'});
document.getElementById('saveKeyBtn').addEventListener('click',function(){var k=document.getElementById('apiKeyInput').value.trim();if(!k||!k.startsWith('sk-')){toast('请输入有效Key','error');return}sk(DS_KEY,k);toast('已保存','success');document.getElementById('settingsModal').style.display='none'});
document.getElementById('clearKeyBtn').addEventListener('click',function(){if(confirm('清除？')){ck(DS_KEY);document.getElementById('apiKeyInput').value='';toast('已清除')}});
document.getElementById('toggleDashKeyBtn').addEventListener('click',function(){var i=document.getElementById('dashscopeKeyInput');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'\u{1F441}\uFE0F':'\u{1F648}'});
document.getElementById('saveDashKeyBtn').addEventListener('click',function(){var k=document.getElementById('dashscopeKeyInput').value.trim();if(!k||!k.startsWith('sk-')){toast('请输入有效Key','error');return}sk(DK_KEY,k);toast('已保存','success');document.getElementById('settingsModal').style.display='none'});
document.getElementById('clearDashKeyBtn').addEventListener('click',function(){if(confirm('清除？')){ck(DK_KEY);document.getElementById('dashscopeKeyInput').value='';toast('已清除')}});

// ===== 答案识别 + 分行 =====
function parseAnswersFromText(text) {
  var result = { correct: '', user: '' };
  if (!text) return result;
  var lines = text.split(/\n/);
  for (var li = lines.length - 1; li >= Math.max(0, lines.length - 25); li--) {
    var ln = (lines[li] || '').replace(/\s+/g, '');
    var isHeader = ln.indexOf('正确答案') >= 0 || ln.indexOf('全站正确率') >= 0;
    if (!isHeader) continue;
    var hasUser = ln.indexOf('你的答案') >= 0;
    for (var di = li - 1; di <= li + 1; di++) {
      if (di < 0 || di >= lines.length || di === li) continue;
      var dl = lines[di] || '';
      if (hasUser) {
        // 做错了：A D 55% ...
        var mA = dl.match(/^\s*([A-Da-d])\s+([A-Da-d])\s+\d{1,3}\s*[%xX比]/i);
        if (mA) { result.correct = mA[1].toUpperCase(); result.user = mA[2].toUpperCase(); break; }
      } else {
        // 做对了：B 87x ...
        var mB = dl.match(/^\s*([A-Da-d])\s+\d{1,3}\s*[%xX比]/i);
        if (mB) { result.correct = mB[1].toUpperCase(); result.user = mB[1].toUpperCase(); break; }
      }
    }
    if (result.correct) break;
  }
  if (!result.correct) {
    var cp = [/正确答案[：:]\s*([A-D])/i, /【答案】\s*([A-D])/i, /答案[：:]\s*([A-D])/i, /参考答案[：:]\s*([A-D])/i];
    for (var i = 0; i < cp.length; i++) { var m = text.match(cp[i]); if (m) { result.correct = m[1].toUpperCase(); break; } }
  }
  if (!result.user) {
    var up = [/我的答案[：:]\s*([A-D])/i, /你的答案[：:]\s*([A-D])/i, /选择[：:]\s*([A-D])/i, /作答[：:]\s*([A-D])/i, /我选[：:]\s*([A-D])/i];
    for (var j = 0; j < up.length; j++) { var m2 = text.match(up[j]); if (m2) { result.user = m2[1].toUpperCase(); break; } }
  }
  return result;
}
function normalizeQuestionText(text) {
  if (!text) return text;
  text = text.replace(/([A-Da-d])\s*[.．、:：)]\s*/g, function(m) { return '\n' + m.trim() + ' '; });
  text = text.replace(/\^\n+/, '');
  return text;
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(function(t){t.addEventListener('click',function(){document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.tab-content').forEach(function(x){x.classList.remove('active')});t.classList.add('active');var tg=document.getElementById('tab-'+t.dataset.tab);if(tg)tg.classList.add('active');if(t.dataset.tab==='review')renderReviewList();if(t.dataset.tab==='stats'&&typeof statsRenderer!=='undefined'){statsRenderer.destroyAll();statsRenderer.render()}})});

// ===== DOM refs =====
var uz=document.getElementById('uploadZone'),ii=document.getElementById('imageInput'),pi=document.getElementById('previewImage'),up=uz.querySelector('.upload-placeholder');
var ob=document.getElementById('ocrBtn'),op=document.getElementById('ocrProgress'),os=document.getElementById('ocrStatus'),pf=op.querySelector('.progress-fill');
var ore=document.getElementById('ocrResult'),ot=document.getElementById('ocrText');
var ts=document.getElementById('thoughtSection'),ut=document.getElementById('userThought');
var ab=document.getElementById('analyzeBtn'),rp=document.getElementById('resultPanel'),ar=document.getElementById('analysisResult'),rph=rp.querySelector('.result-placeholder'),rfa=document.getElementById('resultFullAnalysis');
var cid=null,lad=null,lastAnalysis=null;

// ===== Upload =====
uz.addEventListener('click',function(){ii.click()});uz.addEventListener('dragover',function(e){e.preventDefault()});uz.addEventListener('drop',function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)hif(f)});ii.addEventListener('change',function(e){var f=e.target.files[0];if(f)hif(f)});
document.addEventListener('paste',function(e){
  var it=e.clipboardData&&e.clipboardData.items;
  // 剪贴板含图片：优先作为题目图片上传（即使焦点在输入框也拦截）
  if(it){for(var i=0;i<it.length;i++){if(it[i].type&&it[i].type.startsWith('image/')){e.preventDefault();
    var at=document.getElementById('tab-analyze');
    if(at&&!at.classList.contains('active')){document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active')});var tt=document.querySelector('.tab[data-tab="analyze"]');if(tt)tt.classList.add('active');at.classList.add('active')}
    hif(it[i].getAsFile());toast('已粘贴');return}}}
  // 无图片：焦点在输入框则让输入框正常处理文本粘贴
});
function useImageDataUrl(dataUrl){
  if(!dataUrl){toast('没有拷贝到图片','error');return}
  cid=dataUrl;
  pi.src=dataUrl;pi.style.display='block';up.style.display='none';
  ob.disabled=false;ore.style.display='none';ts.style.display='none';
  ab.style.display='none';ar.style.display='none';rph.style.display='block';
  rph.innerHTML='<span class="result-icon">\u{1F916}</span><p>AI 解析结果将显示在这里</p><small>上传截图 → 识别 → 填写思考过程 → 智能解析</small>';
  var dca=document.getElementById('detectedCorrectAnswer');if(dca)dca.textContent='';
  document.querySelectorAll('input[name="correctAnswer"]').forEach(function(r){r.checked=(r.value==='')});
  document.querySelectorAll('input[name="userAnswer"]').forEach(function(r){r.checked=false});
  ut.value='';
  var cc=document.getElementById('correctCheck');if(cc)cc.checked=false;
  ot.value='';
  currentRecordId=null;lastAnalysis=null;
  resetChat();
}
function hif(f){if(!f.type.startsWith('image/')){toast('请上传图片','error');return}var r=new FileReader();r.onload=function(e){useImageDataUrl(e.target.result)};r.readAsDataURL(f)}

// ===== OCR =====
ob.addEventListener('click',function(){
  if(!cid)return;if(!hasDS()){toast('请配置DeepSeek Key','error');openSettings();return}
  ob.disabled=true;op.style.display='block';ore.style.display='none';ts.style.display='none';ab.style.display='none';
  pf.style.width='30%';os.textContent='DeepSeek 正在看图识别...';
  callQwenVL(cid).then(function(d){
    pf.style.width='100%';os.textContent='完成';
    setTimeout(function(){op.style.display='none';ore.style.display='block';ot.value=d.question||'';
      var ca=document.getElementById('detectedCorrectAnswer');if(d.correctAnswer&&ca)ca.textContent='(正确答案:'+d.correctAnswer+')';
      if(d.correctAnswer){document.querySelectorAll('input[name="correctAnswer"]').forEach(function(r){if(r.value===d.correctAnswer)r.checked=true});}
      if(d.userAnswer)document.querySelectorAll('input[name="userAnswer"]').forEach(function(r){if(r.value===d.userAnswer)r.checked=true});
      ts.style.display='block';ab.style.display='block';ob.disabled=false;
      // 不自动解析：让用户先核对答案、填写思考过程，再手动点解析
      ab.textContent=isLiteMode()?'\u{1F916} \u5F00\u59CB\u89E3\u6790\uFF08Lite\uFF09':'\u{1F916} \u5F00\u59CB\u89E3\u6790';
      var th=document.getElementById('thoughtHint');if(th)th.style.display='block';
      toast(ot.value?'识别完成！请填写思考过程，再点开始解析':'未识别到文字',ot.value?'success':'error')},300)
  }).catch(function(e){op.style.display='none';ob.disabled=false;toast(e.message,'error')})
});

// ===== Analysis =====
var analysisToken=0; // 防串题：换新图或新解析时递增，作废旧的飞行中请求
ab.addEventListener('click',function(){
  var myToken=++analysisToken;
  var t=ot.value.trim();if(!t){toast('请先识别文字','error');return}if(!hasDS()){toast('请配置DeepSeek Key','error');openSettings();return}
  var ua=document.querySelector('input[name="userAnswer"]:checked');var utt=ut.value.trim();
  var dcEl=document.getElementById('detectedCorrectAnswer');var dc=dcEl?(dcEl.textContent.match(/[A-D]/)||[''])[0]:'';
  ab.disabled=true;ab.textContent='\u23F3 识别模块...';rph.innerHTML='<span class="result-icon">\u{1F50D}</span><p>AI识别中...</p>';
  callDS('你是一个行测题目分类器，只输出模块名称。',CLASSIFIER_PROMPT.replace('{{text}}',t),0.1).then(function(m){
    m=m.trim();if(!MODULE_PROMPTS[m])m='常识判断';
    var isSearch=(m==='政治理论'||m==='常识判断');
    ab.textContent='\u23F3 '+m+' 解析...';
    rph.innerHTML='<span class="result-icon">\u{1F52C}</span><p>已识别：<strong>'+m+'</strong></p><small>'+(isSearch?'正在联网核实…（约30-60秒）':'正在全要素过筛…')+'</small>';

    if(isLiteMode()){
      // ===== Lite 版：第1步生成解析依据（政理/常识走联网）→ 第2步严师逐句批改 → 第3步评分 =====
      var judgment=(ua&&ua.value&&dc&&ua.value.toUpperCase()===dc.toUpperCase())?'做对了':(ua&&ua.value?'做错了':'答案未确认');
      var thoughtText=utt||'';
      var liteBase='【模块】'+m+'\n【题目原文】\n'+t+'\n\n【正确答案】'+(dc||'（未识别）')+'\n【你的答案】'+(ua?ua.value:'（未选）')+'\n【对错】'+judgment;
      var basisPrompt=liteBase+(thoughtText?'\n【考生思考过程】'+thoughtText:'')+'\n\n【任务】先用简明的要点逐项分析这道题（按选项给出【为什么对/为什么错、陷阱、对应知识点/原理】），为后续讲解提供依据。\n输出一段结构化但简洁的分析（可用小标题/分点，300 字内）。';
      var p1;
      if(isSearch){
        p1=callDSSearch('你是一个专业的行测辅导老师。你已接入联网搜索：涉及最新时政（会议、政策、领导人讲话、官方表述）、最新法律修订、科技发现、国家政策、地理历史等可能有争议或时效性强的知识点时，必须优先依据联网检索到的官方信息核实，避免凭旧知识出错；如检索结果与记忆冲突，以检索结果为准。用要点讲清这道题：逐项分析每个选项对错、陷阱和对应知识点/原理，简要清晰。直接输出分析结果，严禁描述检索过程。全文必须简体中文，禁止出现英文段落/来源URL/网页原文。',basisPrompt)
          .catch(function(){return callDS('你是一个专业的行测辅导老师，用要点讲清这道行测题：逐项分析每个选项对错、陷阱和对应知识点/原理，简要清晰。',basisPrompt,0.4)});
      }else{
        p1=callDS('你是一个专业的行测辅导老师，用要点讲清这道行测题：逐项分析每个选项对错、陷阱和对应知识点/原理，简要清晰。',basisPrompt,0.4);
      }
      return p1.then(function(basis){
        ab.textContent='\u23F3 逐句批改中...';
        var p2='你是一位严格、客观的行测辅导老师。学生刚做完这道行测题并写了完整的思考过程。你的唯一目标是：**帮助学生真正提升行测能力、提高分数**。\n\n为此你必须做到以下几点(务必贯彻)：\n\n'+liteBase+
          (thoughtText?'\n【考生思考过程】\n'+thoughtText:'\n【考生思考过程】未填写，请直接讲清题目即可，不要编造他的想法。')+
          '\n\n【完整解析依据】\n'+basis+
          '\n\n【输出要求 - 严格遵循】\n'+
          '1. **绝不讨好/绝不客套**：严禁使用「你做得很好」「你的思路很对」「这个判断非常准」「给你点赞」这类夸奖或安慰性措辞。开头不要绕,直接给客观结论。可以指出「这题你对/错」,但不要附带情绪烘托。\n'+
          '2. **逐句回应考生的每一句话(核心要求)**：把考生的思考过程按句拆开,一句一句批改。对每一句都要明确判定并在它后面标注:【对】/【错】/【对但理由偏】/【模糊·需理清】/【没说到点上】,并简短说明为什么。不要跳句、不要只挑明显的、不要评价完一句就带过其它。这是本节的主体。\n'+
          '2.1 **不能只说错,必须给出「对的应该是什么」**：凡是判定为【错】【对但理由偏】【模糊·需理清】【没说到点上】的句子,除了指出错在哪,必须明确写出「正确的说法/正确的判断是……」「正确的理由是……」「正确的思考步骤是……」。让考生读完知道「下次这句该怎么想、怎么说」,而不是只知道「我错了」。判定【对】的句子可只做简短确认。\n'+
          '3. **准确、客观、犀利**：判定必须基于题目和学科知识本身,不迁就学生、不粉饰;学生想当然或用错概念的地方要直接点破,指出确切错误。\n'+
          '4. **优先用表格/分块呈现**：适合用表格时(如逐句批改、逐选项对错、近义词辨析)就用 Markdown 表格或清晰的分块小标题呈现,保证信息全面、条理清楚、逻辑递进。逐句批改表建议列出三列:「你的原句」「判定」「批改说明(错在哪 + 正确应该是什么)」。\n'+
          '5. **把模糊/蒙对的地方讲透**：凡学生标注「不确定」「我其实不太确定」「不知道原因」或明显蒙对的点,必须重点讲清其背后的知识点、辨析方法,给出可迁移的通用判断标准(不只讲这一题)。\n'+
          '6. **篇幅不限,以把问题讲透为准**：信息全面性、逻辑性、条理性优先于简洁。可用段落+要点+表格+对照综合呈现。\n'+
          '7. **整题结论与通性方法**：开头用一句话给出本题正确答案与学生对错;结尾用一段(或要点/表格)总结这类题的通用破解方法,帮学生下次举一反三。\n'+
          '8. **【必写】结尾「这道题应该怎么解」的完整总结**：解析最后必须单独给出一节(如用「## 🎯 这道题应该怎么解」标题),把「这道题正确的解题全过程」讲清楚,包含:①拿到这类题第一步先看什么、抓什么关键信息;②本题的完整正确推理链条(分步骤,从题干到选出答案);③每个选项为什么对/为什么错的一句话结论;④下次遇到同类题的操作步骤(可执行、可复述)。这一节要让考生即使前面的批改都不看,只看这一节也能完整做对这道题、并迁移到同类题。\n'+
          '9. **格式**：用 Markdown 组织(可加**加粗**、标题、表格),像一份严谨的批改讲义,不要输出「一、题目原文」「二、错因诊断」「三、全要素解析」这些SOP板块标题(但结尾「这道题应该怎么解」这一节要保留)。';
        return callDS('你是一位严格、客观的行测辅导老师，逐句批改考生思路、客观犀利、只服务提分，不输出结构化SOP。',p2,0.5).then(function(text){
          var result={module:m,rawMarkdown:text,knowledgePoints:[]};
          if(thoughtText){
            return scoreThought(m,t,thoughtText,ua?ua.value:'',dc,text).then(function(sc){if(sc)result.score=sc;return result});
          }
          return result;
        });
      });
    }

    // ===== 完整版：SOP 解析（政理/常识走联网） =====
    var p=MODULE_PROMPTS[m];p=p.replace('{{text}}',t);p=p.replace('{{userThought}}',utt||'（未提供）');
    p=p.replace('{{userAnswer}}',ua?ua.value:'（未提供）');p=p.replace('{{correctAnswer}}',dc||'（未识别）');
    if(isSearch){
      return callDSSearch('你是一个专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。你已接入联网搜索：涉及最新时政（会议、政策、领导人讲话、官方表述）、最新法律修订、科技发现、国家政策、地理历史等时效性强或有争议的知识点时，必须优先依据联网检索到的官方信息并核实；如检索结果与记忆冲突，以检索结果为准。直接输出最终解析，严禁描述检索过程。全文必须简体中文，输出给考生的中文解析正文，严禁把网页原文、来源URL、参考文献、英文摘要直接粘贴进正文。保持SOP要求的板块与字段标题完整，不要截断。',p)
        .catch(function(){return callDS('你是专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。',p,0.4)})
        .then(function(r){return {module:m,rawMarkdown:r,knowledgePoints:[]}});
    }
    return callDS('你是专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。',p,0.4).then(function(r){return {module:m,rawMarkdown:r,knowledgePoints:[]}});
  }).then(function(res){
    if(myToken!==analysisToken)return;
    lastAnalysis={module:res.module,rawMarkdown:res.rawMarkdown,knowledgePoints:extractKPs(res.rawMarkdown),score:res.score||null};
    renderAnalysis(res.rawMarkdown);
    if(res.score&&storage){storage.saveScore(res.score).catch(function(e){console.warn('保存评分失败',e)})}
    rph.style.display='none';ar.style.display='block';resetChat();
    var urA=document.querySelector('input[name="userAnswer"]:checked'),crA=document.querySelector('input[name="correctAnswer"]:checked');
    if(urA&&urA.value&&crA&&crA.value){saveCurrent().then(function(){toast('解析完成！'+(res.module||''),'success')}).catch(function(){toast('解析完成！'+(res.module||''),'success')})}
    else{toast('解析完成！'+(res.module||''),'success')}
  }).catch(function(e){if(myToken!==analysisToken)return;rph.innerHTML='<span class="result-icon">\u274C</span><p>'+e.message+'</p>';toast(e.message,'error')})
  .finally(function(){if(myToken!==analysisToken)return;ab.disabled=false;ab.textContent=isLiteMode()?'\u{1F916} \u5F00\u59CB\u89E3\u6790\uFF08Lite\uFF09':'\u{1F916} DeepSeek 智能解析'})
});
// 从解析文本里粗略抽取知识点（用于保存/统计）
function extractKPs(r){
  var kps=(r.match(/(?:知识点|考点|涉及知识点)\s*[：:]?\s*([^\n]+)/i)||[])[1]||'';
  return kps?kps.split(/[,，、;；\s]+/).filter(Boolean).slice(0,8):[];
}
function renderAnalysis(r){
  renderScoreCard({score:(lastAnalysis&&lastAnalysis.score)||null});
  var c=r.replace(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>\s*/g,'').trim();
  // 从解析文本里尝试提取模块/难度/知识点标签（SOP 通常含【模块】【难度】【知识点】）
  function pick(re){var m=r.match(re);return m?m[1].trim():''}
  var mod=pick(/【\s*模块\s*】\s*[：:]\s*(.{1,20})/);
  var diff=pick(/【\s*难度\s*】\s*[：:]\s*(.{1,10})/);
  var kps=(r.match(/(?:知识点|考点|涉及知识点)\s*[：:]?\s*([^\n]+)/i)||[])[1]||'';
  var modEl=document.getElementById('resultModule');if(modEl&&mod)modEl.textContent=mod;
  var catEl=document.getElementById('resultCategory');if(catEl&&mod)catEl.textContent=mod;
  var df=document.getElementById('resultDifficulty');
  if(df&&diff){df.textContent=diff;df.className='difficulty-badge '+(diff==='困难'?'hard':diff==='简单'?'easy':'medium');}
  // 答案对比卡
  var cA=document.querySelector('input[name="correctAnswer"]:checked'),uA=document.querySelector('input[name="userAnswer"]:checked');
  var cV=cA?cA.value:'',uV=uA?uA.value:'';
  var ac=document.getElementById('answerCompare');
  if(cV||uV){var acHtml='<span class="ac-correct">✅ 正确答案：'+(cV||'未知')+'</span>';
    if(uV)acHtml+='<span class="ac-user '+(cV===uV?'right':'wrong')+'">我的答案：'+uV+(cV&&cV===uV?' ✓':' ✗')+'</span>';
    ac.innerHTML=acHtml;ac.style.display='flex';}else{ac.style.display='none';}
  document.getElementById('resultFullAnalysis').innerHTML=marked.parse(c);
  try{if(typeof renderMathInElement!=='undefined')renderMathInElement(rfa,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}
  var kd=document.getElementById('resultKnowledge');
  if(kps){kd.innerHTML=kps.split(/[,，、;；\s]+/).filter(Boolean).slice(0,8).map(function(k){return'<span class="knowledge-tag">'+esc(k)+'</span>'}).join('');}
  var cc=document.getElementById('correctCheck');if(cc)cc.checked=!!(cV&&uV&&cV===uV);
}

// ===== Voice =====
var mr=null,ac=[],ms=null,cmb=null,sov='';
function startRec(el){if(!hasDK()){toast('请配置DashScope Key','error');openSettings();return}
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){ms=s;ac=[];var mt='audio/webm';if(!MediaRecorder.isTypeSupported(mt))mt='audio/mp4';mr=new MediaRecorder(s,{mimeType:mt});mr.ondataavailable=function(e){if(e.data.size>0)ac.push(e.data)};mr.onstop=function(){var b=new Blob(ac,{type:mt});var r=new FileReader();r.onload=function(){callASR(r.result.split(',')[1],mt).then(function(t){if(t&&el)el.value=sov+t;toast('识别完成','success')}).catch(function(e){toast(e.message,'error')}).finally(function(){if(cmb){cmb.classList.remove('recording');cmb.textContent='\u{1F3A4}';cmb=null}})};r.readAsDataURL(b);if(ms){ms.getTracks().forEach(function(t){t.stop()});ms=null}};mr.start()}).catch(function(e){toast('麦克风权限: '+e.message,'error');if(cmb){cmb.classList.remove('recording');cmb.textContent='\u{1F3A4}';cmb=null}})}
document.addEventListener('click',function(e){var b=e.target.closest('.mic-btn');if(!b)return;e.preventDefault();e.stopPropagation();if(b.classList.contains('recording')){if(mr&&mr.state!=='inactive')mr.stop();b.classList.remove('recording');b.textContent='\u{1F3A4}';cmb=null;return}var t=document.getElementById(b.dataset.target);if(!t)return;sov=t.value;t.focus();cmb=b;b.classList.add('recording');b.textContent='\u{1F534}';startRec(t)});

// ===== Screenshot =====
var sb=document.getElementById('screenshotBtn');if(sb){sb.addEventListener('click',function(){var el=document.getElementById('resultPanel');if(!el||typeof html2canvas==='undefined'){toast('无法截图','error');return}sb.disabled=true;sb.textContent='\u23F3';html2canvas(el,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,allowTaint:true}).then(function(c){c.toBlob(function(b){try{navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(function(){toast('已复制到剪贴板','success')}).catch(function(){df(c)})}catch(e){df(c)}},'image/png')}).catch(function(e){toast(e.message,'error')}).finally(function(){sb.disabled=false;sb.textContent='\u{1F4F8} 截图分享'})})}
function df(c){var a=document.createElement('a');a.download='行测解析.png';a.href=c.toDataURL('image/png');a.click();toast('已下载','success')}

// ===== Chat =====
var ct=document.getElementById('chatToggle'),cp=document.getElementById('chatPanel'),cm=document.getElementById('chatMessages'),ci=document.getElementById('chatInput'),csb=document.getElementById('chatSendBtn'),ch=[],icl=false;
ct.addEventListener('click',function(){cp.classList.toggle('collapsed')});
// 追问&复盘 专注模式（整页展开 / 收起）
var ceb=document.getElementById('chatExpandBtn');
function setChatFocus(on){cp.classList.toggle('focus',on);document.body.classList.toggle('chat-focus',on);if(ceb)ceb.title=on?'收起':'整页专注';if(on)cp.classList.remove('collapsed');else cp.classList.add('collapsed');requestAnimationFrame(function(){cm.scrollTop=cm.scrollHeight})}
if(ceb)ceb.addEventListener('click',function(e){e.stopPropagation();setChatFocus(!cp.classList.contains('focus'))});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&cp.classList.contains('focus'))setChatFocus(false)});
function resetChat(){ch=[];cm.innerHTML='<div class="chat-hint">\u{1F4A1} 追问: "<strong>B选项为什么错</strong>？"</div>'}
function addCM(role,content){var h=cm.querySelector('.chat-hint');if(h)h.remove();var d=document.createElement('div');d.className='chat-message '+role;d.innerHTML=role==='assistant'?marked.parse(content):esc(content);if(role==='assistant')try{if(typeof renderMathInElement!=='undefined')renderMathInElement(d,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}var t=document.createElement('div');t.className='chat-message-time';t.textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});d.appendChild(t);cm.appendChild(d);cm.scrollTop=cm.scrollHeight;ch.push({role:role,content:content})}
// 组装结构化信息（正确答案/我的答案/对错）
function chatContext(){var cA=document.querySelector('input[name="correctAnswer"]:checked'),uA=document.querySelector('input[name="userAnswer"]:checked');var cV=cA?cA.value:'',uV=uA?uA.value:'';var right=(uV&&cV)?(uV===cV):null;return{diff:cV,user:uV,right:right,kps:(lastAnalysis.knowledgePoints||[])}}
function sendChat(mode){var m=(mode==='summary')?'请生成复盘小结':ci.value.trim();if(!m||icl)return;if(!lastAnalysis){toast('请先解析题目','error');return}if(!hasDS()){toast('请配置Key','error');openSettings();return}icl=true;csb.disabled=true;if(mode!=='summary')ci.value='';addCM('user',m);var ty=document.createElement('div');ty.className='chat-typing';ty.textContent='AI思考中...';cm.appendChild(ty);
  var cx=chatContext();
  var sys='你是耐心的行测辅导老师。题目原文：'+ot.value+'。完整解析：'+(lastAnalysis.rawMarkdown||'')+'。'+(mode==='summary'?'请结合这次练习给出3-5条简洁的复盘小结（易错点/提醒/下一步），用要点列表。':'请根据学生追问给出针对性解答。');
  var user=ch.slice(0,-1).map(function(h){return h.role==='user'?'学生: '+h.content:'解析: '+h.content}).join('\n')+'\n\n[正确答案：'+(cx.diff||'未知')+'] [我的答案：'+(cx.user||'未选')+'] ['+(cx.right===null?'未判定':(cx.right?'做对了':'做错了'))+'] [知识点：'+(cx.kps.join('、')||'无')+']\n\n'+(mode==='summary'?'':'学生追问: ')+m;
  callDS(sys,user,0.5).then(function(r){var t=document.querySelector('.chat-typing');if(t)t.remove();addCM('assistant',r);if(currentRecordId){storage.addConversation(currentRecordId,{role:'assistant',content:r,time:new Date().toISOString()})}}).catch(function(e){var t=document.querySelector('.chat-typing');if(t)t.remove();addCM('assistant','抱歉: '+e.message)}).finally(function(){icl=false;csb.disabled=false;ci.focus()})
}
csb.addEventListener('click',function(){sendChat()});ci.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});
var sbBtn=document.getElementById('summaryBtn');if(sbBtn)sbBtn.addEventListener('click',function(){sendChat('summary')});

// ===== 保存到错题本（IndexedDB） =====
var currentRecordId=null;
var saveBtn=document.getElementById('saveBtn');
function saveCurrent(){
  if(!lastAnalysis){toast('请先解析题目','error');return}
  var cA=document.querySelector('input[name="correctAnswer"]:checked'),uA=document.querySelector('input[name="userAnswer"]:checked');
  var cV=cA?cA.value:'',uV=uA?uA.value:'';
  var autoCorrect=(uV&&cV)?(uV===cV):false;
  var isCorrect=document.getElementById('correctCheck').checked||autoCorrect;
  var record={question:ot.value.trim(),solution:lastAnalysis.rawMarkdown||'',answer:cV,category:document.getElementById('resultCategory').textContent||lastAnalysis.module||'',difficulty:(document.getElementById('resultDifficulty').textContent||'中等'),knowledgePoints:Array.from(document.querySelectorAll('#resultKnowledge .knowledge-tag')).map(function(e){return e.textContent}),tips:'',isCorrect:isCorrect,imageData:cid||'',rawMarkdown:lastAnalysis.rawMarkdown||'',userAnswer:uV,userThought:ut.value.trim(),conversations:[]};
  if(currentRecordId){var upd={};for(var k in record){if(k!=='conversations')upd[k]=record[k];}return storage.update(currentRecordId,upd).then(function(){return currentRecordId;});}
  return storage.save(record).then(function(id){currentRecordId=id;return id;});
}
if(saveBtn)saveBtn.addEventListener('click',function(){saveCurrent().then(function(){toast('✓ 已保存到错题本','success')}).catch(function(){toast('保存失败','error')})});
function loadRecordConversations(id){storage.getById(id).then(function(r){if(!r)return;if(r.conversations&&r.conversations.length){r.conversations.forEach(function(msg){addCM(msg.role,msg.content)})}})}

// ===== 错题本列表 =====
var reviewSelected={};
function getSelectedIds(){return Object.keys(reviewSelected).filter(function(k){return reviewSelected[k];});}
var reviewPage=1,reviewPageSize=20;
function renderReviewList(){
  var f={category:document.getElementById('filterCategory').value,difficulty:document.getElementById('filterDifficulty').value,isCorrect:document.getElementById('filterCorrect').value,mastered:document.getElementById('filterMastered').value,dateStart:document.getElementById('filterDateStart').value,dateEnd:document.getElementById('filterDateEnd').value,keyword:document.getElementById('filterKeyword').value};
  storage.getAll(f).then(function(data){
    var c=document.getElementById('reviewList');
    if(!data||data.length===0){var e=document.getElementById('reviewList');e.innerHTML='<div class="empty-state"><span>\u{1F4ED}</span><p>还没有保存的题目记录</p></div>';return}
    var total=data.length,pages=Math.max(1,Math.ceil(total/reviewPageSize));
    if(reviewPage>pages)reviewPage=pages;
    var slice=data.slice((reviewPage-1)*reviewPageSize,reviewPage*reviewPageSize);
    c.innerHTML=slice.map(function(r){
      return'<div class="review-card'+(r.mastered?' mastered':'')+'" data-id="'+r.id+'">'
        +'<div class="review-card-header">'
        +'<span class="review-category">'+esc(r.category||'')+'</span>'
        +'<span class="review-difficulty '+esc(r.difficulty||'')+'">'+esc(r.difficulty||'')+'</span>'
        +'<span class="review-correct '+(r.isCorrect?'correct':'wrong')+'">'+(r.isCorrect?'✅ 做对了':'❌ 做错了')+'</span>'
        +(r.mastered?'<span class="review-mastered">✅ 已掌握</span>':'')
        +'<span class="review-date">'+new Date(r.createdAt).toLocaleDateString('zh-CN')+'</span>'
        +'</div>'
        +'<div class="review-card-body"><div class="review-question">'+esc(r.question||'')+'</div></div>'
        +'<div class="review-card-actions">'
        +'<button class="btn btn-small" onclick="viewReviewCard('+r.id+')">🔍 查看</button>'
        +(r.mastered?'':'<button class="btn btn-small" onclick="markMastered('+r.id+')">✅ 掌握</button>')
        +'<button class="btn btn-small btn-danger" onclick="deleteReviewCard('+r.id+')">🗑 删除</button>'
        +'</div></div>'
    }).join('');
    var p=document.getElementById('pagination');
    if(pages>1){var html='<button class="btn btn-small page-btn"'+(reviewPage<=1?' disabled':'')+' onclick="gotoPage('+(reviewPage-1)+')">上一页</button>';for(var i=1;i<=pages;i++){html+='<button class="btn btn-small page-btn'+(i===reviewPage?' active':'')+'" onclick="gotoPage('+i+')">'+i+'</button>'}html+='<button class="btn btn-small page-btn"'+(reviewPage>=pages?' disabled':'')+' onclick="gotoPage('+(reviewPage+1)+')">下一页</button>';html+='<span class="page-total">共 '+total+' 条，第 '+reviewPage+'/'+pages+' 页</span>';p.innerHTML=html}else{p.innerHTML=''}
  });
}
window.gotoPage=function(pg){if(pg<1)return;reviewPage=pg;renderReviewList()};
window.markMastered=function(id){storage.update(id,{mastered:true,masteredAt:new Date().toISOString()}).then(function(){renderReviewList();toast('已标记掌握','success')})};
window.deleteReviewCard=function(id){if(!confirm('确认删除这条记录？'))return;storage.delete(id).then(function(){renderReviewList();toast('已删除')})};
window.viewReviewCard=function(id){
  storage.getById(id).then(function(r){if(!r)return;
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active')});
    var tt=document.querySelector('.tab[data-tab="analyze"]');if(tt)tt.classList.add('active');document.getElementById('tab-analyze').classList.add('active');
    if(r.imageData){cid=r.imageData;previewImage.src=r.imageData;previewImage.style.display='block';up.style.display='none';ob.disabled=false}
    ot.value=r.question||'';ore.style.display='block';ts.style.display='block';ab.style.display='none';
    var scEl=document.getElementById('scoreCard');if(scEl){scEl.style.display='none';scEl.innerHTML=''}
    document.querySelectorAll('input[name="correctAnswer"]').forEach(function(rb){rb.checked=(rb.value===(r.answer||''))});
    document.querySelectorAll('input[name="userAnswer"]').forEach(function(rb){rb.checked=(rb.value===(r.userAnswer||''))});
    var dca=document.getElementById('detectedCorrectAnswer');if(dca&&r.answer)dca.textContent='(正确答案:'+r.answer+')';
    ut.value=r.userThought||'';
    rph.style.display='none';ar.style.display='block';resetChat();loadRecordConversations(r.id);
    var rf=document.getElementById('resultFullAnalysis');rf.innerHTML=marked.parse(r.rawMarkdown||r.solution||'');try{if(typeof renderMathInElement!=='undefined')renderMathInElement(rf,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}
    var modEl=document.getElementById('resultModule');if(modEl&&r.category)modEl.textContent=r.category;
    var catEl=document.getElementById('resultCategory');if(catEl&&r.category)catEl.textContent=r.category;
    if(r.knowledgePoints){var kd=document.getElementById('resultKnowledge');kd.innerHTML=r.knowledgePoints.map(function(k){return'<span class="knowledge-tag">'+esc(k)+'</span>'}).join('')}
    if(r.difficulty){var df=document.getElementById('resultDifficulty');df.textContent=r.difficulty;df.className='difficulty-badge '+(r.difficulty==='困难'?'hard':r.difficulty==='简单'?'easy':'medium')}
    var cA=document.querySelector('input[name="correctAnswer"]:checked'),uA=document.querySelector('input[name="userAnswer"]:checked');var cV=cA?cA.value:'',uV=uA?uA.value:'';var ac=document.getElementById('answerCompare');
    if(cV||uV){var acHtml='<span class="ac-correct">✅ 正确答案：'+(cV||'未知')+'</span>';if(uV)acHtml+='<span class="ac-user '+(cV===uV?'right':'wrong')+'">我的答案：'+uV+'</span>';ac.innerHTML=acHtml;ac.style.display='flex'}else{ac.style.display='none'}
    lastAnalysis={module:r.category||'',rawMarkdown:r.rawMarkdown||r.solution||'',knowledgePoints:r.knowledgePoints||[]};currentRecordId=r.id;
    toast('已载入错题本记录','success');
  });
};
function bindReviewFilters(){
  ['filterCategory','filterDifficulty','filterCorrect','filterMastered','filterDateStart','filterDateEnd'].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('change',function(){reviewPage=1;renderReviewList()})});
  var kw=document.getElementById('filterKeyword');if(kw)kw.addEventListener('input',function(){reviewPage=1;renderReviewList()});
}

// ===== Init =====
initModeSwitch();
bindReviewFilters();
storage.init().then(function(){renderReviewList();if(!hasDS()&&!hasDK())setTimeout(function(){document.getElementById('settingsModal').style.display='flex'},500);}).catch(function(){toast('数据库初始化失败','error')});
