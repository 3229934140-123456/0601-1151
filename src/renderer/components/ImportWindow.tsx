import React, { useCallback, useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { FileImportDetail, FileParseStatus } from '@shared/types';

const ImportWindow: React.FC = () => {
  const { state, dispatch, loadLogFiles, loadSampleData } = useApp();
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [detailTab, setDetailTab] = useState<'all' | 'success' | 'failed' | 'empty'>('all');
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

  const getStatusInfo = (status: FileParseStatus): { icon: string; label: string; color: string } => {
    switch (status) {
      case 'success':
        return { icon: '✅', label: '成功', color: '#10b981' };
      case 'partial':
        return { icon: '⚠️', label: '部分成功', color: '#f59e0b' };
      case 'failed':
        return { icon: '❌', label: '失败', color: '#ef4444' };
      case 'empty':
        return { icon: '📭', label: '空文件', color: '#94a3b8' };
      case 'unknown_format':
        return { icon: '❓', label: '格式不支持', color: '#f97316' };
      default:
        return { icon: '❔', label: '未知', color: '#64748b' };
    }
  };

  const toggleFileExpand = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const filteredDetails = useMemo(() => {
    if (!state.importSummary) return [];
    const details = state.importSummary.details;
    switch (detailTab) {
      case 'success':
        return details.filter((d) => d.status === 'success' || d.status === 'partial');
      case 'failed':
        return details.filter((d) => d.status === 'failed' || d.status === 'unknown_format');
      case 'empty':
        return details.filter((d) => d.status === 'empty');
      default:
        return details;
    }
  }, [state.importSummary, detailTab]);

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

        {state.logFiles.length > 0 && state.importSummary && (
          <div className="import-detail-panel" style={{ marginTop: 24 }}>
            <div className="import-detail-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>📋 导入明细</div>
              <div className="import-stats-bar">
                <span className="stat-item">
                  <span className="stat-icon" style={{ color: '#10b981' }}>✅</span>
                  <span>{state.importSummary.successFiles} 成功</span>
                </span>
                {state.importSummary.emptyFiles > 0 && (
                  <span className="stat-item">
                    <span className="stat-icon" style={{ color: '#94a3b8' }}>📭</span>
                    <span>{state.importSummary.emptyFiles} 空文件</span>
                  </span>
                )}
                {state.importSummary.unknownFormatFiles > 0 && (
                  <span className="stat-item">
                    <span className="stat-icon" style={{ color: '#f97316' }}>❓</span>
                    <span>{state.importSummary.unknownFormatFiles} 格式错误</span>
                  </span>
                )}
                {(state.importSummary.totalFailedLines > 0) && (
                  <span className="stat-item">
                    <span className="stat-icon" style={{ color: '#ef4444' }}>⚠️</span>
                    <span>{state.importSummary.totalFailedLines} 行解析失败</span>
                  </span>
                )}
                <span className="stat-item stat-total">
                  <span className="stat-icon">📊</span>
                  <span>共 {state.importSummary.totalParsedEvents} 条记录</span>
                </span>
              </div>
            </div>

            <div className="detail-tabs">
              <button
                className={`detail-tab ${detailTab === 'all' ? 'active' : ''}`}
                onClick={() => setDetailTab('all')}
              >
                全部 ({state.importSummary.totalFiles})
              </button>
              <button
                className={`detail-tab ${detailTab === 'success' ? 'active' : ''}`}
                onClick={() => setDetailTab('success')}
                style={{ color: '#10b981' }}
              >
                成功 ({state.importSummary.successFiles + state.importSummary.details.filter(d => d.status === 'partial').length})
              </button>
              <button
                className={`detail-tab ${detailTab === 'failed' ? 'active' : ''}`}
                onClick={() => setDetailTab('failed')}
                style={{ color: '#ef4444' }}
              >
                失败 ({state.importSummary.details.filter(d => d.status === 'failed' || d.status === 'unknown_format').length})
              </button>
              <button
                className={`detail-tab ${detailTab === 'empty' ? 'active' : ''}`}
                onClick={() => setDetailTab('empty')}
                style={{ color: '#94a3b8' }}
              >
                空文件 ({state.importSummary.emptyFiles})
              </button>
            </div>

            <ul className="file-detail-list">
              {filteredDetails.map((detail) => {
                const statusInfo = getStatusInfo(detail.status);
                const isExpanded = expandedFiles.has(detail.path);
                const hasError = detail.failedCount > 0 || detail.errorMessage;
                return (
                  <li
                    key={detail.path}
                    className={`file-detail-item status-${detail.status}`}
                  >
                    <div className="file-detail-main" onClick={() => toggleFileExpand(detail.path)}>
                      <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                      <span className="file-icon">📄</span>
                      <div className="file-detail-info">
                        <div className="file-detail-name">{detail.name}</div>
                        <div className="file-detail-meta">
                          {formatSize(detail.size)}
                          {detail.sourceZip && (
                            <span className="source-zip">📦 来自 {detail.sourceZip}</span>
                          )}
                        </div>
                      </div>
                      <div className="file-detail-counts">
                        <span className="count-item parsed">
                          <span className="count-num">{detail.parsedCount}</span>
                          <span className="count-label">解析</span>
                        </span>
                        {detail.totalLines > 0 && (
                          <span className="count-item total">
                            <span className="count-num">{detail.totalLines}</span>
                            <span className="count-label">总行</span>
                          </span>
                        )}
                        {hasError && (
                          <span className="count-item failed">
                            <span className="count-num">{detail.failedCount || '?'}</span>
                            <span className="count-label">失败</span>
                          </span>
                        )}
                      </div>
                      <span className="file-status-badge" style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="file-detail-expanded">
                        <div className="detail-expanded-section">
                          <div className="detail-section-title">解析结果</div>
                          <div className="detail-grid">
                            <div className="detail-row">
                              <span className="detail-label">文件路径：</span>
                              <span className="detail-value">{detail.path}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">文件大小：</span>
                              <span className="detail-value">{formatSize(detail.size)}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">解析状态：</span>
                              <span className="detail-value" style={{ color: statusInfo.color }}>
                                {statusInfo.icon} {statusInfo.label}
                              </span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">解析记录数：</span>
                              <span className="detail-value">{detail.parsedCount} 条</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">解析失败数：</span>
                              <span className="detail-value" style={{ color: detail.failedCount > 0 ? '#ef4444' : 'inherit' }}>
                                {detail.failedCount} 行
                              </span>
                            </div>
                            {detail.errorMessage && (
                              <div className="detail-row">
                                <span className="detail-label">错误信息：</span>
                                <span className="detail-value error">{detail.errorMessage}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {detail.sampleErrors && detail.sampleErrors.length > 0 && (
                          <div className="detail-expanded-section">
                            <div className="detail-section-title">错误示例（最多显示5条）</div>
                            <ul className="error-list">
                              {detail.sampleErrors.map((err, idx) => (
                                <li key={idx} className="error-item">
                                  <span className="error-line">{err}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => handleRemoveFile('')}
              >
                清除所有导入
              </button>
            </div>
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
