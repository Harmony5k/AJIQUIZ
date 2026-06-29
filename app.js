/**
 * AjiQuiz – Core App Module
 * Uses localStorage for persistence (no backend required)
 */

const AjiQuiz = (function () {

  // ── Storage helpers ──────────────────────────────────────────────
  const store = {
    get: (key, fallback = null) => {
      try { const v = localStorage.getItem('ajiquiz_' + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set: (key, val) => localStorage.setItem('ajiquiz_' + key, JSON.stringify(val)),
    del: (key) => localStorage.removeItem('ajiquiz_' + key),
  };

  // ── Seed default data if first run ──────────────────────────────
  function seedDefaults() {
    if (!store.get('seeded')) {
      store.set('admins', [{ username: 'admin', password: 'admin123', name: 'Administrator' }]);
      store.set('students', [
        { id: 's001', username: 'student1', password: 'pass123', name: 'Amaka Okafor', class: 'JSS3' },
        { id: 's002', username: 'student2', password: 'pass123', name: 'Chidi Nwosu', class: 'SS1' },
      ]);
      store.set('quizzes', []);
      store.set('results', []);
      store.set('seeded', true);
    }
  }

  // ── Auth ─────────────────────────────────────────────────────────
  const auth = {
    loginAdmin(username, password) {
      const admins = store.get('admins', []);
      const found = admins.find(a => a.username === username && a.password === password);
      if (found) { store.set('current_admin', found); return found; }
      return null;
    },
    loginStudent(username, password) {
      const students = store.get('students', []);
      const found = students.find(s => s.username === username && s.password === password);
      if (found) { store.set('current_student', found); return found; }
      return null;
    },
    getAdmin: () => store.get('current_admin'),
    getStudent: () => store.get('current_student'),
    logoutAdmin: () => store.del('current_admin'),
    logoutStudent: () => store.del('current_student'),
    requireAdmin() { if (!auth.getAdmin()) { window.location.href = 'login.html'; return false; } return true; },
    requireStudent() { if (!auth.getStudent()) { window.location.href = 'login.html'; return false; } return true; },
  };

  // ── Question Parser ───────────────────────────────────────────────
  /**
   * Parses .txt question file in this format:
   *
   * Q: What is 2 + 2?
   * A. 3
   * B. 4
   * C. 5
   * D. 6
   * ANS: B
   *
   * Blank lines separate questions.
   * Lines starting with // are ignored.
   */
  function parseQuestions(text) {
    const questions = [];
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
      if (!lines.length) continue;

      const qLine = lines.find(l => /^Q:/i.test(l));
      const ansLine = lines.find(l => /^ANS:/i.test(l));
      const optLines = lines.filter(l => /^[A-Ea-e][.)]\s/.test(l));

      if (!qLine || !ansLine || optLines.length < 2) continue;

      const questionText = qLine.replace(/^Q:\s*/i, '').trim();
      const answerKey = ansLine.replace(/^ANS:\s*/i, '').trim().toUpperCase();
      const options = optLines.map(l => ({
        key: l[0].toUpperCase(),
        text: l.replace(/^[A-Ea-e][.)]\s*/, '').trim(),
      }));

      questions.push({ id: uid(), question: questionText, options, answer: answerKey });
    }

    return questions;
  }

  // ── Quizzes CRUD ─────────────────────────────────────────────────
  const quizzes = {
    getAll: () => store.get('quizzes', []),
    getById: (id) => store.get('quizzes', []).find(q => q.id === id) || null,
    save(quiz) {
      const list = store.get('quizzes', []);
      const idx = list.findIndex(q => q.id === quiz.id);
      if (idx >= 0) list[idx] = quiz; else list.push(quiz);
      store.set('quizzes', list);
    },
    delete(id) {
      const list = store.get('quizzes', []).filter(q => q.id !== id);
      store.set('quizzes', list);
    },
    getPublished: () => store.get('quizzes', []).filter(q => q.status === 'published'),
  };

  // ── Students CRUD ─────────────────────────────────────────────────
  const students = {
    getAll: () => store.get('students', []),
    getById: (id) => store.get('students', []).find(s => s.id === id) || null,
    save(student) {
      const list = store.get('students', []);
      const idx = list.findIndex(s => s.id === student.id);
      if (idx >= 0) list[idx] = student; else list.push(student);
      store.set('students', list);
    },
    delete(id) {
      const list = store.get('students', []).filter(s => s.id !== id);
      store.set('students', list);
    },
  };

  // ── Results ───────────────────────────────────────────────────────
  const results = {
    getAll: () => store.get('results', []),
    getByStudent: (studentId) => store.get('results', []).filter(r => r.studentId === studentId),
    getByQuiz: (quizId) => store.get('results', []).filter(r => r.quizId === quizId),
    hasAttempted: (studentId, quizId) =>
      store.get('results', []).some(r => r.studentId === studentId && r.quizId === quizId),
    save(result) {
      const list = store.get('results', []);
      list.push(result);
      store.set('results', list);
    },
  };

  // ── Utilities ─────────────────────────────────────────────────────
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function scoreGrade(pct) {
    if (pct >= 75) return { label: 'Excellent', cls: 'badge-green' };
    if (pct >= 60) return { label: 'Good', cls: 'badge-blue' };
    if (pct >= 50) return { label: 'Average', cls: 'badge-yellow' };
    return { label: 'Below Average', cls: 'badge-red' };
  }

  // ── Toast notifications ────────────────────────────────────────────
  function toast(msg, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ── Init ──────────────────────────────────────────────────────────
  seedDefaults();

  return { store, auth, quizzes, students, results, parseQuestions, uid, formatDate, formatTime, scoreGrade, toast };
})();

window.AjiQuiz = AjiQuiz;
