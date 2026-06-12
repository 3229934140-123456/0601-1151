import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatTimestamp, formatDuration, buildPlayerSessions, extractUniquePlayerIds } from '@shared/logParser';
import { getDisplayEvents, buildMergedContent, getMergedGroupEvents } from '@shared/store';
import type { LogEvent, LogEventType, WorkTicketSummary, LogFile } from '@shared/types';

type ReportTemplateType = 'custom' | 'payment_missing' | 'crash_freeze' | 'item_missing';

interface ReportTemplate {
  id: ReportTemplateType;
  name: string;
  icon: string;
  description: string;
  keyEventTypes: LogEventType[];
  keywords: string[];
  titleSuggestion: string;
  descriptionSuggestion: string;
  sectionOrder: ('problem' | 'timeline' | 'marked' | 'keyevents' | 'payments' | 'items' | 'notes')[];
  includeAllKeyEvents: boolean;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'custom',
    name: '自定义报告',
    icon: '📝',
    description: '自由组织报告内容',
    keyEventTypes: ['login', 'disconnect', 'crash', 'payment', 'item_change'],
    keywords: [],
    titleSuggestion: '',
    descriptionSuggestion: '',
    sectionOrder: ['problem', 'timeline', 'marked', 'keyevents', 'notes'],
    includeAllKeyEvents: true,
  },
  {
    id: 'payment_missing',
    name: '充值未到账',
    icon: '💰',
    description: '玩家反馈充值后道具/钻石未到账',
    keyEventTypes: ['payment', 'login', 'disconnect', 'item_change'],
    keywords: ['支付', '充值', '付款', '订单', '购买', 'pay', 'recharge', 'order'],
    titleSuggestion: '玩家反馈充值后未收到对应道具',
    descriptionSuggestion: '玩家于X点X分进行了X元充值，但未收到对应购买的道具/钻石。请协助排查订单状态及道具发放记录。',
    sectionOrder: ['problem', 'payments', 'timeline', 'marked', 'items', 'notes'],
    includeAllKeyEvents: false,
  },
  {
    id: 'crash_freeze',
    name: '卡死闪退',
    icon: '💥',
    description: '游戏运行中出现卡死、闪退、无响应',
    keyEventTypes: ['login', 'disconnect', 'crash', 'system'],
    keywords: ['崩溃', '闪退', '卡死', '无响应', 'crash', 'freeze', 'hang', '断开'],
    titleSuggestion: '玩家反馈游戏运行中频繁卡死闪退',
    descriptionSuggestion: '玩家在进行XX操作时（如：进入副本、切换场景、点击按钮）出现游戏卡死/闪退，频率约X次/天。请协助排查客户端崩溃原因。',
    sectionOrder: ['problem', 'timeline', 'marked', 'keyevents', 'notes'],
    includeAllKeyEvents: true,
  },
  {
    id: 'item_missing',
    name: '道具丢失',
    icon: '🎒',
    description: '玩家反馈背包道具、装备或钻石异常减少',
    keyEventTypes: ['item_change', 'login', 'disconnect', 'payment'],
    keywords: ['道具', '丢失', '消失', '减少', '背包', 'item', 'missing', 'lost', 'inventory'],
    titleSuggestion: '玩家反馈背包道具异常丢失',
    descriptionSuggestion: '玩家发现X道具于X日X点左右异常减少X个，玩家表示未进行消耗操作。请协助排查道具变更记录。',
    sectionOrder: ['problem', 'items', 'timeline', 'marked', 'payments', 'notes'],
    includeAllKeyEvents: false,
  },
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

const SummaryWindow: React.FC = () => {
  const { state, dispatch, addNotification } = useApp();
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [summaryPlayerId, setSummaryPlayerId] = useState(state.selectedPlayerId || '');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateType>('custom');

  const currentTemplate = useMemo(
    () => REPORT_TEMPLATES.find((t) => t.id === selectedTemplate) || REPORT_TEMPLATES[0],
    [selectedTemplate]
  );

  const playerIds = useMemo(() => extractUniquePlayerIds(state.allEvents), [state.allEvents]);

  const displayEvents = useMemo(() => getDisplayEvents(state.allEvents), [state.allEvents]);

  const handleTemplateChange = useCallback((templateId: ReportTemplateType) => {
    setSelectedTemplate(templateId);
    const template = REPORT_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      if (template.titleSuggestion && !issueTitle) {
        setIssueTitle(template.titleSuggestion);
      }
      if (template.descriptionSuggestion && !issueDescription) {
        setIssueDescription(template.descriptionSuggestion);
      }
    }
  }, [issueTitle, issueDescription]);

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

  const paymentEvents = useMemo(() => {
    return playerAllDisplayEvents.filter(
      (e) => e.type === 'payment' || currentTemplate.keywords.some((kw) =>
        e.content.toLowerCase().includes(kw.toLowerCase()) ||
        e.rawContent.toLowerCase().includes(kw.toLowerCase())
      )
    );
  }, [playerAllDisplayEvents, currentTemplate]);

  const itemChangeEvents = useMemo(() => {
    return playerAllDisplayEvents.filter((e) => e.type === 'item_change');
  }, [playerAllDisplayEvents]);

  const templateKeyEvents = useMemo(() => {
    if (currentTemplate.includeAllKeyEvents) {
      return playerAllDisplayEvents.filter(
        (e) =>
          e.type === 'login' ||
          e.type === 'disconnect' ||
          e.type === 'crash' ||
          e.type === 'payment' ||
          e.severity === 'error' ||
          e.severity === 'critical'
      );
    }
    return playerAllDisplayEvents.filter(
      (e) =>
        currentTemplate.keyEventTypes.includes(e.type) ||
        currentTemplate.keywords.some((kw) =>
          e.content.toLowerCase().includes(kw.toLowerCase()) ||
          e.rawContent.toLowerCase().includes(kw.toLowerCase())
        ) ||
        e.severity === 'error' ||
        e.severity === 'critical'
    );
  }, [playerAllDisplayEvents, currentTemplate]);

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
      keyEvents: templateKeyEvents,
      markedEvents: playerMarkedEvents,
      timelineSummary,
      csNotes: state.csNotes,
      suggestedActions: [],
    };
  }, [summaryPlayerId, playerAllDisplayEvents, playerMarkedEvents, issueTitle, issueDescription, timelineSummary, state.csNotes, templateKeyEvents]);

  useEffect(() => {
    dispatch({ type: 'SET_SUMMARY', payload: summary });
  }, [summary, dispatch]);

  const generateReportText = (): string => {
    const now = new Date();
    let report = `========================================\n`;
    report += `        游戏客服日志分析报告\n`;
    if (currentTemplate.id !== 'custom') {
      report += `        [${currentTemplate.name}] ${currentTemplate.icon}\n`;
    }
    report += `========================================\n\n`;
    report += `生成时间：${formatTimestamp(now)}\n`;
    report += `报告模板：${currentTemplate.name}\n`;
    report += `玩家编号：${summary.playerId}\n`;
    if (summary.playerName) report += `玩家昵称：${summary.playerName}\n`;
    report += `\n`;

    const sectionRenderers: Record<string, () => string> = {
      problem: () => {
        let section = `----------------------------------------\n`;
        section += `【问题描述】\n\n`;
        section += `📌 问题标题：${summary.issueTitle || '未填写'}\n\n`;
        section += `📝 详细描述：\n${summary.issueDescription || '未填写'}\n\n`;
        return section;
      },
      timeline: () => {
        let section = `----------------------------------------\n`;
        section += `【会话时间线】\n\n`;
        section += `${summary.timelineSummary || '无数据'}\n\n`;
        return section;
      },
      marked: () => {
        let section = `----------------------------------------\n`;
        section += `【已标记异常事件】（共${summary.markedEvents.length}条）\n\n`;

        if (summary.markedEvents.length === 0) {
          section += `暂无已标记事件\n\n`;
        } else {
          summary.markedEvents.forEach((event, idx) => {
            const group = event.isMergedRep ? getMergedGroupEvents(event, state.allEvents) : [event];
            section += `${idx + 1}. [${formatTimestamp(event.timestamp)}] ${getEventTypeLabel(event.type)}`;
            if (event.isMergedRep) section += `（合并${group.length}条）`;
            if (event.markType) {
              const typeLabels: Record<string, string> = {
                freeze: '疑似卡死',
                abnormal: '异常行为',
                bug: '疑似Bug',
                important: '重要事件',
              };
              section += ` [${typeLabels[event.markType] || event.markType}]`;
            }
            section += `\n`;
            const content = eventContentForOutput(event);
            section += content.split('\n').map((line) => `   ${line}`).join('\n');
            section += `\n`;
            if (event.markNote) {
              section += `   💬 客服标记：${event.markNote}\n`;
            }
            section += `\n`;
          });
        }
        return section;
      },
      keyevents: () => {
        let section = `----------------------------------------\n`;
        section += `【关键事件】（${currentTemplate.keyEventTypes.map(getEventTypeLabel).join('/')}/错误）\n\n`;

        const events = summary.keyEvents.slice(0, 50);
        if (events.length === 0) {
          section += `暂无相关关键事件\n\n`;
        } else {
          events.forEach((event, idx) => {
            const group = event.isMergedRep ? getMergedGroupEvents(event, state.allEvents) : [event];
            section += `${idx + 1}. [${formatTimestamp(event.timestamp)}] [${getEventTypeLabel(
              event.type
            )}] [${event.severity.toUpperCase()}]`;
            if (event.isMergedRep) section += `（合并${group.length}条）`;
            section += `\n`;
            const content = eventContentForOutput(event);
            section += content.split('\n').map((line) => `   ${line}`).join('\n');
            section += `\n\n`;
          });

          if (summary.keyEvents.length > 50) {
            section += `... 仅显示前50条，完整日志请查看原始文件 ...\n\n`;
          }
        }
        return section;
      },
      payments: () => {
        let section = `----------------------------------------\n`;
        section += `【支付记录】（共${paymentEvents.length}条）\n\n`;

        if (paymentEvents.length === 0) {
          section += `暂无支付相关记录\n\n`;
        } else {
          paymentEvents.slice(0, 30).forEach((event, idx) => {
            const group = event.isMergedRep ? getMergedGroupEvents(event, state.allEvents) : [event];
            section += `${idx + 1}. [${formatTimestamp(event.timestamp)}] ${getEventTypeLabel(event.type)}`;
            if (event.isMergedRep) section += `（合并${group.length}条）`;
            if (event.severity !== 'info') {
              section += ` [${event.severity.toUpperCase()}]`;
            }
            section += `\n`;
            const content = eventContentForOutput(event);
            section += content.split('\n').map((line) => `   ${line}`).join('\n');
            section += `\n\n`;
          });

          if (paymentEvents.length > 30) {
            section += `... 仅显示前30条支付记录 ...\n\n`;
          }
        }
        return section;
      },
      items: () => {
        let section = `----------------------------------------\n`;
        section += `【道具变更记录】（共${itemChangeEvents.length}条）\n\n`;

        if (itemChangeEvents.length === 0) {
          section += `暂无道具变更记录\n\n`;
        } else {
          itemChangeEvents.slice(0, 30).forEach((event, idx) => {
            const group = event.isMergedRep ? getMergedGroupEvents(event, state.allEvents) : [event];
            section += `${idx + 1}. [${formatTimestamp(event.timestamp)}] ${getEventTypeLabel(event.type)}`;
            if (event.isMergedRep) section += `（合并${group.length}条）`;
            if (event.severity !== 'info') {
              section += ` [${event.severity.toUpperCase()}]`;
            }
            section += `\n`;
            const content = eventContentForOutput(event);
            section += content.split('\n').map((line) => `   ${line}`).join('\n');
            section += `\n\n`;
          });

          if (itemChangeEvents.length > 30) {
            section += `... 仅显示前30条道具变更记录 ...\n\n`;
          }
        }
        return section;
      },
      notes: () => {
        let section = `----------------------------------------\n`;
        section += `【客服备注】\n\n`;

        if (summary.csNotes.length === 0) {
          section += `暂无备注\n`;
        } else {
          summary.csNotes.forEach((note, idx) => {
            section += `${idx + 1}. ${note}\n`;
          });
        }
        section += `\n`;
        return section;
      },
    };

    currentTemplate.sectionOrder.forEach((section) => {
      const renderer = sectionRenderers[section];
      if (renderer) {
        report += renderer();
      }
    });

    report += `========================================\n`;
    report += `        报告结束\n`;
    report += `========================================\n`;

    return report;
  };

  const copyReport = async () => {
    if (!window.electronAPI) {
      addNotification('copy', 'not_supported', '当前环境不支持复制操作', '请在桌面应用中使用此功能');
      return;
    }
    try {
      const text = generateReportText();
      const result = await window.electronAPI.copyToClipboard(text);
      if (result === true) {
        addNotification('copy', 'success', `完整报告已复制到剪贴板`, `共${text.length}字符`);
      } else if (result === false) {
        addNotification('copy', 'failed', '复制失败', '请重试或手动复制');
      } else if (typeof result === 'object' && result !== null) {
        const res = result as { success: boolean; error?: string };
        if (res.success) {
          addNotification('copy', 'success', `完整报告已复制到剪贴板`, `共${text.length}字符`);
        } else {
          addNotification('copy', 'failed', '复制失败', res.error);
        }
      }
    } catch (err) {
      addNotification('copy', 'failed', '复制失败', String(err));
    }
  };

  const copyKeySnippet = async () => {
    if (!window.electronAPI) {
      addNotification('copy', 'not_supported', '当前环境不支持复制操作', '请在桌面应用中使用此功能');
      return;
    }
    if (playerMarkedEvents.length === 0) {
      addNotification('copy', 'cancelled', '没有可复制的关键片段', '请先在异常标记页面标记相关事件');
      return;
    }
    try {
      const text = playerMarkedEvents
        .map((e) => {
          const content = eventContentForOutput(e);
          const prefix = `[${formatTimestamp(e.timestamp)}] ${getEventTypeLabel(e.type)}`;
          return `${prefix}${
            e.isMergedRep ? `（合并${getMergedGroupEvents(e, state.allEvents).length}条）` : ''
          }: ${content}${e.markNote ? ` (${e.markNote})` : ''}`;
        })
        .join('\n');
      const result = await window.electronAPI.copyToClipboard(text);
      if (result === true) {
        addNotification('copy', 'success', `已复制${playerMarkedEvents.length}条关键片段`, `共${text.length}字符`);
      } else if (result === false) {
        addNotification('copy', 'failed', '复制失败', '请重试或手动复制');
      } else if (typeof result === 'object' && result !== null) {
        const res = result as { success: boolean; error?: string };
        if (res.success) {
          addNotification('copy', 'success', `已复制${playerMarkedEvents.length}条关键片段`, `共${text.length}字符`);
        } else {
          addNotification('copy', 'failed', '复制失败', res.error);
        }
      }
    } catch (err) {
      addNotification('copy', 'failed', '复制失败', String(err));
    }
  };

  const exportReport = async () => {
    if (!window.electronAPI) {
      addNotification('export', 'not_supported', '当前环境不支持导出操作', '请在桌面应用中使用此功能，或手动复制报告内容保存');
      return;
    }
    try {
      const defaultName = `game-log-report-${currentTemplate.id}-${summary.playerId}-${Date.now()}.txt`;
      const text = generateReportText();
      const result = await window.electronAPI.exportReport(text, defaultName);

      if (result === null || result === undefined) {
        addNotification('export', 'cancelled', '导出已取消', '您取消了文件保存对话框');
      } else if (result === false) {
        addNotification('export', 'failed', '导出失败', '请检查磁盘空间或权限');
      } else if (typeof result === 'boolean' && result === true) {
        addNotification('export', 'success', '报告导出成功', `文件已保存`);
      } else if (typeof result === 'string') {
        addNotification('export', 'success', '报告导出成功', `文件已保存至：${result}`);
      } else if (typeof result === 'object' && result !== null) {
        const res = result as { success: boolean; filePath?: string; error?: string; cancelled?: boolean };
        if (res.cancelled) {
          addNotification('export', 'cancelled', '导出已取消', '您取消了文件保存对话框');
        } else if (res.success && res.filePath) {
          addNotification('export', 'success', '报告导出成功', `文件已保存至：${res.filePath}`);
        } else if (res.success) {
          addNotification('export', 'success', '报告导出成功', `文件已保存`);
        } else {
          addNotification('export', 'failed', '导出失败', res.error || '未知错误');
        }
      }
    } catch (err) {
      addNotification('export', 'failed', '导出失败', String(err));
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

        <div className="form-group">
          <label className="label">报告模板</label>
          <div className="template-grid">
            {REPORT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => handleTemplateChange(template.id)}
              >
                <div className="template-icon">{template.icon}</div>
                <div className="template-name">{template.name}</div>
                <div className="template-desc">{template.description}</div>
              </button>
            ))}
          </div>
        </div>

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
