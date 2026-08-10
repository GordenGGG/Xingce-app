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
          backgroundColor: ["#818cf8", "#34d399", "#fbbf24", "#f472b6", "#38bdf8"],
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
