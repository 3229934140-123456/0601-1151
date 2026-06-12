import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import '../styles/global.css';

declare global {
  interface Window {
    electronAPI: {
      selectLogFiles: () => Promise<string[]>;
      selectLogDirectory: () => Promise<string | null>;
      readLogFile: (filePath: string) => Promise<{ path: string; name: string; content?: string; size?: number; error?: string }>;
      readLogFiles: (filePaths: string[]) => Promise<Array<{ path: string; name: string; content?: string; size?: number; error?: string }>>;
      exportReport: (report: string, defaultPath: string) => Promise<boolean>;
      saveFilter: (name: string, filter: unknown) => Promise<boolean>;
      loadFilters: () => Promise<Record<string, unknown>>;
      deleteFilter: (name: string) => Promise<boolean>;
      copyToClipboard: (text: string) => Promise<boolean>;
      onFileOpened: (callback: (filePath: string) => void) => void;
    };
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
