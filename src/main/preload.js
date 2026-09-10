const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hermannAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),

  getEvents: (timeMin, timeMax) => ipcRenderer.invoke('calendar:list', timeMin, timeMax),
  getTasks: () => ipcRenderer.invoke('tasks:list'),
  setTaskCompletion: (taskListId, taskId, completed) =>
    ipcRenderer.invoke('tasks:setCompletion', taskListId, taskId, completed),
  createTask: (title) => ipcRenderer.invoke('tasks:create', title),
  deleteTask: (taskListId, taskId) => ipcRenderer.invoke('tasks:delete', taskListId, taskId),

  openNewEvent: (dateStr) => ipcRenderer.send('calendar:openNewEvent', dateStr),

  getSplitRatio: () => ipcRenderer.invoke('layout:getSplitRatio'),
  setSplitRatio: (ratio) => ipcRenderer.send('layout:setSplitRatio', ratio),

  closeWidget: () => ipcRenderer.send('widget:close'),
  minimizeToTray: () => ipcRenderer.send('widget:minimizeToTray'),
});
