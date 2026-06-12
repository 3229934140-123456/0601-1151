import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '@shared/logParser';
import { getDisplayEvents, getMergedGroupEvents, buildMergedContent } from '@shared/store';
import type { LogEvent, LogEventType } from '@shared/types';

const MARK_TYPES: { value: 'freeze' | 'abnormal' | 'bug' | 'important'; label: string; icon: string }[] = [
  { value: 'freeze', label: '疑似卡死', icon: '🔴' },
  { value: 'abnormal', label: '异常行为', icon: '🟡' },
  { value: 'bug', label: '疑似Bug', icon: '💜' },
  { value: 'important', label: '重要事件', icon: '🔵' },
];

const getEventTypeLabel = (type: LogEvent['type']): string => {
  const labels: Record<LogEventType, string> = {
    login: '登录',
    logout: '登出',
    disconnect: '掉线',
    crash: '崩溃',
    item_change: '道具变化',
    payment: '支付',
    quest: '任务',
    combat: '战斗',
    chat: '聊天',
    system: '系统',
    unknown: '未知',
  };
  return labels[type];
};

const MarkWindow: React.FC = () => {
  const { state, dispatch } = useApp();
  const [csNote, setCsNote] = useState('');
  const [markModalEvent, setMarkModalEvent] = useState<LogEvent | null>(null);
  const [markType, setMarkType] = useState<'freeze' | 'abnormal' | 'bug' | 'important'>('freeze');
  const [markNote, setMarkNote] = useState('');
  const [filterMarked, setFilterMarked] = useState(false);

  const selectedEvents = useMemo(
    () => state.allEvents.filter((e) => state.selectedEventIds.includes(e.id)),
    [state.allEvents, state.selectedEventIds]
  );

  const allDisplayEvents = useMemo(() => {
    let events = getDisplayEvents(state.allEvents);
    if (state.selectedPlayerId) {
      events = events.filter((e) => e.playerId === state.selectedPlayerId);
    }
    if (filterMarked) {
      events = events.filter((e) => e.isMarked);
    }
    return events;
  }, [state.allEvents, state.selectedPlayerId, filterMarked]);

  const markedDisplayEvents = useMemo(
    () => getDisplayEvents(state.allEvents).filter((e) => e.isMarked),
    [state.allEvents]
  );

  const openMarkModal = (event: LogEvent) => {
    setMarkModalEvent(event);
    setMarkType(event.markType || 'freeze');
    setMarkNote(event.markNote || '');
  };

  const saveMark = () => {
    if (markModalEvent) {
      dispatch({
        type: 'MARK_EVENT',
        payload: { id: markModalEvent.id, note: markNote, markType },
      });
    }
    setMarkModalEvent(null);
    setMarkNote('');
  };

  const batchMark = () => {
    for (const event of selectedEvents) {
      dispatch({
        type: 'MARK_EVENT',
        payload: { id: event.id, note: markNote || '批量标记', markType },
      });
    }
    dispatch({ type: 'CLEAR_SELECTED_EVENTS' });
    setMarkNote('');
  };

  const mergeSelected = () => {
    if (selectedEvents.length >= 2) {
      dispatch({ type: 'MERGE_EVENTS', payload: state.selectedEventIds });
      dispatch({ type: 'CLEAR_SELECTED_EVENTS' });
    }
  };

  const addCsNote = () => {
    if (csNote.trim()) {
      dispatch({ type: 'ADD_CS_NOTE', payload: csNote.trim() });
      setCsNote('');
    }
  };

  const copyMarkedEvents = async () => {
    const lines: string[] = [];
    for (const e of markedDisplayEvents) {
      const content = e.isMergedRep
        ? buildMergedContent(e, state.allEvents)
        : e.content;
      lines.push(
        `[${formatTimestamp(e.timestamp)}] [${getEventTypeLabel(e.type)}] ${content}${
          e.markNote ? `\n标记说明：${e.markNote}` : ''
        }`
      );
    }
    if (window.electronAPI) {
      await window.electronAPI.copyToClipboard(lines.join('\n\n'));
    }
  };

  const renderEventContent = (event: LogEvent): React.ReactNode => {
    if (!event.isMergedRep) {
      return <span className={`severity-${event.severity} event-content`}>{event.content}</span>;
    }
    const group = getMergedGroupEvents(event, state.allEvents);
    return (
      <div className={`severity-${event.severity} event-content`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag" style={{ background: '#e94560', color: '#fff' }}>
            合并 {group.length} 条
          </span>
          <span>{event.content}</span>
        </div>
        <div className="mt-1 text-sm text-muted" style={{ paddingLeft: 2 }}>
          {group
            .slice(0, 3)
            .map((g, i) => (
              <div key={g.id}>
                {i + 1}. {g.rawTimestamp} {g.content}
              </div>
            ))}
          {group.length > 3 && <div>... 以及 {group.length - 3} 条更多记录</div>}
        </div>
      </div>
    );
  };

  if (state.allEvents.length === 0) {
    return (
      <div className="window-container">
        <div className="empty-state">
          <div className="empty-state-icon">🏷️</div>
          <div className="empty-state-title">暂无日志数据</div>
          <div className="empty-state-desc">请先在「日志导入」页面导入日志文件</div>
        </div>
      </div>
    );
  }

  return (
    <div className="window-container">
      <div className="panel">
        <div className="panel-title">批量标记</div>
        {selectedEvents.length > 0 ? (
          <>
            <div className="text-muted mb-3">
              已选择 <span className="text-primary font-mono">{selectedEvents.length}</span> 条事件
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">标记类型</label>
                <select
                  className="select"
                  value={markType}
                  onChange={(e) => setMarkType(e.target.value as typeof markType)}
                >
                  {MARK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="label">标记备注</label>
                <input
                  type="text"
                  className="input"
                  placeholder="添加备注说明..."
                  value={markNote}
                  onChange={(e) => setMarkNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={batchMark}>
                🏷️ 批量标记 {selectedEvents.length} 条
              </button>
              {selectedEvents.length >= 2 && (
                <button className="btn btn-success" onClick={mergeSelected}>
                  🔗 合并为一条记录
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => dispatch({ type: 'CLEAR_SELECTED_EVENTS' })}
              >
                清空选择
              </button>
            </div>
          </>
        ) : (
          <div className="text-muted">
            请在「玩家时间线」或「事件搜索」页面选择需要标记的事件，或在下方列表中点击单条事件进行标记
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">客服备注</div>
        <div className="form-group">
          <textarea
            className="textarea"
            placeholder="记录客服沟通内容、玩家反馈、初步分析等..."
            value={csNote}
            onChange={(e) => setCsNote(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted">
            已有 {state.csNotes.length} 条备注
          </span>
          <button className="btn btn-primary" onClick={addCsNote} disabled={!csNote.trim()}>
            💬 添加备注
          </button>
        </div>
        {state.csNotes.length > 0 && (
          <div className="mt-4">
            {state.csNotes.map((note, idx) => (
              <div key={idx} className="note-item">
                <div className="note-text">{note}</div>
                <div className="flex justify-between items-center">
                  <span className="note-time">备注 #{idx + 1}</span>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => dispatch({ type: 'REMOVE_CS_NOTE', payload: idx })}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex items-center justify-between mb-3">
          <div className="panel-title" style={{ marginBottom: 0 }}>
            已标记事件（{markedDisplayEvents.length}）
          </div>
          <div className="flex gap-2">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={filterMarked}
                onChange={(e) => setFilterMarked(e.target.checked)}
              />
              只看已标记
            </label>
            <button
              className="btn btn-sm btn-ghost"
              onClick={copyMarkedEvents}
              disabled={markedDisplayEvents.length === 0}
            >
              📋 复制全部
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => dispatch({ type: 'SET_ACTIVE_WINDOW', payload: 'summary' })}
              disabled={markedDisplayEvents.length === 0}
            >
              生成摘要 →
            </button>
          </div>
        </div>

        <div className="event-list">
          {allDisplayEvents.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon" style={{ fontSize: 40 }}>📭</div>
              <div className="empty-state-title">暂无事件</div>
            </div>
          ) : (
            allDisplayEvents.map((event) => (
              <div
                key={event.id}
                className={`event-item ${event.isMarked ? 'marked' : ''} ${
                  state.selectedEventIds.includes(event.id) ? 'selected' : ''
                } ${event.isMergedRep ? 'merged-rep' : ''}`}
              >
                <input
                  type="checkbox"
                  className="event-checkbox"
                  checked={state.selectedEventIds.includes(event.id)}
                  onChange={() => {
                    if (state.selectedEventIds.includes(event.id)) {
                      dispatch({ type: 'REMOVE_SELECTED_EVENT', payload: event.id });
                    } else {
                      dispatch({ type: 'ADD_SELECTED_EVENT', payload: event.id });
                    }
                  }}
                />
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
                <span className={`event-badge badge-${event.type}`}>
                  {getEventTypeLabel(event.type)}
                </span>
                {renderEventContent(event)}
                <div className="event-meta">
                  {event.isMarked && event.markType && (
                    <span className={`mark-tag mark-${event.markType}`}>
                      {MARK_TYPES.find((t) => t.value === event.markType)?.icon}{' '}
                      {MARK_TYPES.find((t) => t.value === event.markType)?.label}
                    </span>
                  )}
                  {event.isMergedRep && (
                    <span className="tag" style={{ background: '#e94560', color: '#fff' }}>
                      🔗 合并记录
                    </span>
                  )}
                  {event.isMarked ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => openMarkModal(event)}
                    >
                      ✏️ 编辑
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => openMarkModal(event)}
                    >
                      🏷️ 标记
                    </button>
                  )}
                  {event.isMarked && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => dispatch({ type: 'UNMARK_EVENT', payload: event.id })}
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {markModalEvent && (
        <div className="modal-backdrop" onClick={() => setMarkModalEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">标记事件</div>
              <button className="modal-close" onClick={() => setMarkModalEvent(null)}>
                ✕
              </button>
            </div>
            <div className="text-sm text-muted font-mono mb-2">
              {formatTimestamp(markModalEvent.timestamp)}
            </div>
            <div className="text-sm mb-4" style={{ color: '#ccd6f6', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {markModalEvent.isMergedRep
                ? buildMergedContent(markModalEvent, state.allEvents)
                : markModalEvent.content}
            </div>
            <div className="form-group">
              <label className="label">标记类型</label>
              <div className="checkbox-group">
                {MARK_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`checkbox-item ${markType === t.value ? 'checked' : ''}`}
                  >
                    <input
                      type="radio"
                      name="markType"
                      checked={markType === t.value}
                      onChange={() => setMarkType(t.value)}
                    />
                    {t.icon} {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="label">备注说明</label>
              <textarea
                className="textarea"
                placeholder="添加详细说明..."
                value={markNote}
                onChange={(e) => setMarkNote(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setMarkModalEvent(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={saveMark}>
                保存标记
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkWindow;
