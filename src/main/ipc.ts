import { ipcMain, dialog, app, clipboard } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const FILTERS_FILE = path.join(app.getPath('userData'), 'saved-filters.json');

interface SavedFilters {
  [key: string]: unknown;
}

function readFiltersFile(): SavedFilters {
  try {
    if (fs.existsSync(FILTERS_FILE)) {
      return JSON.parse(fs.readFileSync(FILTERS_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function writeFiltersFile(filters: SavedFilters): void {
  try {
    fs.mkdirSync(path.dirname(FILTERS_FILE), { recursive: true });
    fs.writeFileSync(FILTERS_FILE, JSON.stringify(filters, null, 2));
  } catch (err) {
    console.error('Failed to save filters:', err);
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('select-log-files', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择日志文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '日志文件', extensions: ['log', 'txt', 'json', 'zip'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('select-log-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择日志目录',
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('read-log-file', async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        path: filePath,
        name: path.basename(filePath),
        content,
        size: fs.statSync(filePath).size,
      };
    } catch (err) {
      return {
        path: filePath,
        name: path.basename(filePath),
        error: String(err),
      };
    }
  });

  ipcMain.handle('read-log-files', async (_event, filePaths: string[]) => {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        results.push({
          path: filePath,
          name: path.basename(filePath),
          content,
          size: fs.statSync(filePath).size,
        });
      } catch (err) {
        results.push({
          path: filePath,
          name: path.basename(filePath),
          error: String(err),
        });
      }
    }
    return results;
  });

  ipcMain.handle('export-report', async (_event, report: string, defaultPath: string) => {
    const result = await dialog.showSaveDialog({
      title: '导出研发报告',
      defaultPath: defaultPath || 'game-log-report.txt',
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    try {
      fs.writeFileSync(result.filePath, report, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('save-filter', async (_event, name: string, filter: unknown) => {
    const filters = readFiltersFile();
    filters[name] = filter;
    writeFiltersFile(filters);
    return true;
  });

  ipcMain.handle('load-filters', async () => {
    return readFiltersFile();
  });

  ipcMain.handle('delete-filter', async (_event, name: string) => {
    const filters = readFiltersFile();
    delete filters[name];
    writeFiltersFile(filters);
    return true;
  });

  ipcMain.handle('copy-to-clipboard', async (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });
}
