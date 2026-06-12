import { ipcMain, dialog, app, clipboard } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const FILTERS_FILE = path.join(app.getPath('userData'), 'saved-filters.json');
const LOG_EXTENSIONS = ['.log', '.txt', '.json'];

interface SavedFilters {
  [key: string]: unknown;
}

interface LogFileResult {
  path: string;
  name: string;
  content?: string;
  size?: number;
  error?: string;
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

function isLogFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return LOG_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isZipFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.zip');
}

function extractFilesFromZip(zipPath: string): LogFileResult[] {
  const results: LogFileResult[] = [];
  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      if (!isLogFile(entry.name)) continue;

      try {
        const content = entry.getData().toString('utf-8');
        results.push({
          path: `${zipPath}::${entry.entryName}`,
          name: `${path.basename(zipPath)}/${entry.entryName}`,
          content,
          size: entry.header.size,
        });
      } catch (err) {
        results.push({
          path: `${zipPath}::${entry.entryName}`,
          name: `${path.basename(zipPath)}/${entry.entryName}`,
          error: String(err),
        });
      }
    }
  } catch (err) {
    results.push({
      path: zipPath,
      name: path.basename(zipPath),
      error: `解压失败: ${String(err)}`,
    });
  }
  return results;
}

function readSingleFile(filePath: string): LogFileResult[] {
  if (isZipFile(filePath)) {
    return extractFilesFromZip(filePath);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return [
      {
        path: filePath,
        name: path.basename(filePath),
        content,
        size: fs.statSync(filePath).size,
      },
    ];
  } catch (err) {
    return [
      {
        path: filePath,
        name: path.basename(filePath),
        error: String(err),
      },
    ];
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
    const results = readSingleFile(filePath);
    return results.length > 0 ? results[0] : { path: filePath, name: path.basename(filePath), error: '无法读取文件' };
  });

  ipcMain.handle('read-log-files', async (_event, filePaths: string[]) => {
    const allResults: LogFileResult[] = [];
    for (const filePath of filePaths) {
      const results = readSingleFile(filePath);
      allResults.push(...results);
    }
    return allResults;
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
      return { success: false, cancelled: true, error: '用户取消' };
    }

    try {
      fs.writeFileSync(result.filePath, report, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: String(err) };
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
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
