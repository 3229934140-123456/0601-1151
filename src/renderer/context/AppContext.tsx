import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type { AppState, AppAction } from '@shared/store';
import { initialState, appReducer } from '@shared/store';
import { parseLogFilesWithDetail, extractUniquePlayerIds } from '@shared/logParser';
import type { LogFile, SearchFilter, OperationNotification } from '@shared/types';
import { SAMPLE_LOG_FILE } from '@shared/sampleData';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  loadLogFiles: (filePaths: string[]) => Promise<void>;
  loadSampleData: () => Promise<void>;
  applyFilter: (filter: SearchFilter) => void;
  addNotification: (type: OperationNotification['type'], status: OperationNotification['status'], message: string, detail?: string) => void;
  dismissNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const selectedPlayerIdRef = useRef(state.selectedPlayerId);

  useEffect(() => {
    selectedPlayerIdRef.current = state.selectedPlayerId;
  }, [state.selectedPlayerId]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.loadFilters().then((filters) => {
        dispatch({ type: 'SET_SAVED_FILTERS', payload: filters as Record<string, SearchFilter> });
      });

      window.electronAPI.onFileOpened((filePath) => {
        loadLogFiles([filePath]);
      });
    }
  }, []);

  const addNotification = useCallback(
    (type: OperationNotification['type'], status: OperationNotification['status'], message: string, detail?: string) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { type, status, message, detail } });
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_NOTIFICATION', payload: id });
  }, []);

  const processLogFiles = useCallback(async (files: LogFile[]) => {
    dispatch({
      type: 'SET_LOADING',
      payload: { isLoading: true, progress: 0, message: '正在读取日志文件...' },
    });

    try {
      dispatch({ type: 'ADD_LOG_FILES', payload: files });

      dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: true, progress: 50, message: '正在解析日志内容...' },
      });

      const { events, summary } = parseLogFilesWithDetail(files);
      dispatch({ type: 'SET_IMPORT_SUMMARY', payload: summary });
      dispatch({ type: 'SET_ALL_EVENTS', payload: events });

      const playerIds = extractUniquePlayerIds(events);
      if (playerIds.length > 0 && !selectedPlayerIdRef.current) {
        dispatch({ type: 'SET_SELECTED_PLAYER', payload: playerIds[0] });
      }

      dispatch({
        type: 'SET_LOADING',
        payload: { isLoading: true, progress: 100, message: '解析完成！' },
      });

      const status =
        summary.failedFiles === 0 && summary.emptyFiles === 0
          ? 'success'
          : summary.successFiles > 0
          ? 'success'
          : 'failed';
      const msg = `导入完成：${summary.successFiles}个文件成功，${summary.totalParsedEvents}条记录`;
      const detail =
        summary.emptyFiles > 0 || summary.unknownFormatFiles > 0
          ? `${summary.emptyFiles}个空文件，${summary.unknownFormatFiles}个格式错误`
          : undefined;

      addNotification('import', status, msg, detail);

      setTimeout(() => {
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false, progress: 0, message: '' } });
      }, 800);
    } catch (err) {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false, progress: 0, message: '' } });
      addNotification('import', 'failed', '导入失败', String(err));
      console.error('Failed to process log files:', err);
    }
  }, [addNotification]);

  const loadLogFiles = useCallback(async (filePaths: string[]) => {
    if (!window.electronAPI || filePaths.length === 0) return;

    dispatch({
      type: 'SET_LOADING',
      payload: { isLoading: true, progress: 0, message: '正在读取日志文件...' },
    });

    try {
      const results = await window.electronAPI.readLogFiles(filePaths);
      const validFiles = results.filter(
        (r): r is LogFile => 'content' in r && r.content !== undefined
      );
      await processLogFiles(validFiles);
    } catch (err) {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false, progress: 0, message: '' } });
      console.error('Failed to load log files:', err);
    }
  }, [processLogFiles]);

  const loadSampleData = useCallback(async () => {
    await processLogFiles([SAMPLE_LOG_FILE]);
    dispatch({ type: 'SET_ACTIVE_WINDOW', payload: 'timeline' });
  }, [processLogFiles]);

  const applyFilter = useCallback(
    (filter: SearchFilter) => {
      dispatch({ type: 'SET_CURRENT_FILTER', payload: filter });

      let filtered = [...state.allEvents];

      if (filter.playerId) {
        filtered = filtered.filter((e) => e.playerId === filter.playerId);
      }

      if (filter.eventTypes && filter.eventTypes.length > 0) {
        filtered = filtered.filter((e) => filter.eventTypes!.includes(e.type));
      }

      if (filter.keyword && filter.keyword.trim()) {
        const kw = filter.keyword.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.content.toLowerCase().includes(kw) ||
            e.rawContent.toLowerCase().includes(kw) ||
            (e.details && JSON.stringify(e.details).toLowerCase().includes(kw))
        );
      }

      if (filter.startTime) {
        filtered = filtered.filter((e) => e.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter((e) => e.timestamp <= filter.endTime!);
      }

      if (filter.severity && filter.severity.length > 0) {
        filtered = filtered.filter((e) => filter.severity!.includes(e.severity));
      }

      if (filter.onlyMarked) {
        filtered = filtered.filter((e) => e.isMarked);
      }

      dispatch({ type: 'SET_FILTERED_EVENTS', payload: filtered });
    },
    [state.allEvents]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        loadLogFiles,
        loadSampleData,
        applyFilter,
        addNotification,
        dismissNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
