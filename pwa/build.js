const fs = require("fs");
const path = require("path");
const base = __dirname + "/..";

function stripBOM(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }
function stripPrompt(content) {
  content = stripBOM(content);
  content = content.replace(/^module\.exports\s*=\s*`/, "");
  content = content.replace(/`\s*;?\s*$/m, "");
  return content.trim();
}

// 1. Read and bundle prompts
const classifierPrompt = stripPrompt(
  fs.readFileSync(path.join(base, "prompts/classifier.js"), "utf8")
);
const moduleNames = ["政治理论","常识判断","言语理解","数量关系","判断推理","资料分析"];
const moduleFiles = ["politics","common_sense","verbal","quantitative","judgment","data_analysis"];
const modulePrompts = {};
moduleFiles.forEach(function(f, i) {
  modulePrompts[moduleNames[i]] = stripPrompt(
    fs.readFileSync(path.join(base, "prompts/" + f + ".js"), "utf8")
  );
});

// Generate prompts.js as direct JS object (avoids JSON.parse + backtick issues)
let out = "// Auto-generated prompt bundle\n";
out += "var CLASSIFIER_PROMPT = " + JSON.stringify(classifierPrompt) + ";\n";
out += "var MODULE_PROMPTS = {\n";
moduleNames.forEach(function(name, idx) {
  out += "  " + JSON.stringify(name) + ": " + JSON.stringify(modulePrompts[name]) + (idx < moduleNames.length - 1 ? "," : "") + "\n";
});
out += "};\n";
fs.writeFileSync(path.join(base, "pwa/prompts.js"), out, "utf8");
console.log("1/3 prompts.js bundled (" + out.length + " bytes)");

// 2. Copy CSS
const css = fs.readFileSync(path.join(base, "public/css/style.css"), "utf8");
fs.writeFileSync(path.join(base, "pwa/style.css"), css, "utf8");
console.log("2/3 style.css copied");

// 3. Create manifest
const manifest = {
  name: "行测备考助手",
  short_name: "行测助手",
  description: "行测题目OCR识别+DeepSeek智能解析+错题复盘",
  start_url: ".",
  display: "standalone",
  background_color: "#f8fafc",
  theme_color: "#4f46e5",
  orientation: "any",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" }
  ]
};
fs.writeFileSync(path.join(base, "pwa/manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log("3/3 manifest.json updated");
console.log("Done!");
