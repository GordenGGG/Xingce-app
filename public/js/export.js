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
    const pageW = doc.internal.pageSize.getWidth();   // 210mm
    const pageH = doc.internal.pageSize.getHeight();  // 297mm
    const margin = 10;
    const imgW = pageW - margin * 2;                  // 190mm
    const contentW = 720;                             // 内容容器宽 px
    const maxH = 980;                                 // 每页内容最大高度 px

    // 隐藏容器（html2canvas 需要元素在 DOM 且可渲染，用视口外定位）
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:absolute;left:-9999px;top:0;width:" + contentW + "px;background:#ffffff;color:#1f2937;" +
      'font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:14px;line-height:1.8;';
    document.body.appendChild(holder);

    const pageEl = document.createElement("div");
    pageEl.style.cssText = "width:" + contentW + "px;padding:20px;box-sizing:border-box;background:#fff;";
    holder.appendChild(pageEl);

    let pageNum = 0;
    const addCurrentPage = async () => {
      if (!pageEl.innerHTML.trim()) return;
      const canvas = await html2canvas(pageEl, {
        backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      const imgH = (canvas.height / canvas.width) * imgW; // 保持宽高比
      if (pageNum > 0) doc.addPage();
      doc.addImage(img, "JPEG", margin, margin, imgW, Math.min(imgH, pageH - margin * 2));
      pageNum++;
      pageEl.innerHTML = "";
    };

    const blockHtml = (r, i) =>
      '<div style="margin-bottom:14px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;">' +
      '<div style="font-weight:bold;color:#4f46e5;margin-bottom:4px;">#' + (i + 1) + " [" + escapeHtml(r.category || "") + "] " + escapeHtml(r.difficulty || "") + " " + (r.isCorrect ? "✓正确" : "✗错误") + "</div>" +
      '<div style="margin-bottom:4px;">' + escapeHtml(r.question || "") + "</div>" +
      (r.answer ? '<div style="color:#10b981;margin-bottom:4px;">答案：' + escapeHtml(r.answer) + "</div>" : "") +
      (r.userAnswer ? '<div style="color:#64748b;margin-bottom:4px;">我的答案：' + escapeHtml(r.userAnswer) + "</div>" : "") +
      ((r.knowledgePoints || []).length ? '<div style="color:#92400e;margin-bottom:4px;">知识点：' + escapeHtml(r.knowledgePoints.join("；")) + "</div>" : "") +
      '<div style="white-space:pre-wrap;">' + escapeHtml(r.solution || "") + "</div>" +
      "</div>";

    for (let i = 0; i < data.length; i++) {
      const div = document.createElement("div");
      div.innerHTML = blockHtml(data[i], i);
      pageEl.appendChild(div);
      if (pageEl.offsetHeight > maxH) {
        pageEl.removeChild(div);
        if (!pageEl.innerHTML.trim()) {
          // 单块本身超高：单独输出该块（压缩到页面高度）
          pageEl.appendChild(div);
          await addCurrentPage();
        } else {
          await addCurrentPage();
          pageEl.appendChild(div);
        }
      }
    }
    await addCurrentPage();
    document.body.removeChild(holder);
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
