import React, { useCallback, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';

const ImportWindow: React.FC = () => {
  const { state, dispatch, loadLogFiles, loadSampleData } = useApp();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const logExtensions = ['.log', '.txt', '.json', '.zip'];
      const validFiles = files.filter((f) =>
        logExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
      );

      if (validFiles.length > 0) {
        const paths = validFiles.map((f) => (f as unknown as { path?: string }).path || f.name);
        await loadLogFiles(paths);
      }
    },
    [loadLogFiles]
  );

  const handleSelectFiles = useCallback(async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.selectLogFiles();
      if (files.length > 0) {
        await loadLogFiles(files);
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [loadLogFiles]);

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const paths = Array.from(files).map(
          (f) => (f as unknown as { path?: string }).path || f.name
        );
        await loadLogFiles(paths);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [loadLogFiles]
  );

  const handleRemoveFile = useCallback((filePath: string) => {
    // 简单实现：重置所有数据
    dispatch({ type: 'RESET_ALL' });
  }, [dispatch]);

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="window-container">
      <div className="panel">
        <div className="panel-title">导入日志</div>

        <div
          className={`drop-zone ${isDragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleSelectFiles}
        >
          <div className="drop-zone-icon">📂</div>
          <div className="drop-zone-title">拖入日志文件到此处</div>
          <div className="drop-zone-desc">
            支持 .log、.txt、.json、.zip 格式，可多选或拖入整个文件夹
          </div>
          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleSelectFiles(); }}>
            📁 选择文件
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-success"
              onClick={(e) => { e.stopPropagation(); loadSampleData(); }}
              disabled={state.isLoading}
            >
              🎮 加载示例数据体验
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".log,.txt,.json,.zip"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {state.isLoading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${state.loadingProgress}%` }} />
            </div>
            <div className="progress-text">
              {state.loadingMessage} ({state.loadingProgress}%)
            </div>
          </div>
        )}

        {state.logFiles.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="panel-title" style={{ marginBottom: 12 }}>已导入文件</div>
            <ul className="file-list">
              {state.logFiles.map((file) => (
                <li key={file.path} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatSize(file.size)}</span>
                    {file.error && (
                      <span className="text-primary text-sm" style={{ marginLeft: 12 }}>
                        ⚠️ {file.error}
                      </span>
                    )}
                  </div>
                  <div className="file-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleRemoveFile(file.path)}
                    >
                      移除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {state.allEvents.length > 0 && (
        <div className="panel">
          <div className="panel-title">数据概览</div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{state.allEvents.length}</div>
              <div className="stat-label">日志事件总数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {Array.from(new Set(state.allEvents.map((e) => e.playerId))).filter(
                  (id) => id !== 'unknown'
                ).length}
              </div>
              <div className="stat-label">涉及玩家数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {state.allEvents.filter((e) => e.type === 'login').length}
              </div>
              <div className="stat-label">登录事件</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {state.allEvents.filter((e) => e.type === 'disconnect' || e.type === 'crash').length}
              </div>
              <div className="stat-label">异常掉线</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {state.allEvents.filter((e) => e.type === 'payment').length}
              </div>
              <div className="stat-label">支付事件</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {state.allEvents.filter((e) => e.severity === 'error' || e.severity === 'critical').length}
              </div>
              <div className="stat-label">错误/严重事件</div>
            </div>
          </div>

          {state.allEvents.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-muted">
                数据时间范围：
                <span className="font-mono" style={{ color: '#ccd6f6', marginLeft: 6 }}>
                  {state.allEvents[0]?.timestamp.toLocaleString('zh-CN')} ~
                  {state.allEvents[state.allEvents.length - 1]?.timestamp.toLocaleString('zh-CN')}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => dispatch({ type: 'SET_ACTIVE_WINDOW', payload: 'timeline' })}
              >
                查看玩家时间线 →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportWindow;
