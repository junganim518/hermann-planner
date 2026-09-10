const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hermannAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),

  getEvents: (timeMin, timeMax) => ipcRenderer.invoke('calendar:list', timeMin, timeMax),
  getTasks: () => ipcRenderer.invoke('tasks:list'),
  setTaskCompletion: (taskListId, taskId, completed) =>
    ipcRenderer.invoke('tasks:setCompletion', taskListId, taskId, completed),

  closeWidget: () => ipcRenderer.send('widget:close'),
  minimizeToTray: () => ipcRenderer.send('widget:minimizeToTray'),
});
