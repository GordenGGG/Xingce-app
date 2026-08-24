// ===== 行测备考助手 v2.0 =====
var API_KEY_STORAGE_KEY = 'xingce_deepseek_api_key';
var DASHSCOPE_KEY_STORAGE_KEY = 'xingce_dashscope_api_key';
function getApiKey() { return localStorage.getItem(API_KEY_STORAGE_KEY) || ''; }
function setApiKey(k) { localStorage.setItem(API_KEY_STORAGE_KEY, k.trim()); }
function clearApiKey() { localStorage.removeItem(API_KEY_STORAGE_KEY); }
function hasApiKey() { return getApiKey().length > 0; }
function getDashScopeKey() { return localStorage.getItem(DASHSCOPE_KEY_STORAGE_KEY) || ''; }
function setDashScopeKey(k) { localStorage.setItem(DASHSCOPE_KEY_STORAGE_KEY, k.trim()); }
function clearDashScopeKey() { localStorage.removeItem(DASHSCOPE_KEY_STORAGE_KEY); }
function hasDashScopeKey() { return getDashScopeKey().length > 0; }

function showToast(m, t) {
  t = t || ''; var el = document.getElementById('toast');
  el.textContent = m; el.className = 'toast ' + t + ' show';
  clearTimeout(el._t); el._t = setTimeout(function(){ el.classList.remove('show'); }, 2500);
}

function escapeHtml(s) { var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

// Open settings function
function openSettings() {
  document.getElementById('apiKeyInput').value = getApiKey();
  document.getElementById('apiKeyInput').type = 'password';
  document.getElementById('toggleKeyBtn').textContent = '\u{1F441}\uFE0F';
  document.getElementById('apiKeyStatus').textContent = '';
  document.getElementById('apiKeyStatus').className = 'api-status';
  if (hasApiKey()) { document.getElementById('apiKeyStatus').textContent = '\u2705 API Key \u5DF2\u914D\u7F6E'; document.getElementById('apiKeyStatus').className = 'api-status success'; }
  else { document.getElementById('apiKeyStatus').textContent = '\u26A0\uFE0F \u5C1A\u672A\u914D\u7F6E'; document.getElementById('apiKeyStatus').className = 'api-status error'; }
  document.getElementById('dashscopeKeyInput').value = getDashScopeKey();
  document.getElementById('dashscopeKeyInput').type = 'password';
  document.getElementById('toggleDashKeyBtn').textContent = '\u{1F441}\uFE0F';
  document.getElementById('dashscopeKeyStatus').textContent = '';
  document.getElementById('dashscopeKeyStatus').className = 'api-status';
  if (hasDashScopeKey()) { document.getElementById('dashscopeKeyStatus').textContent = '\u2705 DashScope Key \u5DF2\u914D\u7F6E'; document.getElementById('dashscopeKeyStatus').className = 'api-status success'; }
  else { document.getElementById('dashscopeKeyStatus').textContent = '\u26A0\uFE0F \u5C1A\u672A\u914D\u7F6E'; document.getElementById('dashscopeKeyStatus').className = 'api-status error'; }
  document.getElementById('settingsModal').style.display = 'flex';
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('active'); });
    t.classList.add('active');
    var tg = document.getElementById('tab-' + t.dataset.tab);
    if (tg) tg.classList.add('active');
    if (t.dataset.tab === 'stats') { if (typeof statsRenderer !== 'undefined') { statsRenderer.destroyAll(); statsRenderer.render(); } }
    if (t.dataset.tab === 'review') renderReviewList();
  });
});

// ===== Settings Modal =====
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettingsBtn').addEventListener('click', function(){ document.getElementById('settingsModal').style.display = 'none'; });
document.getElementById('settingsModal').addEventListener('click', function(e){ if (e.target === document.getElementById('settingsModal')) document.getElementById('settingsModal').style.display = 'none'; });

// DeepSeek key
document.getElementById('toggleKeyBtn').addEventListener('click', function(){
  var inp = document.getElementById('apiKeyInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  this.textContent = inp.type === 'password' ? '\u{1F441}\uFE0F' : '\u{1F648}';
});
document.getElementById('saveKeyBtn').addEventListener('click', function(){
  var k = document.getElementById('apiKeyInput').value.trim();
  if (!k || !k.startsWith('sk-')) { document.getElementById('apiKeyStatus').textContent = '\u26A0\uFE0F \u8BF7\u8F93\u5165\u6709\u6548 Key'; return; }
  setApiKey(k); showToast('API Key \u5DF2\u4FDD\u5B58', 'success');
  document.getElementById('settingsModal').style.display = 'none';
});
document.getElementById('clearKeyBtn').addEventListener('click', function(){
  if (confirm('\u786E\u5B9A\u6E05\u9664\uFF1F')) { clearApiKey(); document.getElementById('apiKeyInput').value = ''; showToast('\u5DF2\u6E05\u9664'); }
});

// DashScope key
document.getElementById('toggleDashKeyBtn').addEventListener('click', function(){
  var inp = document.getElementById('dashscopeKeyInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  this.textContent = inp.type === 'password' ? '\u{1F441}\uFE0F' : '\u{1F648}';
});
window._saveDashKey = function(){
  var k = document.getElementById('dashscopeKeyInput').value.trim();
  var s = document.getElementById('dashscopeKeyStatus');
  if (!k) { s.textContent = '\u26A0\uFE0F \u8BF7\u8F93\u5165 API Key'; return; }
  if (!k.startsWith('sk-')) { s.textContent = '\u26A0\uFE0F \u683C\u5F0F\u4E0D\u6B63\u786E'; return; }
  setDashScopeKey(k); showToast('DashScope Key \u5DF2\u4FDD\u5B58', 'success');
  s.textContent = '\u2705 DashScope Key \u5DF2\u914D\u7F6E'; s.className = 'api-status success';
};
window._clearDashKey = function(){
  if (confirm('\u786E\u5B9A\u6E05\u9664\uFF1F')) { clearDashScopeKey(); document.getElementById('dashscopeKeyInput').value = ''; showToast('\u5DF2\u6E05\u9664'); }
};

// ===== DOM refs =====
var uploadZone = document.getElementById('uploadZone');
var imageInput = document.getElementById('imageInput');
var previewImage = document.getElementById('previewImage');
var uploadPlaceholder = uploadZone.querySelector('.upload-placeholder');
var ocrBtn = document.getElementById('ocrBtn');
var ocrProgress = document.getElementById('ocrProgress');
var ocrStatusEl = document.getElementById('ocrStatus');
var progressFill = ocrProgress.querySelector('.progress-fill');
var ocrResult = document.getElementById('ocrResult');
var ocrText = document.getElementById('ocrText');
var thoughtSection = document.getElementById('thoughtSection');
var userThoughtInput = document.getElementById('userThought');
var analyzeBtn = document.getElementById('analyzeBtn');
var resultPanel = document.getElementById('resultPanel');
var analysisResult = document.getElementById('analysisResult');
var resultPlaceholder = resultPanel.querySelector('.result-placeholder');
var resultFullAnalysis = document.getElementById('resultFullAnalysis');
var currentImageData = null, lastAnalysisData = null, currentRecordId = null;

// ===== Upload & Ctrl+V =====
uploadZone.addEventListener('click', function(){ imageInput.click(); });
uploadZone.addEventListener('dragover', function(e){ e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', function(){ uploadZone.classList.remove('drag-over'); });
uploadZone.addEventListener('drop', function(e){ e.preventDefault(); uploadZone.classList.remove('drag-over'); var f=e.dataTransfer.files[0]; if(f)handleImageFile(f); });
imageInput.addEventListener('change', function(e){ var f=e.target.files[0]; if(f)handleImageFile(f); });

document.addEventListener('paste', function(e){
  if (document.activeElement && (document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA')) return;
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i=0;i<items.length;i++) {
    if (items[i].type && items[i].type.startsWith('image/')) {
      e.preventDefault();
      var at = document.getElementById('tab-analyze');
      if (!at.classList.contains('active')) {
        document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
        document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active');});
        var tt = document.querySelector('.tab[data-tab="analyze"]');
        if (tt) tt.classList.add('active');
        at.classList.add('active');
      }
      handleImageFile(items[i].getAsFile());
      showToast('\u5DF2\u7C98\u8D34\u622A\u56FE', 'success');
      return;
    }
  }
});

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) { showToast('\u8BF7\u4E0A\u4F20\u56FE\u7247', 'error'); return; }
  var r = new FileReader();
  r.onload = function(e) {
    currentImageData = e.target.result;
    previewImage.src = currentImageData; previewImage.style.display = 'block'; uploadPlaceholder.style.display = 'none';
    ocrBtn.disabled = false; ocrResult.style.display = 'none'; thoughtSection.style.display = 'none';
    analyzeBtn.style.display = 'none'; analysisResult.style.display = 'none'; resultPlaceholder.style.display = 'block';
    var dca = document.getElementById('detectedCorrectAnswer'); if (dca) dca.textContent = '';
    document.querySelectorAll('input[name="correctAnswer"]').forEach(function(r){r.checked=(r.value==='')});
    resetChat();
  };
  r.readAsDataURL(file);
}

// ===== Qwen-VL OCR =====
ocrBtn.addEventListener('click', function(){
  if (!currentImageData) return;
  if (!hasDashScopeKey()) { showToast('\u8BF7\u5148\u914D\u7F6E DashScope API Key', 'error'); openSettings(); return; }
  ocrBtn.disabled = true; ocrProgress.style.display = 'block'; ocrResult.style.display = 'none';
  thoughtSection.style.display = 'none'; analyzeBtn.style.display = 'none';
  progressFill.style.width = '30%'; ocrStatusEl.textContent = 'Qwen-VL \u6B63\u5728\u770B\u56FE\u8BC6\u522B...';

  fetch('/api/ocr-vision', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ imageData:currentImageData, dashscopeApiKey:getDashScopeKey() })
  }).then(function(r){ if(!r.ok)return r.json().then(function(e){throw new Error(e.message||e.error)}); return r.json(); })
  .then(function(data){
    progressFill.style.width = '100%'; ocrStatusEl.textContent = '\u8BC6\u522B\u5B8C\u6210';
    setTimeout(function(){
      ocrProgress.style.display = 'none'; ocrResult.style.display = 'block';
      ocrText.value = normalizeQuestionText(data.question || '');
      var qCorrect = data.correctAnswer || '';
      var qUser = data.userAnswer || '';
      // 第二层：前端正则分析（用于兜底 + 交叉校验）
      var fb = parseAnswersFromText(ocrText.value);
      if (!qCorrect && fb.correct) qCorrect = fb.correct;
      if (!qUser && fb.user) qUser = fb.user;
      var ca = document.getElementById('detectedCorrectAnswer');
      if (qCorrect && ca) ca.textContent = '\uFF08\u8BC6\u522B\u6B63\u786E\u7B54\u6848\uFF1A' + qCorrect + '\uFF09';
      // 交叉校验：视觉识别与文本正则结果不一致时，提醒用户确认，避免错误答案直接注入解析
      if (qCorrect && fb.correct && qCorrect !== fb.correct) {
        showToast('\u26A0\uFE0F \u7B54\u6848\u4E0D\u4E00\u81F4\uFF1A\u89C6\u89C9\u8BC6\u522B ' + qCorrect + '\uFF0C\u6587\u672C\u5206\u6790 ' + fb.correct + '\uFF0C\u8BF7\u624B\u52A8\u786E\u8BA4', 'error');
      }
      // 勾选正确答案 radio（用户可手动修正）
      if (qCorrect) { document.querySelectorAll('input[name="correctAnswer"]').forEach(function(r){ if(r.value===qCorrect)r.checked=true; }); }
      if (qUser) { document.querySelectorAll('input[name="userAnswer"]').forEach(function(r){ if(r.value===qUser)r.checked=true; }); }
      thoughtSection.style.display = 'block'; analyzeBtn.style.display = 'block'; ocrBtn.disabled = false;
      if (ocrText.value) { window._autoAnalyze = true; analyzeBtn.click(); }
      showToast(ocrText.value ? 'Qwen-VL \u8BC6\u522B\u5B8C\u6210' : '\u672A\u8BC6\u522B\u5230\u6587\u5B57', ocrText.value?'success':'error');
    },300);
  }).catch(function(err){
    ocrProgress.style.display = 'none'; ocrBtn.disabled = false;
    if (err.message.indexOf('API Key')>=0) { showToast('DashScope Key \u65E0\u6548', 'error'); openSettings(); }
    else showToast('Qwen-VL \u5931\u8D25: ' + err.message, 'error');
  });
});

// ===== Answer extraction =====
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

function autoFillAnswers(text) {
  var a=parseAnswersFromText(text);
  if(a.user)document.querySelectorAll('input[name="userAnswer"]').forEach(function(r){if(r.value===a.user)r.checked=true;});
  if(a.correct){var el=document.getElementById('detectedCorrectAnswer');if(el)el.textContent='\uFF08\u68C0\u6D4B\u5230\u6B63\u786E\u7B54\u6848\uFF1A'+a.correct+'\uFF09';}
  return a;
}

// ===== Two-stage Analysis =====
analyzeBtn.addEventListener('click', function(){
  var text=ocrText.value.trim();
  if(!text){showToast('\u8BF7\u5148\u8BC6\u522B\u6587\u5B57','error');return;}
  if(!hasApiKey()){showToast('\u8BF7\u914D\u7F6E API Key','error');openSettings();return;}
  var userThought=userThoughtInput.value.trim();
  var ur=document.querySelector('input[name="userAnswer"]:checked');
  var userAnswer=ur?ur.value:'';
  var dcEl=document.getElementById('detectedCorrectAnswer');
  var detectedCorrect=dcEl?(dcEl.textContent.match(/[A-D]/)||[''])[0]:'';
  // 优先使用"正确答案"单选钮（用户可手动修正），其次绿色标签，最后正则兜底
  var cr=document.querySelector('input[name="correctAnswer"]:checked');
  if(cr&&cr.value)detectedCorrect=cr.value;
  // 如果Qwen-VL没识别到答案,用正则兜底
  if(!detectedCorrect){var fb=parseAnswersFromText(text);if(fb.correct)detectedCorrect=fb.correct;if(!userAnswer&&fb.user){userAnswer=fb.user;document.querySelectorAll('input[name="userAnswer"]').forEach(function(r){if(r.value===fb.user)r.checked=true;});}}

  analyzeBtn.disabled=true; analyzeBtn.textContent='\u23F3 \u8BC6\u522B\u6A21\u5757...';
  resultPlaceholder.innerHTML='<span class="result-icon">\u{1F50D}</span><p>AI\u8BC6\u522B\u4E2D...</p>';

  fetch('/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text,apiKey:getApiKey()})})
  .then(function(r){if(!r.ok)return r.json().then(function(e){throw new Error(e.message||e.error)});return r.json();})
  .then(function(d){
    var module=d.module;
    analyzeBtn.textContent='\u23F3 '+module+' SOP\u89E3\u6790...';
    resultPlaceholder.innerHTML='<span class="result-icon">\u{1F52C}</span><p>\u5DF2\u8BC6\u522B\uFF1A<strong>'+module+'</strong></p><small>\u6B63\u5728\u5168\u8981\u7D20\u8FC7\u7B5B...</small>';
    return fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text,module:module,userThought:userThought,userAnswer:userAnswer,detectedCorrect:detectedCorrect,apiKey:getApiKey()})})
    .then(function(r){if(!r.ok)return r.json().then(function(e){if(r.status===401){showToast(e.message,'error');openSettings();}throw new Error(e.message||e.error)});return r.json();});
  })
  .then(function(data){
    lastAnalysisData=data;currentRecordId=null;
    renderFullAnalysis(data);
    resultPlaceholder.style.display='none';analysisResult.style.display='block';
    resetChat();
    showToast('\u89E3\u6790\u5B8C\u6210\uFF01'+data.module,'success');
  })
  .catch(function(err){
    resultPlaceholder.innerHTML='<span class="result-icon">\u274C</span><p>'+err.message+'</p>';
    showToast(err.message,'error');
  })
  .finally(function(){analyzeBtn.disabled=false;analyzeBtn.textContent='\u{1F916} DeepSeek \u667A\u80FD\u89E3\u6790';});
});

function stripJsonHeader(md) {
  return md ? md.replace(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>\s*/g, '').trim() : md;
}
function renderFullAnalysis(data) {
  document.getElementById('resultModule').textContent=data.module||'';
  document.getElementById('resultCategory').textContent=data.module||'';
  var df=document.getElementById('resultDifficulty');
  if(data.difficulty){df.textContent=data.difficulty;df.className='difficulty-badge '+(data.difficulty==='\u56F0\u96BE'?'hard':data.difficulty==='\u7B80\u5355'?'easy':'medium');}
  else{df.textContent='';df.className='difficulty-badge';}
  if(data.answerSuspicious){showToast('\u26A0\uFE0F \u6A21\u578B\u5224\u5B9A\u8BC6\u522B\u7684\u6B63\u786E\u7B54\u6848\u7591\u4F3C\u6709\u8BEF\uFF0C\u8BF7\u6838\u5BF9\u9898\u76EE', 'error');}
  var cleanMd=stripJsonHeader(data.rawMarkdown||data.solution||'');
  resultFullAnalysis.innerHTML=cleanMd?marked.parse(cleanMd):'';
  try{if(typeof renderMathInElement!=='undefined')renderMathInElement(resultFullAnalysis,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}
  var kd=document.getElementById('resultKnowledge');
  kd.innerHTML=(data.knowledgePoints||[]).map(function(k){return'<span class="knowledge-tag">'+escapeHtml(k)+'</span>'}).join('');
  document.getElementById('correctCheck').checked=false;
}

// ===== Save =====
document.getElementById('saveBtn').addEventListener('click',function(){
  var raw=lastAnalysisData?(lastAnalysisData.rawMarkdown||''):'';
  var kps=Array.from(document.querySelectorAll('#resultKnowledge .knowledge-tag')).map(function(e){return e.textContent});
  var ur2=document.querySelector('input[name="userAnswer"]:checked');
  var cr2=document.querySelector('input[name="correctAnswer"]:checked');
  storage.save({
    question:ocrText.value.trim().substring(0,300),solution:raw,answer:cr2?cr2.value:'',category:document.getElementById('resultCategory').textContent,
    difficulty:'\u4E2D\u7B49',knowledgePoints:kps,tips:'',isCorrect:document.getElementById('correctCheck').checked,
    imageData:currentImageData||'',rawMarkdown:raw,userAnswer:ur2?ur2.value:'',userThought:userThoughtInput.value.trim(),conversations:[]
  }).then(function(id){currentRecordId=id;showToast('\u5DF2\u4FDD\u5B58','success')}).catch(function(){showToast('\u4FDD\u5B58\u5931\u8D25')});
});

// ===== Voice (MediaRecorder + SenseVoice) =====
var mediaRecorder=null,audioChunks=[],micStream=null,currentMicBtn=null,speechOrigValue='';
function startRecording(targetEl){
  if(!hasDashScopeKey()){showToast('\u8BF7\u5148\u914D\u7F6E DashScope API Key','error');openSettings();return;}
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    micStream=stream;audioChunks=[];
    var mime='audio/webm';
    if(!MediaRecorder.isTypeSupported(mime))mime='audio/mp4';
    mediaRecorder=new MediaRecorder(stream,{mimeType:mime});
    mediaRecorder.ondataavailable=function(e){if(e.data.size>0)audioChunks.push(e.data)};
    mediaRecorder.onstop=function(){
      var blob=new Blob(audioChunks,{type:mime});
      var reader=new FileReader();
      reader.onload=function(){
        var b64=reader.result.split(',')[1];
        fetch('/api/speech-to-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:b64,mimeType:mime,dashscopeApiKey:getDashScopeKey()})})
        .then(function(r){if(!r.ok)return r.json().then(function(e){throw new Error(e.message||e.error)});return r.json()})
        .then(function(d){if(d.text&&targetEl)targetEl.value=speechOrigValue+d.text;showToast('\u8BED\u97F3\u8BC6\u522B\u5B8C\u6210','success')})
        .catch(function(err){showToast('\u8BED\u97F3\u5931\u8D25: '+err.message,'error')})
        .finally(function(){if(currentMicBtn){currentMicBtn.classList.remove('recording');currentMicBtn.textContent='\u{1F3A4}';currentMicBtn=null}});
      };
      reader.readAsDataURL(blob);
      if(micStream){micStream.getTracks().forEach(function(t){t.stop()});micStream=null}
    };
    mediaRecorder.start();
  }).catch(function(err){
    showToast('\u9EA6\u514B\u98CE\u6743\u9650\u672A\u6388\u4E88: '+err.message,'error');
    if(currentMicBtn){currentMicBtn.classList.remove('recording');currentMicBtn.textContent='\u{1F3A4}';currentMicBtn=null}
  });
}
function stopRecording(){if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop()}
document.addEventListener('click',function(e){
  var btn=e.target.closest('.mic-btn');
  if(!btn)return;
  e.preventDefault();e.stopPropagation();
  if(btn.classList.contains('recording')){stopRecording();btn.classList.remove('recording');btn.textContent='\u{1F3A4}';currentMicBtn=null;return}
  var target=document.getElementById(btn.dataset.target);
  if(!target)return;
  speechOrigValue=target.value;target.focus();
  currentMicBtn=btn;btn.classList.add('recording');btn.textContent='\u{1F534}';
  startRecording(target);
});

// ===== Screenshot =====
var screenshotBtn=document.getElementById('screenshotBtn');
if(screenshotBtn){screenshotBtn.addEventListener('click',function(){
  var el=document.getElementById('resultPanel');
  if(!el||typeof html2canvas==='undefined'){showToast('\u65E0\u6CD5\u622A\u56FE','error');return}
  screenshotBtn.disabled=true;screenshotBtn.textContent='\u23F3';
  var cp=document.getElementById('chatPanel'),wasCollapsed=cp&&cp.classList.contains('collapsed');
  if(wasCollapsed)cp.classList.remove('collapsed');
  html2canvas(el,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,scrollY:0,allowTaint:true,
    onclone:function(clonedDoc){
      var all=clonedDoc.querySelectorAll('*');
      for(var i=0;i<all.length;i++){
        var tag=all[i].tagName,cls=all[i].className||'';
        if(cls.indexOf('btn-capture')>=0){all[i].style.background='linear-gradient(135deg,#667eea,#764ba2)';all[i].style.color='#fff';continue}
        if(cls.indexOf('btn-success')>=0){all[i].style.background='#10b981';all[i].style.color='#fff';continue}
        if(cls.indexOf('module-badge')>=0||cls.indexOf('category-badge')>=0||cls.indexOf('difficulty-badge')>=0){all[i].style.background='#eef2ff';all[i].style.color='#4f46e5';continue}
        if(cls.indexOf('chat-message')>=0&&cls.indexOf('assistant')>=0){all[i].style.background='#f9fafb';continue}
        if(cls.indexOf('chat-message')>=0&&cls.indexOf('user')>=0){all[i].style.background='#eef2ff';continue}
        if(tag==='DIV'||tag==='SECTION'||tag==='TABLE'||tag==='TD'||tag==='TH'||tag==='PRE'||tag==='BLOCKQUOTE'||tag==='LI'||tag==='UL'||tag==='OL')all[i].style.backgroundColor='#ffffff';
      }
    }
  }).then(function(canvas){
    if(wasCollapsed&&cp)cp.classList.add('collapsed');
    canvas.toBlob(function(blob){
      try{navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(function(){showToast('\u2705 \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F','success')}).catch(function(){downloadFallback(canvas)})}
      catch(e){downloadFallback(canvas)}
    },'image/png');
  }).catch(function(err){if(wasCollapsed&&cp)cp.classList.add('collapsed');showToast('\u622A\u56FE\u5931\u8D25: '+err.message,'error')})
  .finally(function(){screenshotBtn.disabled=false;screenshotBtn.textContent='\u{1F4F8} \u622A\u56FE\u5206\u4EAB'});
})}
function downloadFallback(canvas){var a=document.createElement('a');a.download='\u884C\u6D4B\u89E3\u6790.png';a.href=canvas.toDataURL('image/png');a.click();showToast('\u5DF2\u4E0B\u8F7D','success')}

// ===== Chat =====
var chatToggle=document.getElementById('chatToggle'),chatPanel=document.getElementById('chatPanel');
var chatMessages=document.getElementById('chatMessages'),chatInput=document.getElementById('chatInput');
var chatSendBtn=document.getElementById('chatSendBtn'),chatHistory=[],isChatLoading=false;
chatToggle.addEventListener('click',function(){chatPanel.classList.toggle('collapsed')});
function resetChat(){chatHistory=[];chatMessages.innerHTML='<div class="chat-hint">\u{1F4A1} \u53EF\u4EE5\u8FFD\u95EE: "<strong>B\u9009\u9879\u4E3A\u4EC0\u4E48\u9519</strong>\uFF1F"</div>'}
function addChatMessage(role,content){
  var h=chatMessages.querySelector('.chat-hint');if(h)h.remove();
  var d=document.createElement('div');d.className='chat-message '+role;
  d.innerHTML=role==='assistant'?marked.parse(content):escapeHtml(content);
  if(role==='assistant')try{if(typeof renderMathInElement!=='undefined')renderMathInElement(d,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}
  var t=document.createElement('div');t.className='chat-message-time';t.textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  d.appendChild(t);chatMessages.appendChild(d);chatMessages.scrollTop=chatMessages.scrollHeight;
  chatHistory.push({role:role,content:content,time:new Date().toISOString()});
}
function sendChat(){
  var m=chatInput.value.trim();
  if(!m||isChatLoading)return;
  if(!lastAnalysisData){showToast('\u8BF7\u5148\u89E3\u6790\u9898\u76EE','error');return}
  if(!hasApiKey()){showToast('\u8BF7\u914D\u7F6E API Key','error');openSettings();return}
  isChatLoading=true;chatSendBtn.disabled=true;chatInput.value='';
  addChatMessage('user',m);
  var ty=document.createElement('div');ty.className='chat-typing';ty.id='ct';ty.innerHTML='AI\u601D\u8003\u4E2D...';chatMessages.appendChild(ty);
  fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionText:ocrText.value||'',analysisText:(lastAnalysisData.rawMarkdown||''),history:chatHistory.slice(0,-1),message:m,apiKey:getApiKey()})})
  .then(function(r){var t=document.getElementById('ct');if(t)t.remove();if(!r.ok)return r.json().then(function(e){throw new Error(e.message||e.error)});return r.json()})
  .then(function(d){addChatMessage('assistant',d.reply);if(currentRecordId){storage.addConversation(currentRecordId,{role:'user',content:m,time:chatHistory[chatHistory.length-2]?chatHistory[chatHistory.length-2].time:new Date().toISOString()});storage.addConversation(currentRecordId,{role:'assistant',content:d.reply,time:new Date().toISOString()})}})
  .catch(function(e){var t=document.getElementById('ct');if(t)t.remove();addChatMessage('assistant','\u62B1\u6B49: '+e.message)})
  .finally(function(){isChatLoading=false;chatSendBtn.disabled=false;chatInput.focus()});
}
chatSendBtn.addEventListener('click',sendChat);
chatInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});

// ===== Review =====
function renderReviewList(){
  var f={category:document.getElementById('filterCategory').value,difficulty:document.getElementById('filterDifficulty').value,isCorrect:document.getElementById('filterCorrect').value,dateStart:document.getElementById('filterDateStart').value,dateEnd:document.getElementById('filterDateEnd').value};
  storage.getAll(f).then(function(data){
    var c=document.getElementById('reviewList');
    if(!data||data.length===0){c.innerHTML='<div class="empty-state"><span>\u{1F4ED}</span><p>\u8FD8\u6CA1\u6709\u4FDD\u5B58\u7684\u9898\u76EE\u8BB0\u5F55</p></div>';return}
    c.innerHTML=data.map(function(r,i){return'<div class="review-card" data-id="'+r.id+'"><div class="review-card-header"><span class="review-category">'+escapeHtml(r.category||'')+'</span><span class="review-difficulty '+escapeHtml(r.difficulty||'')+'">'+escapeHtml(r.difficulty||'')+'</span><span class="review-correct '+(r.isCorrect?'correct':'wrong')+'">'+(r.isCorrect?'\u2705 \u505A\u5BF9\u4E86':'\u274C \u505A\u9519\u4E86')+'</span><span class="review-date">'+new Date(r.createdAt).toLocaleDateString('zh-CN')+'</span></div><div class="review-card-body"><div class="review-question">'+escapeHtml(r.question||'')+'</div></div><div class="review-card-actions"><button class="btn btn-small" onclick="viewReviewCard('+r.id+')">\u{1F50D} \u67E5\u770B</button><button class="btn btn-small btn-danger" onclick="deleteReviewCard('+r.id+')">\u{1F5D1} \u5220\u9664</button></div></div>'}).join('')
  });
}
window.viewReviewCard=function(id){
  storage.getById(id).then(function(r){
    if(!r)return;
    // Switch to analyze tab
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
    document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active')});
    var tt=document.querySelector('.tab[data-tab="analyze"]');if(tt)tt.classList.add('active');
    document.getElementById('tab-analyze').classList.add('active');
    // Fill data
    ocrText.value=r.question||'';currentImageData=r.imageData||'';
    if(r.imageData){previewImage.src=r.imageData;previewImage.style.display='block';uploadPlaceholder.style.display='none';ocrBtn.disabled=false}
    if(r.userAnswer)document.querySelectorAll('input[name="userAnswer"]').forEach(function(rb){if(rb.value===r.userAnswer)rb.checked=true});
    if(r.answer)document.querySelectorAll('input[name="correctAnswer"]').forEach(function(rb){if(rb.value===r.answer)rb.checked=true});
    userThoughtInput.value=r.userThought||'';
    thoughtSection.style.display='block';analyzeBtn.style.display='block';
    // Render saved analysis
    lastAnalysisData={module:r.category||'',rawMarkdown:r.rawMarkdown||r.solution||'',knowledgePoints:r.knowledgePoints||[]};
    currentRecordId=r.id;
    renderFullAnalysis(lastAnalysisData);
    resultPlaceholder.style.display='none';analysisResult.style.display='block';
    document.getElementById('correctCheck').checked=r.isCorrect||false;
    // Load conversations
    resetChat();
    if(r.conversations&&r.conversations.length>0){r.conversations.forEach(function(msg){addChatMessage(msg.role,msg.content)})}
  });
};
window.deleteReviewCard=function(id){
  if(!confirm('\u786E\u5B9A\u5220\u9664\uFF1F'))return;
  storage.delete(id).then(function(){renderReviewList();showToast('\u5DF2\u5220\u9664')});
};

// ===== Export =====
document.getElementById('exportJSONBtn').addEventListener('click',function(){if(typeof exporter!=='undefined')exporter.exportJSON()});
document.getElementById('exportCSVBtn').addEventListener('click',function(){if(typeof exporter!=='undefined')exporter.exportCSV()});
document.getElementById('exportPDFBtn').addEventListener('click',function(){if(typeof exporter!=='undefined')exporter.exportPDF()});

// ===== Init =====
storage.init().then(function(){console.log('DB OK')}).catch(function(e){console.error(e)});
if(!hasApiKey())setTimeout(function(){document.getElementById('settingsModal').style.display='flex'},500);
