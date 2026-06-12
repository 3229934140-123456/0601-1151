import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatTimestamp, formatDuration, buildPlayerSessions, extractUniquePlayerIds } from '@shared/logParser';
import { getDisplayEvents, buildMergedContent, getMergedGroupEvents } from '@shared/store';
import type { LogEvent, LogEventType, WorkTicketSummary } from '@shared/types';

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

const SummaryWindow: React.FC = () => {
  const { state, dispatch } = useApp();
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [summaryPlayerId, setSummaryPlayerId] = useState(state.selectedPlayerId || '');

  const playerIds = useMemo(() => extractUniquePlayerIds(state.allEvents), [state.allEvents]);

  const displayEvents = useMemo(() => getDisplayEvents(state.allEvents), [state.allEvents]);

  const markedDisplayEvents = useMemo(
    () => displayEvents.filter((e) => e.isMarked),
    [displayEvents]
  );

  const playerMarkedEvents = useMemo(() => {
    if (!summaryPlayerId) return markedDisplayEvents;
    return markedDisplayEvents.filter((e) => e.playerId === summaryPlayerId);
  }, [markedDisplayEvents, summaryPlayerId]);

  const playerSessions = useMemo(() => {
    if (!summaryPlayerId) return [];
    return buildPlayerSessions(state.allEvents, summaryPlayerId);
  }, [state.allEvents, summaryPlayerId]);

  const playerAllDisplayEvents = useMemo(() => {
    if (!summaryPlayerId) return displayEvents;
    return displayEvents.filter((e) => e.playerId === summaryPlayerId);
  }, [displayEvents, summaryPlayerId]);

  const timelineSummary = useMemo(() => {
    if (playerSessions.length === 0) return '';
    const lines = playerSessions.map((session, idx) => {
      const abnormal = session.disconnectEvents.some(
        (e) => e.type === 'disconnect' || e.type === 'crash'
      );
      return `会话${idx + 1}：${formatTimestamp(session.startTime)} ~ ${formatTimestamp(
        session.endTime
      )}，持续${formatDuration(session.totalDuration)}${abnormal ? '（异常结束）' : ''}`;
    });
    return lines.join('\n');
  }, [playerSessions]);

  const eventContentForOutput = (event: LogEvent): string => {
    if (event.isMergedRep) {
      return buildMergedContent(event, state.allEvents);
    }
    return event.content;
  };

  const summary: WorkTicketSummary = useMemo(() => {
    return {
      playerId: summaryPlayerId || '未指定',
      playerName: playerAllDisplayEvents[0]?.playerName,
      issueTitle,
      issueDescription,
      keyEvents: playerAllDisplayEvents.filter(
        (e) =>
          e.type === 'login' ||
          e.type === 'disconnect' ||
          e.type === 'crash' ||
          e.type === 'payment' ||
          e.severity === 'error' ||
          e.severity === 'critical'
      ),
      markedEvents: playerMarkedEvents,
      timelineSummary,
      csNotes: state.csNotes,
      suggestedActions: [],
    };
  }, [summaryPlayerId, playerAllDisplayEvents, playerMarkedEvents, issueTitle, issueDescription, timelineSummary, state.csNotes]);

  useEffect(() => {
    dispatch({ type: 'SET_SUMMARY', payload: summary });
  }, [summary, dispatch]);

  const generateReportText = (): string => {
    const now = new Date();
    let report = `========================================\n`;
    report += `        游戏客服日志分析报告\n`;
    report += `========================================\n\n`;
    report += `生成时间：${formatTimestamp(now)}\n`;
    report += `玩家编号：${summary.playerId}\n`;
    if (summary.playerName) report += `玩家昵称：${summary.playerName}\n`;
    report += `\n----------------------------------------\n`;
    report += `【问题标题】\n${summary.issueTitle || '未填写'}\n\n`;
    report += `【问题描述】\n${summary.issueDescription || '未填写'}\n\n`;
    report += `----------------------------------------\n`;
    report += `【会话时间线】\n${summary.timelineSummary || '无数据'}\n\n`;
    report += `----------------------------------------\n`;
    report += `【已标记异常事件】（共${summary.markedEvents.length}条）\n\n`;

    summary.markedEvents.forEach((event, idx) => {
      const group = event.isMergedRep ? getMergedGroupEvents(event, state.allEvents) : [event];
      report += `${idx + 1}. [${formatTimestamp(event.timestamp)}] ${getEventTypeLabel(event.type)}`;
      if (event.isMergedRep) report += `（合并${group.length}条）`;
      report += `\n`;
      const content = eventContentForOutput(event);
      report += content.split('\n').map((line) => `   ${line}`).join('\n');
      report += `\n`;
      if (event.markNote) {
        report += `   客服标记：${event.markNote}\n`;
      }
      report += `\n`;
    });

    report += `----------------------------------------\n`;
    report += `【关键事件】（登录/掉线/支付/错误）\n\n`;

    summary.keyEvents.slice(0, 50).forEach((event, idx) => {
      const group = event.isMergedRep ? getMergedGroupEvents(event, state.allEvents) : [event];
      report += `${idx + 1}. [${formatTimestamp(event.timestamp)}] [${getEventTypeLabel(
        event.type
      )}] [${event.severity.toUpperCase()}]`;
      if (event.isMergedRep) report += `（合并${group.length}条）`;
      report += `\n`;
      const content = eventContentForOutput(event);
      report += content.split('\n').map((line) => `   ${line}`).join('\n');
      report += `\n\n`;
    });

    if (summary.keyEvents.length > 50) {
      report += `... 仅显示前50条，完整日志请查看原始文件 ...\n\n`;
    }

    report += `----------------------------------------\n`;
    report += `【客服备注】\n\n`;

    if (summary.csNotes.length === 0) {
      report += `暂无备注\n`;
    } else {
      summary.csNotes.forEach((note, idx) => {
        report += `${idx + 1}. ${note}\n`;
      });
    }

    report += `\n========================================\n`;
    report += `        报告结束\n`;
    report += `========================================\n`;

    return report;
  };

  const copyReport = async () => {
    if (window.electronAPI) {
      await window.electronAPI.copyToClipboard(generateReportText());
    }
  };

  const copyKeySnippet = async () => {
    if (window.electronAPI && playerMarkedEvents.length > 0) {
      const text = playerMarkedEvents
        .map((e) => {
          const content = eventContentForOutput(e);
          const prefix = `[${formatTimestamp(e.timestamp)}] ${getEventTypeLabel(e.type)}`;
          return `${prefix}${
            e.isMergedRep ? `（合并${getMergedGroupEvents(e, state.allEvents).length}条）` : ''
          }: ${content}${e.markNote ? ` (${e.markNote})` : ''}`;
        })
        .join('\n');
      await window.electronAPI.copyToClipboard(text);
    }
  };

  const exportReport = async () => {
    if (window.electronAPI) {
      const defaultName = `game-log-report-${summary.playerId}-${Date.now()}.txt`;
      await window.electronAPI.exportReport(generateReportText(), defaultName);
    }
  };

  const renderMarkedEventContent = (event: LogEvent): React.ReactNode => {
    if (!event.isMergedRep) {
      return <span className="event-content">{event.content}</span>;
    }
    const group = getMergedGroupEvents(event, state.allEvents);
    return (
      <div className="event-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag" style={{ background: '#e94560', color: '#fff' }}>
            合并 {group.length} 条
          </span>
          <span>{event.content}</span>
        </div>
        <div className="mt-1 text-sm text-muted" style={{ paddingLeft: 2 }}>
          {group
            .slice(0, 2)
            .map((g, i) => (
              <div key={g.id}>
                {i + 1}. {g.rawTimestamp} {g.content}
              </div>
            ))}
          {group.length > 2 && <div>... 以及 {group.length - 2} 条更多记录</div>}
        </div>
      </div>
    );
  };

  if (state.allEvents.length === 0) {
    return (
      <div className="window-container">
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">暂无日志数据</div>
          <div className="empty-state-desc">请先在「日志导入」页面导入日志文件</div>
        </div>
      </div>
    );
  }

  return (
    <div className="window-container">
      <div className="panel">
        <div className="panel-title">工单信息</div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">玩家编号</label>
            <select
              className="select"
              value={summaryPlayerId}
              onChange={(e) => setSummaryPlayerId(e.target.value)}
            >
              <option value="">全部玩家汇总</option>
              {playerIds.map((id) => (
                <option key={id} value={id}>
                  玩家 {id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="label">问题标题</label>
            <input
              type="text"
              className="input"
              placeholder="简要描述问题，例如：玩家反馈充值未到账"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="label">问题详细描述</label>
          <textarea
            className="textarea"
            placeholder="详细描述玩家反馈的问题、发生时间、复现步骤等..."
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          已标记异常事件（{playerMarkedEvents.length}）
        </div>
        {playerMarkedEvents.length === 0 ? (
          <div className="text-muted">
            暂无已标记事件，请先在「异常标记」页面标记相关事件
          </div>
        ) : (
          <div className="event-list">
            {playerMarkedEvents.map((event, idx) => (
              <div key={event.id} className="event-item marked">
                <span className="event-time font-mono">{idx + 1}.</span>
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
                <span className={`event-badge badge-${event.type}`}>
                  {getEventTypeLabel(event.type)}
                </span>
                {renderMarkedEventContent(event)}
                {event.markType && (
                  <span className={`mark-tag mark-${event.markType}`}>
                    {event.markType === 'freeze' && '疑似卡死'}
                    {event.markType === 'abnormal' && '异常行为'}
                    {event.markType === 'bug' && '疑似Bug'}
                    {event.markType === 'important' && '重要事件'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {playerMarkedEvents.length > 0 && playerMarkedEvents.some((e) => e.markNote) && (
          <div className="mt-3">
            <div className="summary-label">标记备注</div>
            {playerMarkedEvents
              .filter((e) => e.markNote)
              .map((e) => (
                <div key={e.id} className="note-item" style={{ marginTop: 8 }}>
                  <div className="text-sm text-muted mb-1">
                    {formatTimestamp(e.timestamp)}
                    {e.isMergedRep && `（合并${getMergedGroupEvents(e, state.allEvents).length}条）`}
                  </div>
                  <div className="note-text">{e.markNote}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">会话时间线</div>
        {playerSessions.length === 0 ? (
          <div className="text-muted">请选择具体玩家查看会话时间线</div>
        ) : (
          <div className="summary-value" style={{ whiteSpace: 'pre-wrap' }}>
            {summary.timelineSummary}
          </div>
        )}
      </div>

      {state.csNotes.length > 0 && (
        <div className="panel">
          <div className="panel-title">客服备注</div>
          {state.csNotes.map((note, idx) => (
            <div key={idx} className="note-item">
              <div className="note-text">
                <span className="text-primary" style={{ marginRight: 8 }}>
                  #{idx + 1}
                </span>
                {note}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-title">报告预览 & 导出</div>
        <div className="form-group">
          <textarea
            className="textarea"
            value={generateReportText()}
            readOnly
            rows={16}
            style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 12 }}
          />
        </div>
        <div className="summary-actions">
          <button className="btn btn-primary" onClick={copyReport}>
            📋 复制完整报告
          </button>
          <button className="btn btn-success" onClick={copyKeySnippet} disabled={playerMarkedEvents.length === 0}>
            📌 复制关键片段
          </button>
          <button className="btn btn-primary" onClick={exportReport}>
            💾 导出给研发的报告
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryWindow;
