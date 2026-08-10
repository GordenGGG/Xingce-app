// ===== 行测备考助手 v2.0 PWA =====
var DS_KEY='xingce_ds', DK_KEY='xingce_dk';
function gk(k){return localStorage.getItem(k)||''}
function sk(k,v){localStorage.setItem(k,v.trim())}
function ck(k){localStorage.removeItem(k)}
function hasDS(){return gk(DS_KEY).length>0}
function hasDK(){return gk(DK_KEY).length>0}

function toast(m,t){t=t||'';var e=document.getElementById('toast');e.textContent=m;e.className='toast '+t+' show';clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove('show')},2500)}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}

// ===== DeepSeek API =====
async function callDS(system,user,temp){temp=temp||0.4;
  var r=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gk(DS_KEY)},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:system},{role:'user',content:user}],temperature:temp,max_tokens:4096})});
  if(!r.ok){var e=await r.text();if(r.status===401)throw new Error('DeepSeek Key 无效');throw new Error(e)}
  var d=await r.json();return d.choices[0].message.content
}

// ===== Qwen-VL OCR =====
async function callQwenVL(imageData){
  var r=await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gk(DK_KEY)},body:JSON.stringify({model:'qwen-vl-plus',messages:[{role:'user',content:[{type:'image_url',image_url:{url:imageData}},{type:'text',text:'请仔细阅读这张行测题目截图，精确提取信息并以JSON返回：\\n{\\n  "question": "题目完整原文（含选项，保持排版）",\\n  "correctAnswer": "A/B/C/D",\\n  "userAnswer": "A/B/C/D 或空"\\n}\\n\\n截图底部统计行格式如"正确答案 A  你的答案 D  55%"或"B  87%  1m20s  A"。从中提取答案。如果无"你的答案"列，userAnswer等于correctAnswer。分数写成a/b形式。只返回JSON，不要Markdown包裹。'}]}],max_tokens:2000,temperature:0.1})});
  if(!r.ok){var e=await r.text();if(r.status===401)throw new Error('DashScope Key 无效');throw new Error(e)}
  var d=await r.json();var c=d.choices[0].message.content;
  try{var cl=c.replace(/^```json\s*/i,'').replace(/```\s*$/i,'');var p=JSON.parse(cl);return{question:p.question||c,correctAnswer:(p.correctAnswer||'').toUpperCase(),userAnswer:(p.userAnswer||'').toUpperCase()}}
  catch(e){return{question:c,correctAnswer:'',userAnswer:''}}
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

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(function(t){t.addEventListener('click',function(){document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.tab-content').forEach(function(x){x.classList.remove('active')});t.classList.add('active');var tg=document.getElementById('tab-'+t.dataset.tab);if(tg)tg.classList.add('active')})});

// ===== DOM refs =====
var uz=document.getElementById('uploadZone'),ii=document.getElementById('imageInput'),pi=document.getElementById('previewImage'),up=uz.querySelector('.upload-placeholder');
var ob=document.getElementById('ocrBtn'),op=document.getElementById('ocrProgress'),os=document.getElementById('ocrStatus'),pf=op.querySelector('.progress-fill');
var ore=document.getElementById('ocrResult'),ot=document.getElementById('ocrText');
var ts=document.getElementById('thoughtSection'),ut=document.getElementById('userThought');
var ab=document.getElementById('analyzeBtn'),rp=document.getElementById('resultPanel'),ar=document.getElementById('analysisResult'),rph=rp.querySelector('.result-placeholder'),rfa=document.getElementById('resultFullAnalysis');
var cid=null,lad=null,lastAnalysis=null;

// ===== Upload =====
uz.addEventListener('click',function(){ii.click()});uz.addEventListener('dragover',function(e){e.preventDefault()});uz.addEventListener('drop',function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)hif(f)});ii.addEventListener('change',function(e){var f=e.target.files[0];if(f)hif(f)});
document.addEventListener('paste',function(e){if(document.activeElement&&(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA'))return;var it=e.clipboardData&&e.clipboardData.items;if(!it)return;for(var i=0;i<it.length;i++){if(it[i].type&&it[i].type.startsWith('image/')){e.preventDefault();hif(it[i].getAsFile());toast('已粘贴');return}}});
function hif(f){if(!f.type.startsWith('image/')){toast('请上传图片','error');return}var r=new FileReader();r.onload=function(e){cid=e.target.result;pi.src=cid;pi.style.display='block';up.style.display='none';ob.disabled=false;ore.style.display='none';ts.style.display='none';ab.style.display='none';ar.style.display='none';rph.style.display='block';document.getElementById('detectedCorrectAnswer').textContent='';resetChat()};r.readAsDataURL(f)}

// ===== OCR =====
ob.addEventListener('click',function(){
  if(!cid)return;if(!hasDK()){toast('请配置DashScope Key','error');openSettings();return}
  ob.disabled=true;op.style.display='block';ore.style.display='none';ts.style.display='none';ab.style.display='none';
  pf.style.width='30%';os.textContent='Qwen-VL正在看图识别...';
  callQwenVL(cid).then(function(d){
    pf.style.width='100%';os.textContent='完成';
    setTimeout(function(){op.style.display='none';ore.style.display='block';ot.value=d.question||'';
      var ca=document.getElementById('detectedCorrectAnswer');if(d.correctAnswer&&ca)ca.textContent='(正确答案:'+d.correctAnswer+')';
      if(d.userAnswer)document.querySelectorAll('input[name="userAnswer"]').forEach(function(r){if(r.value===d.userAnswer)r.checked=true});
      ts.style.display='block';ab.style.display='block';ob.disabled=false;toast(ot.value?'识别完成':'未识别到文字',ot.value?'success':'error')},300)
  }).catch(function(e){op.style.display='none';ob.disabled=false;toast(e.message,'error')})
});

// ===== Analysis =====
ab.addEventListener('click',function(){
  var t=ot.value.trim();if(!t){toast('请先识别文字','error');return}if(!hasDS()){toast('请配置DeepSeek Key','error');openSettings();return}
  var ua=document.querySelector('input[name="userAnswer"]:checked');var utt=ut.value.trim();
  var dcEl=document.getElementById('detectedCorrectAnswer');var dc=dcEl?(dcEl.textContent.match(/[A-D]/)||[''])[0]:'';
  ab.disabled=true;ab.textContent='\u23F3 识别模块...';rph.innerHTML='<span class="result-icon">\u{1F50D}</span><p>AI识别中...</p>';
  callDS('你是一个行测题目分类器，只输出模块名称。',CLASSIFIER_PROMPT.replace('{{text}}',t),0.1).then(function(m){m=m.trim();if(!MODULE_PROMPTS[m])m='常识判断';
    ab.textContent='\u23F3 '+m+' SOP解析...';rph.innerHTML='<span class="result-icon">\u{1F52C}</span><p>已识别：<strong>'+m+'</strong></p><small>全要素过筛中...</small>';
    var p=MODULE_PROMPTS[m];p=p.replace('{{text}}',t);p=p.replace('{{userThought}}',utt||'（未提供）');
    p=p.replace('{{userAnswer}}',ua?ua.value:'（未提供）');p=p.replace('{{correctAnswer}}',dc||'（未识别）');
    return callDS('你是专业的行测辅导老师，严格按SOP格式输出解析，对每个选项进行全要素无死角过筛。',p,0.4)
  }).then(function(r){lastAnalysis={module:'',rawMarkdown:r,knowledgePoints:[]};renderAnalysis(r);rph.style.display='none';ar.style.display='block';resetChat();toast('解析完成','success')}).catch(function(e){rph.innerHTML='<span class="result-icon">\u274C</span><p>'+e.message+'</p>';toast(e.message,'error')}).finally(function(){ab.disabled=false;ab.textContent='\u{1F916} DeepSeek智能解析'})
});
function renderAnalysis(r){document.getElementById('resultFullAnalysis').innerHTML=marked.parse(r);try{if(typeof renderMathInElement!=='undefined')renderMathInElement(rfa,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}}

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
function resetChat(){ch=[];cm.innerHTML='<div class="chat-hint">\u{1F4A1} 追问: "<strong>B选项为什么错</strong>？"</div>'}
function addCM(role,content){var h=cm.querySelector('.chat-hint');if(h)h.remove();var d=document.createElement('div');d.className='chat-message '+role;d.innerHTML=role==='assistant'?marked.parse(content):esc(content);if(role==='assistant')try{if(typeof renderMathInElement!=='undefined')renderMathInElement(d,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})}catch(e){}var t=document.createElement('div');t.className='chat-message-time';t.textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});d.appendChild(t);cm.appendChild(d);cm.scrollTop=cm.scrollHeight;ch.push({role:role,content:content})}
function sendChat(){var m=ci.value.trim();if(!m||icl)return;if(!lastAnalysis){toast('请先解析题目','error');return}if(!hasDS()){toast('请配置Key','error');openSettings();return}icl=true;csb.disabled=true;ci.value='';addCM('user',m);var ty=document.createElement('div');ty.className='chat-typing';ty.textContent='AI思考中...';cm.appendChild(ty);
  var sys='你是耐心的行测辅导老师。题目原文：'+ot.value+'。完整解析：'+(lastAnalysis.rawMarkdown||'')+'。请根据学生追问给出针对性解答。';
  callDS(sys,ch.slice(0,-1).map(function(h){return h.role==='user'?'学生: '+h.content:'解析: '+h.content}).join('\n')+'\n\n学生追问: '+m,0.5).then(function(r){var t=document.querySelector('.chat-typing');if(t)t.remove();addCM('assistant',r)}).catch(function(e){var t=document.querySelector('.chat-typing');if(t)t.remove();addCM('assistant','抱歉: '+e.message)}).finally(function(){icl=false;csb.disabled=false;ci.focus()})
}
csb.addEventListener('click',sendChat);ci.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});

// ===== Init =====
if(!hasDS()&&!hasDK())setTimeout(function(){document.getElementById('settingsModal').style.display='flex'},500);
