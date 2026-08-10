// ===== OCR 识别模块（Tesseract.js v5） =====
var OCR = (function(){
  function OCR() { this.worker = null; }

  OCR.prototype.init = function(onProgress) {
    if (this.worker) return Promise.resolve(this.worker);
    var self = this;
    return Tesseract.createWorker('chi_sim').then(function(w){
      self.worker = w;
      if (onProgress) onProgress(100);
      return w;
    });
  };

  OCR.prototype.recognize = function(imageData, onProgress, onStatus) {
    var self = this;
    if (onStatus) onStatus('正在加载中文语言包...');
    return self.init(onProgress).then(function(worker){
      if (onStatus) onStatus('正在识别文字...');
      return worker.recognize(imageData);
    }).then(function(result){
      return result.data.text;
    });
  };

  OCR.prototype.terminate = function() {
    if (this.worker) {
      var w = this.worker;
      this.worker = null;
      return w.terminate();
    }
    return Promise.resolve();
  };

  return OCR;
})();

var ocrEngine = new OCR();