const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getEntries: () => ipcRenderer.invoke('get-entries'),
  saveEntries: (entries) => ipcRenderer.invoke('save-entries', entries),
  openEntry: (entry) => ipcRenderer.invoke('open-entry', entry),
  openAll: () => ipcRenderer.invoke('open-all'),
  tileWindows: () => ipcRenderer.invoke('tile-windows'),
  setAlwaysOnTop: (id, flag) => ipcRenderer.invoke('set-always-on-top', id, flag),
  closeInstance: (id) => ipcRenderer.invoke('close-instance', id),
  exportCookies: (id) => ipcRenderer.invoke('export-cookies', id),
  importCookies: (id, file) => ipcRenderer.invoke('import-cookies', id, file),
  showDialog: (opts) => ipcRenderer.invoke('show-dialog', opts)
});
