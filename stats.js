// ===== 统计图表模块 =====
class StatsRenderer {
  constructor() {
    this.charts = {};
  }

  destroyAll() {
    Object.values(this.charts).forEach((c) => c.destroy());
    this.charts = {};
  }

  async render() {
    const stats = await storage.getStats();
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statAccuracy").textContent = stats.accuracy + "%";
    document.getElementById("statWeakness").textContent = stats.weakest;
    document.getElementById("statTrend").textContent = stats.trend;

    this.renderCategoryChart(stats);
    this.renderAccuracyChart(stats);
    this.renderDifficultyChart(stats);
    this.renderTrendChart(stats);
    this.renderWeaknesses(stats);
    this.renderScoreTrend();
  }

  renderCategoryChart(stats) {
    const ctx = document.getElementById("chartCategory").getContext("2d");
    const labels = Object.keys(stats.byCategory);
    const data = Object.values(stats.byCategory);

    this.charts.category = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ["#818cf8", "#34d399", "#fbbf24", "#f472b6", "#38bdf8", "#f97316"],
          borderWidth: 2,
          borderColor: "#fff",
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, font: { size: 12 } },
          },
        },
      },
    });
  }

  renderAccuracyChart(stats) {
    const ctx = document.getElementById("chartAccuracy").getContext("2d");
    const labels = Object.keys(stats.byCategory);
    const rates = labels.map((cat) => {
      const total = stats.byCategory[cat];
      if (total === 0) return 0;
      return Math.round((stats.byCategoryCorrect[cat] / total) * 100);
    });

    this.charts.accuracy = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "正确率 (%)",
          data: rates,
          backgroundColor: rates.map((r) =>
            r >= 70 ? "#34d399" : r >= 40 ? "#fbbf24" : "#ef4444"
          ),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  renderDifficultyChart(stats) {
    const ctx = document.getElementById("chartDifficulty").getContext("2d");
    const labels = Object.keys(stats.byDifficulty);
    const data = Object.values(stats.byDifficulty);

    this.charts.difficulty = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels.map((l) => {
          if (l === "简单") return "简单";
          if (l === "中等") return "中等";
          return "困难";
        }),
        datasets: [{
          data,
          backgroundColor: ["#34d399", "#fbbf24", "#ef4444"],
          borderWidth: 2,
          borderColor: "#fff",
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, font: { size: 12 } },
          },
        },
      },
    });
  }

  renderTrendChart(stats) {
    const ctx = document.getElementById("chartTrend").getContext("2d");
    const labels = stats.dailyData.map((d) => d.date);
    const totals = stats.dailyData.map((d) => d.total);
    const corrects = stats.dailyData.map((d) => d.correct);

    this.charts.trend = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "做题数",
            data: totals,
            borderColor: "#818cf8",
            backgroundColor: "rgba(129,140,248,0.1)",
            fill: true,
            tension: 0.3,
          },
          {
            label: "正确数",
            data: corrects,
            borderColor: "#34d399",
            backgroundColor: "rgba(52,211,153,0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
        plugins: {
          legend: { position: "bottom", labels: { padding: 16, font: { size: 12 } } },
        },
      },
    });
  }

  renderScoreTrend() {
    const ctx = document.getElementById("chartScoreTrend");
    if (!ctx) return;
    storage.getScores().then((scores) => {
      if (!scores || scores.length === 0) {
        // 无评分数据时显示占位提示
        ctx.parentElement.innerHTML =
          '<p class="empty-state" style="padding:30px;text-align:center;color:var(--text-secondary);font-size:0.85rem;">暂无评分记录<br><small>在 Lite 版解析时填写思考过程，即可累积你的思考能力评分</small></p>';
        return;
      }
      const labels = scores.map((s) => {
        const d = new Date(s.createdAt);
        return (d.getMonth() + 1) + "/" + d.getDate();
      });
      const totals = scores.map((s) => s.total);
      const basis = scores.map((s) => s.basis);
      // 只保留最后 30 条，避免图太挤
      const N = 30;
      const L = labels.length;
      const last = (arr) => (L > N ? arr.slice(L - N) : arr);
      this.charts.scoreTrend = new Chart(ctx, {
        type: "line",
        data: {
          labels: last(labels),
          datasets: [
            {
              label: "总分",
              data: last(totals),
              borderColor: "#4f46e5",
              backgroundColor: "rgba(79,70,229,0.12)",
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            },
            {
              label: "判断依据分(×10)",
              data: last(basis).map((v) => v * 10),
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245,158,11,0.06)",
              fill: false,
              tension: 0.3,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v } },
          },
          plugins: {
            legend: { position: "bottom", labels: { padding: 16, font: { size: 12 } } },
          },
        },
      });
    }).catch(() => {});
  }

  renderWeaknesses(stats) {
    const container = document.getElementById("weaknessContent");
    if (stats.weaknesses.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无足够数据（需要至少2道相同知识点的题目）</p>';
      return;
    }

    container.innerHTML = stats.weaknesses
      .map(
        (w) => `
      <div class="weakness-item">
        <span class="weakness-name">${this.escapeHtml(w.name)}</span>
        <div class="weakness-bar">
          <div class="weakness-fill" style="width:${w.wrongRate}%"></div>
        </div>
        <span class="weakness-rate">${w.wrongRate}% 错误率</span>
      </div>
    `
      )
      .join("");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

const statsRenderer = new StatsRenderer();
