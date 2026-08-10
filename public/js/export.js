// ===== 导出模块（JSON / CSV / PDF） =====
class Exporter {
  async getFilteredData() {
    const filters = {
      category: document.getElementById("filterCategory").value,
      difficulty: document.getElementById("filterDifficulty").value,
      isCorrect: document.getElementById("filterCorrect").value,
      dateStart: document.getElementById("filterDateStart").value,
      dateEnd: document.getElementById("filterDateEnd").value,
    };
    return await storage.getAll(filters);
  }

  exportJSON() {
    this.getFilteredData().then((data) => {
      const json = JSON.stringify(data, null, 2);
      this.download(json, "行测错题_export.json", "application/json");
      showToast("JSON 导出成功！", "success");
    });
  }

  exportCSV() {
    this.getFilteredData().then((data) => {
      const headers = ["编号", "题目", "解析", "答案", "类型", "难度", "知识点", "对错", "日期"];
      const rows = data.map((r) => [
        r.id,
        this.csvEscape(r.question || ""),
        this.csvEscape(r.solution || ""),
        this.csvEscape(r.answer || ""),
        r.category || "",
        r.difficulty || "",
        this.csvEscape((r.knowledgePoints || []).join("；")),
        r.isCorrect ? "正确" : "错误",
        r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN") : "",
      ]);
      const bom = "\uFEFF";
      const csv = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      this.download(csv, "行测错题_export.csv", "text/csv;charset=utf-8");
      showToast("CSV 导出成功！", "success");
    });
  }

  csvEscape(str) {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  async exportPDF() {
    const data = await this.getFilteredData();
    if (data.length === 0) {
      showToast("没有可导出的题目", "error");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    // 标题
    doc.setFontSize(18);
    doc.text("行测备考错题本", margin, 20);

    // 基本信息
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`导出时间: ${new Date().toLocaleString("zh-CN")}  共 ${data.length} 题`, margin, 28);

    let y = 36;
    doc.setFontSize(11);
    doc.setTextColor(0);

    for (let i = 0; i < data.length; i++) {
      const r = data[i];

      // 检查分页
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      // 分隔线
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // 题目编号 & 类型
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text(`#${i + 1}  [${r.category}]  ${r.difficulty || ""}  ${r.isCorrect ? "✓正确" : "✗错误"}`, margin, y);
      y += 6;

      // 题目内容
      doc.setFontSize(10);
      doc.setTextColor(50);
      const questionLines = doc.splitTextToSize(r.question || "", maxWidth);
      for (const line of questionLines) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 5;
      }
      y += 3;

      // 答案
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129);
      doc.text(`答案: ${r.answer || ""}`, margin, y);
      y += 5;

      // 知识点
      if (r.knowledgePoints && r.knowledgePoints.length > 0) {
        doc.setTextColor(100);
        doc.text(`知识点: ${r.knowledgePoints.join(", ")}`, margin, y);
        y += 5;
      }

      // 解析
      doc.setTextColor(50);
      const solutionLines = doc.splitTextToSize(r.solution || "", maxWidth);
      for (const line of solutionLines) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 5;
      }

      y += 6;
    }

    doc.save("行测错题本.pdf");
    showToast("PDF 导出成功！", "success");
  }

  download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

const exporter = new Exporter();
