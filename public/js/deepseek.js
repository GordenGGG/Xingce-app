// === DeepSeek API direct call helper ===
function callDeepSeek(messages, temp) {
  temp = temp || 0.4;
  return fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getApiKey() },
    body: JSON.stringify({ model: 'deepseek-chat', messages: messages, temperature: temp, max_tokens: 4096 })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(e) {
      if (r.status === 401) { showToast('API Key\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5', 'error'); openSettings(); }
      throw new Error('API\u8C03\u7528\u5931\u8D25');
    });
    return r.json();
  }).then(function(d) {
    return d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
  });
}