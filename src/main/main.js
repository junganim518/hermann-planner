const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const windowStateKeeper = require('electron-window-state');
const Store = require('electron-store');
const { getAuthorizedClient, isLoggedIn, logout } = require('../auth/googleAuth');
const { listEvents, updateEvent, createEvent, deleteEvent, listWritableCalendars } = require('../auth/calendarService');
const { listTasks, setTaskCompletion, createTask, deleteTask, updateTask } = require('../auth/tasksService');

app.setAppUserModelId('com.hermann.planner');

const store = new Store();

let mainWindow = null;
let tray = null;
let authClient = null;

function isAutoStartEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled });
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function ensureDefaultAutoStart() {
  if (!store.get('autoStartConfigured')) {
    app.setLoginItemSettings({ openAtLogin: true });
    store.set('autoStartConfigured', true);
  }
}

function createWindow() {
  if (mainWindow) return;

  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 500,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 640,
    minHeight: 400,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    skipTaskbar: false,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindowState.manage(mainWindow);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  app.focus({ steal: true });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: '시작 시 자동 실행',
      type: 'checkbox',
      checked: isAutoStartEnabled(),
      click: (menuItem) => setAutoStart(menuItem.checked),
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  if (tray) return;

  const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray.png'));
  tray = new Tray(trayIcon);
  tray.setToolTip('Hermann Planner');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showMainWindow());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  ipcMain.handle('auth:login', async () => {
    authClient = await getAuthorizedClient();
    return { loggedIn: true };
  });

  ipcMain.handle('auth:logout', async () => {
    logout();
    authClient = null;
    return { loggedIn: false };
  });

  ipcMain.handle('auth:status', async () => {
    return { loggedIn: isLoggedIn() };
  });

  ipcMain.handle('calendar:list', async (event, timeMin, timeMax) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return listEvents(authClient, timeMin, timeMax);
  });

  ipcMain.handle('tasks:list', async () => {
    if (!authClient) authClient = await getAuthorizedClient();
    return listTasks(authClient);
  });

  ipcMain.handle('tasks:setCompletion', async (event, taskListId, taskId, completed) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return setTaskCompletion(authClient, taskListId, taskId, completed);
  });

  ipcMain.handle('tasks:create', async (event, title) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return createTask(authClient, title);
  });

  ipcMain.handle('tasks:delete', async (event, taskListId, taskId) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return deleteTask(authClient, taskListId, taskId);
  });

  ipcMain.handle('tasks:update', async (event, taskListId, taskId, title) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return updateTask(authClient, taskListId, taskId, title);
  });

  ipcMain.handle('calendar:update', async (event, calendarId, eventId, updates) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return updateEvent(authClient, calendarId, eventId, updates);
  });

  ipcMain.handle('calendar:create', async (event, eventData) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return createEvent(authClient, eventData);
  });

  ipcMain.handle('calendar:delete', async (event, calendarId, eventId) => {
    if (!authClient) authClient = await getAuthorizedClient();
    return deleteEvent(authClient, calendarId, eventId);
  });

  ipcMain.handle('calendar:listCalendars', async () => {
    if (!authClient) authClient = await getAuthorizedClient();
    return listWritableCalendars(authClient);
  });

  ipcMain.handle('settings:getLastCalendarId', () => {
    return store.get('lastCalendarId', null);
  });

  ipcMain.on('settings:setLastCalendarId', (event, calendarId) => {
    store.set('lastCalendarId', calendarId);
  });

  ipcMain.handle('layout:getSplitRatio', () => {
    return store.get('splitRatio', 0.6);
  });

  ipcMain.on('layout:setSplitRatio', (event, ratio) => {
    store.set('splitRatio', ratio);
  });

  ipcMain.on('widget:close', () => {
    app.isQuitting = true;
    app.quit();
  });

  ipcMain.on('widget:minimizeToTray', () => {
    mainWindow.hide();
  });

  app.whenReady().then(() => {
    ensureDefaultAutoStart();
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // Keep the app alive in the tray on Windows/Linux instead of quitting.
    if (process.platform !== 'darwin' && app.isQuitting) app.quit();
  });
}
