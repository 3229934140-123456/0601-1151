import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatTimestamp, extractUniquePlayerIds } from '@shared/logParser';
import type { LogEventType, LogEvent, SearchFilter } from '@shared/types';

const EVENT_TYPES: { value: LogEventType; label: string }[] = [
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'disconnect', label: '掉线' },
  { value: 'crash', label: '崩溃' },
  { value: 'item_change', label: '道具变化' },
  { value: 'payment', label: '支付' },
  { value: 'quest', label: '任务' },
  { value: 'combat', label: '战斗' },
  { value: 'chat', label: '聊天' },
  { value: 'system', label: '系统' },
  { value: 'unknown', label: '未知' },
];

const SEVERITIES = [
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'critical', label: '严重' },
];

const getEventTypeLabel = (type: LogEvent['type']): string => {
  const found = EVENT_TYPES.find((e) => e.value === type);
  return found ? found.label : type;
};

const SearchWindow: React.FC = () => {
  const { state, dispatch, applyFilter } = useApp();
  const [keyword, setKeyword] = useState('');
  const [playerId, setPlayerId] = useState(state.selectedPlayerId || '');
  const [selectedTypes, setSelectedTypes] = useState<LogEventType[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<SearchFilter['severity']>([]);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFilterName, setSavedFilterName] = useState('');

  const playerIds = useMemo(() => extractUniquePlayerIds(state.allEvents), [state.allEvents]);

  useEffect(() => {
    applyFilter({
      playerId: playerId || undefined,
      eventTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      keyword: keyword || undefined,
      severity: selectedSeverities && selectedSeverities.length > 0 ? selectedSeverities : undefined,
      onlyMarked,
    });
  }, [playerId, selectedTypes, keyword, selectedSeverities, onlyMarked, applyFilter]);

  const toggleType = (type: LogEventType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSeverity = (sev: 'info' | 'warning' | 'error' | 'critical') => {
    setSelectedSeverities((prev) => {
      if (!prev) return [sev];
      return prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev];
    });
  };

  const resetFilter = () => {
    setKeyword('');
    setPlayerId('');
    setSelectedTypes([]);
    setSelectedSeverities([]);
    setOnlyMarked(false);
  };

  const loadSavedFilter = (name: string) => {
    const filter = state.savedFilters[name];
    if (filter) {
      setPlayerId(filter.playerId || '');
      setSelectedTypes(filter.eventTypes || []);
      setKeyword(filter.keyword || '');
      setSelectedSeverities(filter.severity || []);
      setOnlyMarked(filter.onlyMarked || false);
    }
  };

  const saveCurrentFilter = async () => {
    if (!savedFilterName.trim()) return;
    const filter: SearchFilter = {
      playerId: playerId || undefined,
      eventTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      keyword: keyword || undefined,
      severity: selectedSeverities && selectedSeverities.length > 0 ? selectedSeverities : undefined,
      onlyMarked,
    };
    if (window.electronAPI) {
      await window.electronAPI.saveFilter(savedFilterName, filter);
      const filters = await window.electronAPI.loadFilters();
      dispatch({ type: 'SET_SAVED_FILTERS', payload: filters as Record<string, SearchFilter> });
    }
    setShowSaveModal(false);
    setSavedFilterName('');
  };

  const deleteSavedFilter = async (name: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteFilter(name);
      const filters = await window.electronAPI.loadFilters();
      dispatch({ type: 'SET_SAVED_FILTERS', payload: filters as Record<string, SearchFilter> });
    }
  };

  const copyEventText = async (event: LogEvent) => {
    if (window.electronAPI) {
      await window.electronAPI.copyToClipboard(
        `[${formatTimestamp(event.timestamp)}] ${getEventTypeLabel(event.type)} - ${event.content}`
      );
    }
  };

  if (state.allEvents.length === 0) {
    return (
      <div className="window-container">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">暂无日志数据</div>
          <div className="empty-state-desc">请先在「日志导入」页面导入日志文件</div>
        </div>
      </div>
    );
  }

  return (
    <div className="window-container">
      <div className="panel">
        <div className="panel-title">筛选条件</div>
        <div className="filter-bar">
          <div className="filter-item">
            <label className="label">玩家编号</label>
            <select className="select" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">全部玩家</option>
              {playerIds.map((id) => (
                <option key={id} value={id}>
                  玩家 {id}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item" style={{ minWidth: 300, flex: 2 }}>
            <label className="label">关键词搜索</label>
            <input
              type="text"
              className="input"
              placeholder="搜索道具名称、订单号、任务ID等..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="filter-actions">
            <button className="btn btn-ghost" onClick={resetFilter}>
              重置
            </button>
            <button className="btn btn-primary" onClick={() => setShowSaveModal(true)}>
              💾 保存筛选
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="label">事件类型</label>
          <div className="checkbox-group">
            {EVENT_TYPES.map((t) => (
              <label
                key={t.value}
                className={`checkbox-item ${selectedTypes.includes(t.value) ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(t.value)}
                  onChange={() => toggleType(t.value)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="label">严重程度</label>
          <div className="checkbox-group">
            {SEVERITIES.map((s) => {
              const isChecked = selectedSeverities?.includes(s.value as never) || false;
              return (
                <label key={s.value} className={`checkbox-item ${isChecked ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      toggleSeverity(s.value as 'info' | 'warning' | 'error' | 'critical')
                    }
                  />
                  {s.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-item" style={{ width: 'fit-content' }}>
            <input
              type="checkbox"
              checked={onlyMarked}
              onChange={(e) => setOnlyMarked(e.target.checked)}
            />
            只看已标记事件
          </label>
        </div>
      </div>

      {Object.keys(state.savedFilters).length > 0 && (
        <div className="panel">
          <div className="panel-title">常用筛选</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(state.savedFilters).map((name) => (
              <div key={name} className="tag" style={{ padding: '6px 12px' }}>
                <span style={{ cursor: 'pointer' }} onClick={() => loadSavedFilter(name)}>
                  🔍 {name}
                </span>
                <span className="tag-close" onClick={() => deleteSavedFilter(name)}>
                  ✕
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="flex items-center justify-between mb-3">
          <div className="panel-title" style={{ marginBottom: 0 }}>
            搜索结果（{state.filteredEvents.length} 条）
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-ghost"
              disabled={state.selectedEventIds.length === 0}
              onClick={() => dispatch({ type: 'CLEAR_SELECTED_EVENTS' })}
            >
              清空选中
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={state.selectedEventIds.length === 0}
              onClick={() => dispatch({ type: 'SET_ACTIVE_WINDOW', payload: 'mark' })}
            >
              批量标记 →
            </button>
          </div>
        </div>

        {state.filteredEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">没有匹配的事件</div>
            <div className="empty-state-desc">试试调整筛选条件</div>
          </div>
        ) : (
          <div className="event-list">
            {state.filteredEvents.map((event) => {
              const isSelected = state.selectedEventIds.includes(event.id);
              const sevClass = `severity-${event.severity}`;
              return (
                <div
                  key={event.id}
                  className={`event-item ${isSelected ? 'selected' : ''} ${event.isMarked ? 'marked' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="event-checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        dispatch({ type: 'REMOVE_SELECTED_EVENT', payload: event.id });
                      } else {
                        dispatch({ type: 'ADD_SELECTED_EVENT', payload: event.id });
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="event-time">{formatTimestamp(event.timestamp)}</span>
                  <span className={`event-badge badge-${event.type}`}>
                    {getEventTypeLabel(event.type)}
                  </span>
                  <span className={`${sevClass} event-content`}>{event.content}</span>
                  <div className="event-meta">
                    {event.isMarked && event.markType && (
                      <span className={`mark-tag mark-${event.markType}`}>已标记</span>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={() => copyEventText(event)}>
                      📋 复制
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSaveModal && (
        <div className="modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">保存筛选条件</div>
              <button className="modal-close" onClick={() => setShowSaveModal(false)}>
                ✕
              </button>
            </div>
            <div className="form-group">
              <label className="label">筛选名称</label>
              <input
                type="text"
                className="input"
                placeholder="例如：道具丢失问题、充值异常等..."
                value={savedFilterName}
                onChange={(e) => setSavedFilterName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={saveCurrentFilter}
                disabled={!savedFilterName.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchWindow;
