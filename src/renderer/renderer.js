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
const content = document.getElementById('content');
const paneCalendar = document.getElementById('pane-calendar');
const paneResizer = document.getElementById('pane-resizer');
const eventEditModal = document.getElementById('event-edit-modal');
const eventEditCalendarSelect = document.getElementById('event-edit-calendar');
const eventEditTitleInput = document.getElementById('event-edit-title');
const eventEditAllDayCheckbox = document.getElementById('event-edit-allday');
const eventEditDateInput = document.getElementById('event-edit-date');
const eventEditTimeRow = document.getElementById('event-edit-time-row');
const eventEditStartTimeInput = document.getElementById('event-edit-start-time');
const eventEditEndTimeInput = document.getElementById('event-edit-end-time');
const eventEditSaveBtn = document.getElementById('event-edit-save');
const eventEditCancelBtn = document.getElementById('event-edit-cancel');
const eventCreateModal = document.getElementById('event-create-modal');
const eventCreateCalendarSelect = document.getElementById('event-create-calendar');
const eventCreateTitleInput = document.getElementById('event-create-title');
const eventCreateAllDayCheckbox = document.getElementById('event-create-allday');
const eventCreateDateInput = document.getElementById('event-create-date');
const eventCreateTimeRow = document.getElementById('event-create-time-row');
const eventCreateStartTimeInput = document.getElementById('event-create-start-time');
const eventCreateEndTimeInput = document.getElementById('event-create-end-time');
const eventCreateSaveBtn = document.getElementById('event-create-save');
const eventCreateCancelBtn = document.getElementById('event-create-cancel');

const MIN_PANE_WIDTH = 200;
const DEFAULT_SPLIT_RATIO = 0.6;

let currentMonth = new Date();
currentMonth.setDate(1);
currentMonth.setHours(0, 0, 0, 0);

let completedExpanded = false;
let cachedTasks = [];
let cachedCalendars = [];

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function applySplitRatio(ratio) {
  paneCalendar.style.flexBasis = `${ratio * 100}%`;
}

function initResizer() {
  let dragging = false;

  paneResizer.addEventListener('mousedown', (e) => {
    dragging = true;
    paneResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = content.getBoundingClientRect();
    const usableWidth = rect.width - paneResizer.offsetWidth;
    let calendarWidth = e.clientX - rect.left;
    calendarWidth = Math.max(MIN_PANE_WIDTH, Math.min(calendarWidth, usableWidth - MIN_PANE_WIDTH));
    applySplitRatio(calendarWidth / usableWidth);
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    paneResizer.classList.remove('dragging');
    document.body.style.cursor = '';
    const rect = content.getBoundingClientRect();
    const usableWidth = rect.width - paneResizer.offsetWidth;
    const ratio = paneCalendar.getBoundingClientRect().width / usableWidth;
    window.hermannAPI.setSplitRatio(ratio);
  });
}

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

function formatTimeKey(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
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

let editingEvent = null;
let editingEventSpanDays = 1;

async function loadCalendars() {
  try {
    cachedCalendars = await window.hermannAPI.listCalendars();
  } catch (err) {
    cachedCalendars = [];
  }
}

function populateCalendarSelect(selectEl, selectedId) {
  selectEl.innerHTML = '';
  for (const cal of cachedCalendars) {
    const opt = document.createElement('option');
    opt.value = cal.id;
    opt.textContent = cal.primary ? `${cal.summary} (기본)` : cal.summary;
    selectEl.appendChild(opt);
  }
  if (selectedId && cachedCalendars.some((cal) => cal.id === selectedId)) {
    selectEl.value = selectedId;
  } else if (cachedCalendars.length) {
    selectEl.value = cachedCalendars[0].id;
  }
}

// Builds fresh start/end objects from the modal's current form state, so a
// single code path handles date changes, time changes, and toggling the
// all-day checkbox (which switches between the `date` and `dateTime` shapes).
function buildEventDateRange({ dateKey, allDay, startTime, endTime, spanDays }) {
  if (allDay) {
    const days = spanDays && spanDays > 0 ? spanDays : 1;
    // Explicit nulls clear any leftover dateTime/timeZone from a previously-timed
    // event - Google's patch merges the start/end object instead of replacing it
    // wholesale, so without this an all-day toggle fails with "Invalid start time".
    return {
      start: { date: dateKey, dateTime: null, timeZone: null },
      end: { date: addDaysToDateKey(dateKey, days), dateTime: null, timeZone: null },
    };
  }

  const startStr = `${dateKey}T${startTime || '09:00'}:00`;
  let endDateKey = dateKey;
  let endStr = `${dateKey}T${endTime || '10:00'}:00`;
  if (new Date(endStr) <= new Date(startStr)) {
    endDateKey = addDaysToDateKey(dateKey, 1);
    endStr = `${endDateKey}T${endTime || '10:00'}:00`;
  }

  return {
    start: { dateTime: new Date(startStr).toISOString(), timeZone: TIME_ZONE, date: null },
    end: { dateTime: new Date(endStr).toISOString(), timeZone: TIME_ZONE, date: null },
  };
}

function openEventEditModal(event) {
  editingEvent = event;
  eventEditTitleInput.value = event.summary || '';
  eventEditDateInput.value = dateKeyFromEvent(event) || '';

  const isAllDay = !!event.start?.date;
  eventEditAllDayCheckbox.checked = isAllDay;
  eventEditTimeRow.classList.toggle('hidden', isAllDay);

  editingEventSpanDays = 1;
  if (isAllDay) {
    if (event.start?.date && event.end?.date) {
      const s = new Date(`${event.start.date}T00:00:00`);
      const e = new Date(`${event.end.date}T00:00:00`);
      editingEventSpanDays = Math.max(1, Math.round((e - s) / 86400000));
    }
    eventEditStartTimeInput.value = '09:00';
    eventEditEndTimeInput.value = '10:00';
  } else {
    const s = new Date(event.start.dateTime);
    eventEditStartTimeInput.value = formatTimeKey(s);
    const e = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(s.getTime() + 60 * 60000);
    eventEditEndTimeInput.value = formatTimeKey(e);
  }

  populateCalendarSelect(eventEditCalendarSelect, event.calendarId);

  eventEditModal.classList.remove('hidden');
  eventEditTitleInput.focus();
}

function closeEventEditModal() {
  eventEditModal.classList.add('hidden');
  editingEvent = null;
}

eventEditAllDayCheckbox.addEventListener('change', () => {
  eventEditTimeRow.classList.toggle('hidden', eventEditAllDayCheckbox.checked);
});

eventCreateAllDayCheckbox.addEventListener('change', () => {
  eventCreateTimeRow.classList.toggle('hidden', eventCreateAllDayCheckbox.checked);
});

eventEditCancelBtn.addEventListener('click', closeEventEditModal);

eventEditModal.addEventListener('click', (e) => {
  if (e.target === eventEditModal) closeEventEditModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!eventEditModal.classList.contains('hidden')) closeEventEditModal();
  if (!eventCreateModal.classList.contains('hidden')) closeEventCreateModal();
});

function addDaysToDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

async function openEventCreateModal(defaultDateKey) {
  eventCreateTitleInput.value = '';
  eventCreateDateInput.value = defaultDateKey || formatDateKey(new Date());
  eventCreateAllDayCheckbox.checked = true;
  eventCreateTimeRow.classList.add('hidden');
  eventCreateStartTimeInput.value = '09:00';
  eventCreateEndTimeInput.value = '10:00';

  if (!cachedCalendars.length) await loadCalendars();
  const lastUsedCalendarId = await window.hermannAPI.getLastCalendarId();
  populateCalendarSelect(eventCreateCalendarSelect, lastUsedCalendarId);

  eventCreateModal.classList.remove('hidden');
  eventCreateTitleInput.focus();
}

function closeEventCreateModal() {
  eventCreateModal.classList.add('hidden');
}

eventCreateCancelBtn.addEventListener('click', closeEventCreateModal);

eventCreateModal.addEventListener('click', (e) => {
  if (e.target === eventCreateModal) closeEventCreateModal();
});

eventCreateSaveBtn.addEventListener('click', async () => {
  const title = eventCreateTitleInput.value.trim();
  const dateKey = eventCreateDateInput.value;
  if (!title || !dateKey) return;

  const calendarId = eventCreateCalendarSelect.value || 'primary';
  const range = buildEventDateRange({
    dateKey,
    allDay: eventCreateAllDayCheckbox.checked,
    startTime: eventCreateStartTimeInput.value,
    endTime: eventCreateEndTimeInput.value,
  });

  const newEvent = {
    calendarId,
    summary: title,
    start: range.start,
    end: range.end,
  };

  eventCreateSaveBtn.disabled = true;
  try {
    await window.hermannAPI.createEvent(newEvent);
    window.hermannAPI.setLastCalendarId(calendarId);
    closeEventCreateModal();
    await loadEvents();
  } catch (err) {
    alert(`일정 추가 실패: ${err.message}`);
  } finally {
    eventCreateSaveBtn.disabled = false;
  }
});

eventEditSaveBtn.addEventListener('click', async () => {
  if (!editingEvent) return;
  const newTitle = eventEditTitleInput.value.trim();
  const newDateKey = eventEditDateInput.value;
  if (!newTitle || !newDateKey) return;

  const newCalendarId = eventEditCalendarSelect.value || editingEvent.calendarId;
  const range = buildEventDateRange({
    dateKey: newDateKey,
    allDay: eventEditAllDayCheckbox.checked,
    startTime: eventEditStartTimeInput.value,
    endTime: eventEditEndTimeInput.value,
    spanDays: editingEventSpanDays,
  });

  const updates = {
    summary: newTitle,
    start: range.start,
    end: range.end,
    calendarId: newCalendarId,
  };

  eventEditSaveBtn.disabled = true;
  try {
    await window.hermannAPI.updateEvent(editingEvent.calendarId, editingEvent.id, updates);
    window.hermannAPI.setLastCalendarId(newCalendarId);
    closeEventEditModal();
    await loadEvents();
  } catch (err) {
    alert(`일정 수정 실패: ${err.message}`);
  } finally {
    eventEditSaveBtn.disabled = false;
  }
});

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
    cell.title = '더블클릭하면 이 날짜로 새 일정을 만듭니다';
    cell.addEventListener('dblclick', () => {
      cell.classList.add('flash');
      setTimeout(() => cell.classList.remove('flash'), 500);
      openEventCreateModal(key);
    });

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
      evEl.title = event.summary || '(제목 없음)';
      evEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openEventEditModal(event);
      });
      evEl.addEventListener('dblclick', (e) => e.stopPropagation());

      const evLabel = document.createElement('span');
      evLabel.className = 'day-event-label';
      evLabel.textContent = formatEventLabel(event);
      evEl.appendChild(evLabel);

      const evDeleteBtn = document.createElement('button');
      evDeleteBtn.type = 'button';
      evDeleteBtn.className = 'day-event-delete-btn';
      evDeleteBtn.title = '삭제';
      evDeleteBtn.textContent = '🗑';
      evDeleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (evDeleteBtn.classList.contains('confirm')) {
          clearTimeout(evDeleteBtn._resetTimer);
          try {
            await window.hermannAPI.deleteEvent(event.calendarId, event.id);
            await loadEvents();
          } catch (err) {
            alert(`일정 삭제 실패: ${err.message}`);
            loadEvents();
          }
          return;
        }
        evDeleteBtn.classList.add('confirm');
        evDeleteBtn.textContent = '확인';
        evDeleteBtn._resetTimer = setTimeout(() => {
          evDeleteBtn.classList.remove('confirm');
          evDeleteBtn.textContent = '🗑';
        }, 3000);
      });
      evDeleteBtn.addEventListener('dblclick', (e) => e.stopPropagation());
      evEl.appendChild(evDeleteBtn);

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

function startTaskTitleEdit(item, titleEl, task) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-title-edit';
  input.value = task.title || '';
  item.replaceChild(input, titleEl);
  input.focus();
  input.select();

  let finished = false;

  function restore() {
    input.removeEventListener('blur', commit);
    if (input.parentNode === item) item.replaceChild(titleEl, input);
  }

  async function commit() {
    if (finished) return;
    finished = true;
    const newTitle = input.value.trim();
    if (!newTitle || newTitle === (task.title || '')) {
      restore();
      return;
    }
    try {
      await window.hermannAPI.updateTask(task.taskListId, task.id, newTitle);
      task.title = newTitle;
      titleEl.textContent = newTitle;
      restore();
    } catch (err) {
      restore();
      loadTasks();
    }
  }

  function cancel() {
    if (finished) return;
    finished = true;
    restore();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });

  input.addEventListener('blur', commit);
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
  title.title = '클릭하여 수정';
  title.addEventListener('click', () => startTaskTitleEdit(item, title, task));

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
  await Promise.all([loadEvents(), loadTasks(), loadCalendars()]);
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
  cachedCalendars = [];
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

btnAddEvent.addEventListener('click', () => openEventCreateModal());

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
  initResizer();
  const savedRatio = await window.hermannAPI.getSplitRatio();
  applySplitRatio(savedRatio ?? DEFAULT_SPLIT_RATIO);

  renderMonthGrid(currentMonth, []);
  const { loggedIn } = await window.hermannAPI.getAuthStatus();
  setAuthUI(loggedIn);
  if (loggedIn) {
    await refreshAll();
  }
})();
