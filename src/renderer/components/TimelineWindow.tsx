import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { buildPlayerSessions, formatDuration, formatTimestamp, extractUniquePlayerIds, getPlayerEvents } from '@shared/logParser';
import { getDisplayEvents, getMergedGroupEvents } from '@shared/store';
import type { LogEvent } from '@shared/types';

const getEventTypeLabel = (type: LogEvent['type']): string => {
  const labels: Record<LogEvent['type'], string> = {
    login: '玩家登录',
    logout: '主动登出',
    disconnect: '异常掉线',
    crash: '客户端崩溃',
    item_change: '道具变化',
    payment: '支付充值',
    quest: '任务事件',
    combat: '战斗事件',
    chat: '聊天消息',
    system: '系统事件',
    unknown: '未知事件',
  };
  return labels[type];
};

const TimelineWindow: React.FC = () => {
  const { state, dispatch } = useApp();

  const playerIds = useMemo(() => extractUniquePlayerIds(state.allEvents), [state.allEvents]);

  const sessions = useMemo(() => {
    if (!state.selectedPlayerId) return [];
    return buildPlayerSessions(state.allEvents, state.selectedPlayerId);
  }, [state.allEvents, state.selectedPlayerId]);

  const playerEvents = useMemo(() => {
    if (!state.selectedPlayerId) return [];
    return getPlayerEvents(state.allEvents, state.selectedPlayerId);
  }, [state.allEvents, state.selectedPlayerId]);

  const playerDisplayEvents = useMemo(() => {
    return getDisplayEvents(playerEvents);
  }, [playerEvents]);

  const keyEvents = useMemo(() => {
    return playerDisplayEvents.filter(
      (e) =>
        e.type === 'login' ||
        e.type === 'logout' ||
        e.type === 'disconnect' ||
        e.type === 'crash' ||
        e.type === 'payment' ||
        e.severity === 'error' ||
        e.severity === 'critical' ||
        e.isMarked
    );
  }, [playerDisplayEvents]);

  if (state.allEvents.length === 0) {
    return (
      <div className="window-container">
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">暂无日志数据</div>
          <div className="empty-state-desc">请先在「日志导入」页面导入日志文件</div>
        </div>
      </div>
    );
  }

  return (
    <div className="window-container">
      <div className="panel">
        <div className="panel-title">玩家筛选</div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">玩家编号</label>
            <select
              className="select"
              value={state.selectedPlayerId || ''}
              onChange={(e) => dispatch({ type: 'SET_SELECTED_PLAYER', payload: e.target.value || null })}
            >
              <option value="">-- 请选择玩家 --</option>
              {playerIds.map((id) => (
                <option key={id} value={id}>
                  玩家 {id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">玩家信息</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', height: 34 }}>
              {state.selectedPlayerId ? (
                <>
                  <span>事件总数：</span>
                  <span className="text-primary font-mono" style={{ marginRight: 20 }}>
                    {playerDisplayEvents.length}
                  </span>
                  <span>会话数：</span>
                  <span className="text-primary font-mono">{sessions.length}</span>
                </>
              ) : (
                <span className="text-muted">请选择玩家查看详细信息</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {state.selectedPlayerId && (
        <>
          <div className="panel">
            <div className="panel-title">会话概览</div>
            {sessions.length === 0 ? (
              <div className="text-muted">暂无会话数据</div>
            ) : (
              <div className="stats-grid">
                {sessions.map((session, idx) => (
                  <div key={idx} className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="stat-value" style={{ fontSize: 20 }}>
                          会话 {idx + 1}
                        </div>
                        <div className="stat-label" style={{ marginTop: 4 }}>
                          时长：{formatDuration(session.totalDuration)}
                        </div>
                      </div>
                      {session.disconnectEvents.some(
                        (e) => e.type === 'disconnect' || e.type === 'crash'
                      ) && (
                        <span className="mark-tag mark-freeze">异常结束</span>
                      )}
                    </div>
                    <div className="text-sm text-muted mt-2 font-mono">
                      {formatTimestamp(session.startTime)}
                    </div>
                    <div className="text-sm text-muted font-mono">
                      ~ {formatTimestamp(session.endTime)}
                    </div>
                    <div className="text-sm mt-2">
                      <span className="tag">登录 {session.loginEvents.length}</span>
                      <span className="tag">掉线 {session.disconnectEvents.length}</span>
                      <span className="tag">事件 {session.events.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">关键时间线</div>
            {keyEvents.length === 0 ? (
              <div className="text-muted">暂无关键事件</div>
            ) : (
              <div className="timeline-container">
                {keyEvents.map((event) => {
                  const isMerged = event.isMergedRep;
                  const group = isMerged ? getMergedGroupEvents(event, state.allEvents) : [event];
                  return (
                    <div key={event.id} className={`timeline-item ${event.type}`}>
                      <div className="timeline-header">
                        <span className="timeline-time">{formatTimestamp(event.timestamp)}</span>
                        <span className={`event-badge badge-${event.type}`}>
                          {getEventTypeLabel(event.type)}
                          {isMerged && `（合并${group.length}条）`}
                        </span>
                        {event.isMarked && event.markType && (
                          <span className={`mark-tag mark-${event.markType}`}>
                            {event.markType === 'freeze' && '🔴 疑似卡死'}
                            {event.markType === 'abnormal' && '🟡 异常行为'}
                            {event.markType === 'bug' && '💜 疑似Bug'}
                            {event.markType === 'important' && '🔵 重要事件'}
                          </span>
                        )}
                        <span className={`severity-${event.severity}`} style={{ marginLeft: 'auto', fontSize: 11 }}>
                          [{event.severity.toUpperCase()}]
                        </span>
                      </div>
                      <div className="timeline-desc">
                        {isMerged ? (
                          <>
                            <div>{event.content}</div>
                            <div className="text-sm text-muted mt-1">
                              {group.slice(0, 2).map((g, i) => (
                                <div key={g.id}>
                                  {i + 1}. {g.rawTimestamp} {g.content}
                                </div>
                              ))}
                              {group.length > 2 && <div>... 以及 {group.length - 2} 条</div>}
                            </div>
                          </>
                        ) : (
                          event.content
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">完整事件列表</div>
            <div className="event-list">
              {playerDisplayEvents.map((event) => {
                const isMerged = event.isMergedRep;
                const group = isMerged ? getMergedGroupEvents(event, state.allEvents) : [event];
                return (
                  <div
                    key={event.id}
                    className={`event-item ${event.isMarked ? 'marked' : ''} ${isMerged ? 'merged-rep' : ''}`}
                    onClick={() => {
                      const isSelected = state.selectedEventIds.includes(event.id);
                      if (isSelected) {
                        dispatch({ type: 'REMOVE_SELECTED_EVENT', payload: event.id });
                      } else {
                        dispatch({ type: 'ADD_SELECTED_EVENT', payload: event.id });
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className="event-checkbox"
                      checked={state.selectedEventIds.includes(event.id)}
                      onChange={() => {}}
                    />
                    <span className="event-time">{formatTimestamp(event.timestamp)}</span>
                    <span className={`event-badge badge-${event.type}`}>
                      {getEventTypeLabel(event.type)}
                    </span>
                    <span className="event-content">
                      {isMerged ? (
                        <>
                          <span className="tag" style={{ background: '#e94560', color: '#fff', marginRight: 6 }}>
                            🔗 {group.length}条合并
                          </span>
                          {event.content}
                        </>
                      ) : (
                        event.content
                      )}
                    </span>
                    <div className="event-meta">
                      {event.isMarked && event.markType && (
                        <span className={`mark-tag mark-${event.markType}`}>已标记</span>
                      )}
                      {isMerged && <span className="tag">已合并</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {state.selectedEventIds.length > 0 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-muted">
                  已选择 <span className="text-primary font-mono">{state.selectedEventIds.length}</span> 条事件
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => dispatch({ type: 'CLEAR_SELECTED_EVENTS' })}
                  >
                    清空选择
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => dispatch({ type: 'SET_ACTIVE_WINDOW', payload: 'mark' })}
                  >
                    去标记异常 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TimelineWindow;
