const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const authStatus = document.getElementById('auth-status');
const btnTray = document.getElementById('btn-tray');
const btnClose = document.getElementById('btn-close');
const calendarList = document.getElementById('calendar-list');
const tasksList = document.getElementById('tasks-list');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function setAuthUI(loggedIn) {
  btnLogin.classList.toggle('hidden', loggedIn);
  btnLogout.classList.toggle('hidden', !loggedIn);
  authStatus.textContent = loggedIn ? '연결됨' : '연결 안 됨';
}

function formatEventTime(event) {
  if (event.start?.date && !event.start?.dateTime) return '종일';
  const date = new Date(event.start.dateTime);
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderEvents(events) {
  calendarList.innerHTML = '';
  if (!events.length) {
    calendarList.innerHTML = '<p class="empty-message">표시할 일정이 없습니다.</p>';
    return;
  }
  for (const event of events) {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <span class="event-dot"></span>
      <span class="event-time">${formatEventTime(event)}</span>
      <span class="event-title">${escapeHtml(event.summary || '(제목 없음)')}</span>
    `;
    calendarList.appendChild(item);
  }
}

function renderTasks(tasks) {
  tasksList.innerHTML = '';
  if (!tasks.length) {
    tasksList.innerHTML = '<p class="empty-message">할일이 없습니다.</p>';
    return;
  }
  for (const task of tasks) {
    const completed = task.status === 'completed';
    const item = document.createElement('div');
    item.className = 'task-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = completed;
    checkbox.addEventListener('change', async () => {
      await window.hermannAPI.setTaskCompletion(task.taskListId, task.id, checkbox.checked);
      loadTasks();
    });

    const title = document.createElement('span');
    title.className = 'task-title' + (completed ? ' completed' : '');
    title.textContent = task.title || '(제목 없음)';

    item.appendChild(checkbox);
    item.appendChild(title);
    tasksList.appendChild(item);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadEvents() {
  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 14);
  try {
    const events = await window.hermannAPI.getEvents(timeMin.toISOString(), timeMax.toISOString());
    renderEvents(events);
  } catch (err) {
    calendarList.innerHTML = `<p class="empty-message">일정을 불러오지 못했습니다: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadTasks() {
  try {
    const tasks = await window.hermannAPI.getTasks();
    renderTasks(tasks);
  } catch (err) {
    tasksList.innerHTML = `<p class="empty-message">할일을 불러오지 못했습니다: ${escapeHtml(err.message)}</p>`;
  }
}

async function refreshAll() {
  await Promise.all([loadEvents(), loadTasks()]);
}

btnLogin.addEventListener('click', async () => {
  authStatus.textContent = '로그인 진행 중...';
  try {
    await window.hermannAPI.login();
    setAuthUI(true);
    await refreshAll();
  } catch (err) {
    authStatus.textContent = `로그인 실패: ${err.message}`;
  }
});

btnLogout.addEventListener('click', async () => {
  await window.hermannAPI.logout();
  setAuthUI(false);
  renderEvents([]);
  renderTasks([]);
});

btnTray.addEventListener('click', () => window.hermannAPI.minimizeToTray());
btnClose.addEventListener('click', () => window.hermannAPI.closeWidget());

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

(async function init() {
  const { loggedIn } = await window.hermannAPI.getAuthStatus();
  setAuthUI(loggedIn);
  if (loggedIn) {
    await refreshAll();
  }
})();
