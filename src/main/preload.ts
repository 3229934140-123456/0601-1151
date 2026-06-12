import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectLogFiles: () => ipcRenderer.invoke('select-log-files'),
  selectLogDirectory: () => ipcRenderer.invoke('select-log-directory'),
  readLogFile: (filePath: string) => ipcRenderer.invoke('read-log-file', filePath),
  readLogFiles: (filePaths: string[]) => ipcRenderer.invoke('read-log-files', filePaths),
  exportReport: (report: string, defaultPath: string) =>
    ipcRenderer.invoke('export-report', report, defaultPath),
  saveFilter: (name: string, filter: unknown) => ipcRenderer.invoke('save-filter', name, filter),
  loadFilters: () => ipcRenderer.invoke('load-filters'),
  deleteFilter: (name: string) => ipcRenderer.invoke('delete-filter', name),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  onFileOpened: (callback: (filePath: string) => void) => {
    ipcRenderer.on('file-opened', (_event, filePath) => callback(filePath));
  },
});
