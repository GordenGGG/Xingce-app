// ===== IndexedDB 存储模块 =====
const DB_NAME = "XingCeApp";
const DB_VERSION = 3;
const STORE_NAME = "questions";
const SCORE_STORE = "scores";

class Storage {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("difficulty", "difficulty", { unique: false });
          store.createIndex("isCorrect", "isCorrect", { unique: false });
        }
        // 思考过程评分记录存储
        if (!db.objectStoreNames.contains(SCORE_STORE)) {
          const ss = db.createObjectStore(SCORE_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          ss.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => {
        console.error("数据库初始化失败:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  async save(record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.add({
        ...record,
        createdAt: record.createdAt || new Date().toISOString(),
        conversations: record.conversations || [],
        userThought: record.userThought || '',
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async update(id, changes) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) return reject(new Error("记录不存在"));
        Object.assign(record, changes);
        store.put(record).onsuccess = () => resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async addConversation(id, message) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) return reject(new Error("记录不存在"));
        if (!record.conversations) record.conversations = [];
        record.conversations.push(message);
        store.put(record).onsuccess = () => resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async delete(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 批量删除（错题本多选操作）
  async deleteMany(ids) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      let done = 0;
      ids.forEach((id) => {
        const req = store.delete(id);
        req.onsuccess = () => { if (++done === ids.length) resolve(); };
        req.onerror = () => reject(req.error);
      });
      if (ids.length === 0) resolve();
    });
  }

  // 批量更新（错题本多选操作，如批量标记掌握）
  async updateMany(ids, changes) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      let done = 0;
      ids.forEach((id) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const record = getReq.result;
          if (!record) { if (++done === ids.length) resolve(); return; }
          Object.assign(record, changes);
          const putReq = store.put(record);
          putReq.onsuccess = () => { if (++done === ids.length) resolve(); };
          putReq.onerror = () => reject(putReq.error || new Error("更新失败"));
        };
        getReq.onerror = () => reject(getReq.error);
      });
      if (ids.length === 0) resolve();
    });
  }

  async getById(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(filters = {}) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        let results = request.result;

        if (filters.category && filters.category !== "all") {
          results = results.filter((r) => r.category === filters.category);
        }
        if (filters.difficulty && filters.difficulty !== "all") {
          results = results.filter((r) => r.difficulty === filters.difficulty);
        }
        if (filters.isCorrect !== undefined && filters.isCorrect !== "all") {
          const correct = filters.isCorrect === "correct";
          results = results.filter((r) => r.isCorrect === correct);
        }
        if (filters.mastered && filters.mastered !== "all") {
          const mastered = filters.mastered === "yes";
          results = results.filter((r) => !!r.mastered === mastered);
        }
        if (filters.keyword && filters.keyword.trim()) {
          const kw = filters.keyword.trim().toLowerCase();
          results = results.filter(
            (r) =>
              (r.question || "").toLowerCase().includes(kw) ||
              (r.solution || "").toLowerCase().includes(kw) ||
              (r.rawMarkdown || "").toLowerCase().includes(kw) ||
              ((r.knowledgePoints || []).some((k) => (k || "").toLowerCase().includes(kw)))
          );
        }
        if (filters.dateStart) {
          const start = new Date(filters.dateStart).getTime();
          results = results.filter((r) => new Date(r.createdAt).getTime() >= start);
        }
        if (filters.dateEnd) {
          const end = new Date(filters.dateEnd + "T23:59:59").getTime();
          results = results.filter((r) => new Date(r.createdAt).getTime() <= end);
        }

        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getStats() {
    const all = await this.getAll();
    const total = all.length;
    const correct = all.filter((r) => r.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const byCategory = {};
    const byCategoryCorrect = {};
    const byDifficulty = {};
    const CATEGORIES = ["政治理论","常识判断","言语理解","数量关系","判断推理","资料分析"];

    for (const cat of CATEGORIES) {
      byCategory[cat] = 0;
      byCategoryCorrect[cat] = 0;
    }
    byDifficulty["简单"] = 0;
    byDifficulty["中等"] = 0;
    byDifficulty["困难"] = 0;

    for (const r of all) {
      if (byCategory.hasOwnProperty(r.category)) {
        byCategory[r.category]++;
        if (r.isCorrect) byCategoryCorrect[r.category]++;
      }
      if (byDifficulty.hasOwnProperty(r.difficulty)) {
        byDifficulty[r.difficulty]++;
      }
    }

    let weakest = "-";
    let lowestRate = 100;
    for (const cat of CATEGORIES) {
      if (byCategory[cat] >= 3) { // 最小样本 3 题，避免单题错误当选"薄弱模块"
        const rate = byCategoryCorrect[cat] / byCategory[cat];
        if (rate < lowestRate) {
          lowestRate = rate;
          weakest = cat;
        }
      }
    }

    const now = Date.now();
    const recent7 = all.filter((r) => new Date(r.createdAt).getTime() > now - 7 * 86400000);
    const prev7 = all.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return t <= now - 7 * 86400000 && t > now - 14 * 86400000;
    });
    const recentRate = recent7.length > 0
      ? Math.round((recent7.filter((r) => r.isCorrect).length / recent7.length) * 100)
      : 0;
    const prevRate = prev7.length > 0
      ? Math.round((prev7.filter((r) => r.isCorrect).length / prev7.length) * 100)
      : 0;

    let trend = "-";
    if (recent7.length > 0 && prev7.length > 0) {
      const diff = recentRate - prevRate;
      trend = diff >= 0 ? `↑${diff}%` : `↓${Math.abs(diff)}%`;
    } else if (recent7.length > 0) {
      trend = `${recentRate}%`;
    }

    // 近期趋势：按本地日期统计（修 UTC 时区偏移：本地 0-8 点不再计入前一天）
    const dailyData = [];
    const pad = (n) => String(n).padStart(2, "0");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const y = d.getFullYear(), mo = d.getMonth(), da = d.getDate();
      const dateStr = y + "-" + pad(mo + 1) + "-" + pad(da);
      const dayItems = all.filter((r) => {
        const t = new Date(r.createdAt);
        return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === da;
      });
      dailyData.push({
        date: dateStr.slice(5),
        total: dayItems.length,
        correct: dayItems.filter((r) => r.isCorrect).length,
      });
    }

    const knowledgeMap = {};
    for (const r of all) {
      if (r.knowledgePoints && Array.isArray(r.knowledgePoints)) {
        for (const kp of r.knowledgePoints) {
          if (!knowledgeMap[kp]) knowledgeMap[kp] = { total: 0, wrong: 0 };
          knowledgeMap[kp].total++;
          if (!r.isCorrect) knowledgeMap[kp].wrong++;
        }
      }
    }
    const weaknesses = Object.entries(knowledgeMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        wrongRate: Math.round((data.wrong / data.total) * 100),
      }))
      .filter((w) => w.total >= 2)
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 8);

    return {
      total,
      accuracy,
      weakest,
      trend,
      byCategory,
      byCategoryCorrect,
      byDifficulty,
      dailyData,
      weaknesses,
    };
  }

  // ===== 思考过程评分记录 =====
  async saveScore(score) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(SCORE_STORE, "readwrite");
      const store = tx.objectStore(SCORE_STORE);
      const request = store.add({
        total: score.total,
        grade: score.grade,
        basis: score.scores ? score.scores.basis : 0,
        precision: score.scores ? score.scores.precision : 0,
        correctness: score.scores ? score.scores.correctness : 0,
        logic: score.scores ? score.scores.logic : 0,
        knowledge: score.scores ? score.scores.knowledge : 0,
        montai: !!score.montai,
        createdAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getScores() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(SCORE_STORE, "readonly");
      const store = tx.objectStore(SCORE_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = request.result || [];
        rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        resolve(rows);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

const storage = new Storage();

