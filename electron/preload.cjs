const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  alarmTriggered: () => ipcRenderer.send('alarm-triggered'),
});
