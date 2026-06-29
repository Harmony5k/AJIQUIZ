/**
 * AjiQuiz – Admin Panel Logic
 */
(function () {
  const Q = AjiQuiz;

  // ── Auth gate ────────────────────────────────────────────────────
  const loginScreen = document.getElementById('login-screen');
  const adminPanel  = document.getElementById('admin-panel');

  function showPanel() {
    loginScreen.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    renderDashboard();
  }

  if (Q.auth.getAdmin()) showPanel();

  document.getElementById('admin-login-btn').addEventListener('click', function () {
    const u = document.getElementById('admin-username').value.trim();
    const p = document.getElementById('admin-password').value;
    const err = document.getElementById('admin-error');
    err.classList.add('hidden');
    const admin = Q.auth.loginAdmin(u, p);
    if (admin) { showPanel(); }
    else { err.classList.remove('hidden'); }
  });

  ['admin-username','admin-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
    });
  });

  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    Q.auth.logoutAdmin();
    loginScreen.classList.remove('hidden');
    adminPanel.classList.add('hidden');
  });

  // ── Tab routing ───────────────────────────────────────────────────
  const tabTitles = { dashboard:'Dashboard', quizzes:'Quizzes', students:'Students', results:'Results' };
  let currentTab = 'dashboard';

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
      this.classList.add('active');
      switchTab(this.dataset.tab);
    });
  });

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.getElementById('tab-title').textContent = tabTitles[tab];
    document.getElementById('tab-actions').innerHTML = '';

    if (tab === 'dashboard') renderDashboard();
    if (tab === 'quizzes')   renderQuizzes();
    if (tab === 'students')  renderStudents();
    if (tab === 'results')   renderResults();
  }

  // ── Dashboard ─────────────────────────────────────────────────────
  function renderDashboard() {
    const allQuizzes  = Q.quizzes.getAll();
    const allStudents = Q.students.getAll();
    const allResults  = Q.results.getAll();

    const stats = [
      { label: 'Total Quizzes', val: allQuizzes.length, icon: '📝' },
      { label: 'Published', val: allQuizzes.filter(q => q.status === 'published').length, icon: '✅' },
      { label: 'Students', val: allStudents.length, icon: '👥' },
      { label: 'Attempts', val: allResults.length, icon: '🏆' },
    ];

    document.getElementById('stat-cards').innerHTML = stats.map(s => `
      <div class="card" style="text-align:center">
        <div style="font-size:2rem;margin-bottom:0.4rem">${s.icon}</div>
        <div style="font-family:var(--font-display);font-size:2rem;font-weight:700;color:var(--volt)">${s.val}</div>
        <div class="text-muted" style="font-size:0.82rem">${s.label}</div>
      </div>
    `).join('');

    const recent = allResults.slice(-8).reverse();
    if (recent.length === 0) {
      document.getElementById('recent-results-list').innerHTML = '<div class="empty-state"><p>No activity yet.</p></div>';
    } else {
      document.getElementById('recent-results-list').innerHTML = `
        <table class="data-table">
          <thead><tr><th>Student</th><th>Quiz</th><th>Score</th><th>Date</th></tr></thead>
          <tbody>${recent.map(r => {
            const quiz = Q.quizzes.getById(r.quizId);
            const student = Q.students.getById(r.studentId);
            const g = Q.scoreGrade(r.percentage);
            return `<tr>
              <td>${student ? student.name : '—'}</td>
              <td>${quiz ? quiz.title : '—'}</td>
              <td><span class="badge ${g.cls}">${r.percentage}%</span></td>
              <td>${Q.formatDate(r.timestamp)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>`;
    }
  }

  // ── Quizzes ───────────────────────────────────────────────────────
  function renderQuizzes() {
    const list = Q.quizzes.getAll();
    const tbody = document.getElementById('quizzes-table-body');
    const empty = document.getElementById('quizzes-empty');

    if (list.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = list.map(q => `
      <tr>
        <td><strong>${q.title}</strong><br><span class="text-muted" style="font-size:0.8rem">${q.subject || ''}</span></td>
        <td>${q.questions.length}</td>
        <td>${q.duration} min</td>
        <td><span class="badge ${q.status === 'published' ? 'badge-green' : 'badge-yellow'}">${q.status}</span></td>
        <td>${Q.formatDate(q.createdAt)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-secondary" style="padding:0.3rem 0.7rem;font-size:0.78rem" onclick="viewQuiz('${q.id}')">View</button>
            <button class="btn btn-ghost" style="padding:0.3rem 0.7rem;font-size:0.78rem" onclick="editQuiz('${q.id}')">Edit</button>
            <button class="btn btn-danger" style="padding:0.3rem 0.7rem;font-size:0.78rem" onclick="deleteQuiz('${q.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  let editingQuizId = null;
  let parsedQuestions = null;

  document.getElementById('new-quiz-btn').addEventListener('click', () => openQuizModal());

  function openQuizModal(quiz = null) {
    editingQuizId = quiz ? quiz.id : null;
    parsedQuestions = quiz ? quiz.questions : null;
    document.getElementById('quiz-modal-title').textContent = quiz ? 'Edit Quiz' : 'New Quiz';
    document.getElementById('qm-title').value = quiz ? quiz.title : '';
    document.getElementById('qm-subject').value = quiz ? (quiz.subject || '') : '';
    document.getElementById('qm-duration').value = quiz ? quiz.duration : 30;
    document.getElementById('qm-status').value = quiz ? quiz.status : 'draft';
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('upload-preview').innerHTML = '';
    if (quiz) {
      document.getElementById('upload-preview').innerHTML = `<div class="badge badge-green">✓ ${quiz.questions.length} questions loaded</div>`;
      document.getElementById('upload-preview').classList.remove('hidden');
    }
    openModal('quiz-modal');
  }

  window.editQuiz = (id) => openQuizModal(Q.quizzes.getById(id));

  window.deleteQuiz = (id) => {
    if (confirm('Delete this quiz? This cannot be undone.')) {
      Q.quizzes.delete(id);
      Q.toast('Quiz deleted.', 'error');
      renderQuizzes();
    }
  };

  window.viewQuiz = (id) => {
    const quiz = Q.quizzes.getById(id);
    if (!quiz) return;
    document.getElementById('vqm-title').textContent = quiz.title;
    document.getElementById('vqm-content').innerHTML = quiz.questions.map((q, i) => `
      <div style="margin-bottom:1.25rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(255,255,255,0.07);">
        <p style="font-weight:600;margin-bottom:0.5rem;font-size:0.9rem"><span class="text-volt">Q${i+1}.</span> ${q.question}</p>
        ${q.options.map(o => `
          <div style="font-size:0.82rem;padding:0.25rem 0;color:${o.key === q.answer ? 'var(--success)' : 'var(--slate-400)'}">
            ${o.key === q.answer ? '✓' : '○'} ${o.key}. ${o.text}
          </div>`).join('')}
      </div>
    `).join('');
    openModal('view-quiz-modal');
  };

  // File upload
  const uploadZone = document.getElementById('upload-zone');
  const fileInput  = document.getElementById('qm-file');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  function handleFile(file) {
    if (!file.name.endsWith('.txt')) { Q.toast('Please upload a .txt file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const questions = Q.parseQuestions(e.target.result);
      parsedQuestions = questions;
      const preview = document.getElementById('upload-preview');
      preview.classList.remove('hidden');
      if (questions.length === 0) {
        preview.innerHTML = '<div class="badge badge-red">⚠ No valid questions found. Check your format.</div>';
      } else {
        preview.innerHTML = `<div class="badge badge-green">✓ ${questions.length} question${questions.length > 1 ? 's' : ''} parsed successfully</div>`;
        Q.toast(`${questions.length} questions loaded!`, 'success');
      }
    };
    reader.readAsText(file);
  }

  document.getElementById('save-quiz-btn').addEventListener('click', () => {
    const title    = document.getElementById('qm-title').value.trim();
    const subject  = document.getElementById('qm-subject').value.trim();
    const duration = parseInt(document.getElementById('qm-duration').value);
    const status   = document.getElementById('qm-status').value;

    if (!title) { Q.toast('Please enter a quiz title.', 'error'); return; }
    if (!parsedQuestions || parsedQuestions.length === 0) { Q.toast('Please upload a valid question file.', 'error'); return; }

    const quiz = {
      id: editingQuizId || Q.uid(),
      title, subject, duration, status,
      questions: parsedQuestions,
      createdAt: editingQuizId ? Q.quizzes.getById(editingQuizId).createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    Q.quizzes.save(quiz);
    closeModal('quiz-modal');
    Q.toast(editingQuizId ? 'Quiz updated!' : 'Quiz created!', 'success');
    renderQuizzes();
  });

  // ── Students ──────────────────────────────────────────────────────
  function renderStudents() {
    const list = Q.students.getAll();
    const allResults = Q.results.getAll();
    document.getElementById('students-table-body').innerHTML = list.map(s => {
      const attempts = allResults.filter(r => r.studentId === s.id).length;
      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.username}</td>
        <td>${s.class || '—'}</td>
        <td>${attempts}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost" style="padding:0.3rem 0.7rem;font-size:0.78rem" onclick="editStudent('${s.id}')">Edit</button>
            <button class="btn btn-danger" style="padding:0.3rem 0.7rem;font-size:0.78rem" onclick="deleteStudent('${s.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  let editingStudentId = null;

  document.getElementById('new-student-btn').addEventListener('click', () => openStudentModal());

  function openStudentModal(student = null) {
    editingStudentId = student ? student.id : null;
    document.getElementById('student-modal-title').textContent = student ? 'Edit Student' : 'Add Student';
    document.getElementById('sm-name').value = student ? student.name : '';
    document.getElementById('sm-username').value = student ? student.username : '';
    document.getElementById('sm-password').value = '';
    document.getElementById('sm-class').value = student ? (student.class || '') : '';
    openModal('student-modal');
  }

  window.editStudent = (id) => openStudentModal(Q.students.getById(id));

  window.deleteStudent = (id) => {
    if (confirm('Delete this student?')) {
      Q.students.delete(id);
      Q.toast('Student deleted.', 'error');
      renderStudents();
    }
  };

  document.getElementById('save-student-btn').addEventListener('click', () => {
    const name     = document.getElementById('sm-name').value.trim();
    const username = document.getElementById('sm-username').value.trim();
    const password = document.getElementById('sm-password').value;
    const cls      = document.getElementById('sm-class').value.trim();

    if (!name || !username) { Q.toast('Name and username are required.', 'error'); return; }

    const existing = editingStudentId ? Q.students.getById(editingStudentId) : {};
    const student = {
      id: editingStudentId || Q.uid(),
      name, username, cls,
      class: cls,
      password: password || existing.password || 'pass123',
    };

    Q.students.save(student);
    closeModal('student-modal');
    Q.toast(editingStudentId ? 'Student updated!' : 'Student added!', 'success');
    renderStudents();
  });

  // ── Results ───────────────────────────────────────────────────────
  function renderResults() {
    const allResults  = Q.results.getAll();
    const empty = document.getElementById('results-empty');
    const tbody = document.getElementById('results-table-body');

    if (allResults.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = allResults.slice().reverse().map(r => {
      const quiz    = Q.quizzes.getById(r.quizId);
      const student = Q.students.getById(r.studentId);
      const g = Q.scoreGrade(r.percentage);
      return `<tr>
        <td>${student ? student.name : '—'}<br><span class="text-muted" style="font-size:0.78rem">${student ? student.class || '' : ''}</span></td>
        <td>${quiz ? quiz.title : '—'}</td>
        <td>${r.score} / ${r.total} (${r.percentage}%)</td>
        <td><span class="badge ${g.cls}">${g.label}</span></td>
        <td>${Q.formatDate(r.timestamp)}</td>
      </tr>`;
    }).join('');
  }

  // ── Modal helpers ─────────────────────────────────────────────────
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModal(this.id);
    });
  });

})();
