const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const windowStateKeeper = require('electron-window-state');
const { getAuthorizedClient, isLoggedIn, logout } = require('../auth/googleAuth');
const { listEvents } = require('../auth/calendarService');
const { listTasks, setTaskCompletion } = require('../auth/tasksService');

let mainWindow = null;
let tray = null;
let authClient = null;

function createWindow() {
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
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray.png'));
  tray = new Tray(trayIcon);
  tray.setToolTip('Hermann Planner');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => showMainWindow(),
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

  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

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

ipcMain.on('widget:close', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.on('widget:minimizeToTray', () => {
  mainWindow.hide();
});

app.whenReady().then(() => {
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
