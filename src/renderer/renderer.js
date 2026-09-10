const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const authStatus = document.getElementById('auth-status');
const btnTray = document.getElementById('btn-tray');
const btnClose = document.getElementById('btn-close');
const monthLabel = document.getElementById('month-label');
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const daysGrid = document.getElementById('days-grid');
const tasksList = document.getElementById('tasks-list');
const newTaskInput = document.getElementById('new-task-input');
const btnAddEvent = document.getElementById('btn-add-event');

let currentMonth = new Date();
currentMonth.setDate(1);
currentMonth.setHours(0, 0, 0, 0);

let completedExpanded = false;
let cachedTasks = [];

function setAuthUI(loggedIn) {
  btnLogin.classList.toggle('hidden', loggedIn);
  btnLogout.classList.toggle('hidden', !loggedIn);
  authStatus.textContent = loggedIn ? '연결됨' : '연결 안 됨';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateKeyFromEvent(event) {
  if (event.start?.date) return event.start.date;
  if (event.start?.dateTime) return formatDateKey(new Date(event.start.dateTime));
  return null;
}

function formatEventLabel(event) {
  const title = event.summary || '(제목 없음)';
  if (event.start?.dateTime) {
    const time = new Date(event.start.dateTime).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${time} ${title}`;
  }
  return title;
}

function renderMonthGrid(monthDate, events) {
  monthLabel.textContent = `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`;

  const eventsByDay = {};
  for (const event of events) {
    const key = dateKeyFromEvent(event);
    if (!key) continue;
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(event);
  }

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const todayKey = formatDateKey(new Date());
  const maxShown = 3;

  daysGrid.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(year, month, i - firstWeekday + 1);
    const key = formatDateKey(cellDate);
    const isCurrentMonth = cellDate.getMonth() === month;

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (!isCurrentMonth) cell.classList.add('other-month');
    if (key === todayKey) cell.classList.add('today');

    const numberEl = document.createElement('span');
    numberEl.className = 'day-number';
    numberEl.textContent = cellDate.getDate();
    cell.appendChild(numberEl);

    const dayEvents = eventsByDay[key] || [];
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'day-events';
    for (const event of dayEvents.slice(0, maxShown)) {
      const evEl = document.createElement('div');
      evEl.className = 'day-event';
      evEl.textContent = formatEventLabel(event);
      evEl.title = event.summary || '(제목 없음)';
      eventsContainer.appendChild(evEl);
    }
    if (dayEvents.length > maxShown) {
      const more = document.createElement('div');
      more.className = 'day-event-more';
      more.textContent = `+${dayEvents.length - maxShown}`;
      eventsContainer.appendChild(more);
    }
    cell.appendChild(eventsContainer);
    daysGrid.appendChild(cell);
  }
}

function createTaskItem(task) {
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

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'task-delete-btn';
  deleteBtn.title = '삭제';
  deleteBtn.textContent = '🗑';
  deleteBtn.addEventListener('click', async () => {
    if (deleteBtn.classList.contains('confirm')) {
      clearTimeout(deleteBtn._resetTimer);
      try {
        await window.hermannAPI.deleteTask(task.taskListId, task.id);
        cachedTasks = cachedTasks.filter((t) => t.id !== task.id);
        renderTasks(cachedTasks);
      } catch (err) {
        loadTasks();
      }
      return;
    }
    deleteBtn.classList.add('confirm');
    deleteBtn.textContent = '확인?';
    deleteBtn._resetTimer = setTimeout(() => {
      deleteBtn.classList.remove('confirm');
      deleteBtn.textContent = '🗑';
    }, 3000);
  });

  item.appendChild(checkbox);
  item.appendChild(title);
  item.appendChild(deleteBtn);
  return item;
}

function renderTasks(tasks) {
  tasksList.innerHTML = '';

  const activeTasks = tasks.filter((task) => task.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.status === 'completed');

  if (!activeTasks.length && !completedTasks.length) {
    tasksList.innerHTML = '<p class="empty-message">할일이 없습니다.</p>';
    return;
  }

  if (!activeTasks.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = '할일이 없습니다.';
    tasksList.appendChild(empty);
  } else {
    for (const task of activeTasks) {
      tasksList.appendChild(createTaskItem(task));
    }
  }

  if (completedTasks.length) {
    const section = document.createElement('div');
    section.className = 'completed-section';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'completed-toggle';
    header.innerHTML = `<span class="completed-arrow">${completedExpanded ? '▾' : '▸'}</span> 완료됨 (${completedTasks.length})`;
    header.addEventListener('click', () => {
      completedExpanded = !completedExpanded;
      renderTasks(tasks);
    });
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'completed-list' + (completedExpanded ? '' : ' collapsed');
    for (const task of completedTasks) {
      list.appendChild(createTaskItem(task));
    }
    section.appendChild(list);

    tasksList.appendChild(section);
  }
}

async function loadEvents() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const timeMin = new Date(year, month, 1);
  const timeMax = new Date(year, month + 1, 1);
  try {
    const events = await window.hermannAPI.getEvents(timeMin.toISOString(), timeMax.toISOString());
    renderMonthGrid(currentMonth, events);
  } catch (err) {
    daysGrid.innerHTML = `<p class="empty-message">일정을 불러오지 못했습니다: ${escapeHtml(err.message)}</p>`;
  }
}

let tasksRequestId = 0;

async function loadTasks() {
  const requestId = ++tasksRequestId;
  try {
    const tasks = await window.hermannAPI.getTasks();
    if (requestId !== tasksRequestId) return; // a newer loadTasks() call superseded this one
    cachedTasks = tasks;
    renderTasks(cachedTasks);
  } catch (err) {
    if (requestId !== tasksRequestId) return;
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
  renderMonthGrid(currentMonth, []);
  cachedTasks = [];
  renderTasks(cachedTasks);
});

btnTray.addEventListener('click', () => window.hermannAPI.minimizeToTray());
btnClose.addEventListener('click', () => window.hermannAPI.closeWidget());

btnPrevMonth.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  loadEvents();
});

btnNextMonth.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  loadEvents();
});

btnAddEvent.addEventListener('click', () => window.hermannAPI.openNewEvent());

newTaskInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const title = newTaskInput.value.trim();
  if (!title) return;
  newTaskInput.value = '';
  newTaskInput.disabled = true;
  try {
    const newTask = await window.hermannAPI.createTask(title);
    cachedTasks = [...cachedTasks, newTask];
    renderTasks(cachedTasks);
  } catch (err) {
    tasksList.innerHTML = `<p class="empty-message">할일 추가 실패: ${escapeHtml(err.message)}</p>`;
  } finally {
    newTaskInput.disabled = false;
    newTaskInput.focus();
  }
});

(async function init() {
  renderMonthGrid(currentMonth, []);
  const { loggedIn } = await window.hermannAPI.getAuthStatus();
  setAuthUI(loggedIn);
  if (loggedIn) {
    await refreshAll();
  }
})();
