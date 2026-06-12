import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ImportWindow from './components/ImportWindow';
import TimelineWindow from './components/TimelineWindow';
import SearchWindow from './components/SearchWindow';
import MarkWindow from './components/MarkWindow';
import SummaryWindow from './components/SummaryWindow';
import type { WindowId } from '@shared/types';

const TABS: { id: WindowId; label: string; icon: string }[] = [
  { id: 'import', label: '日志导入', icon: '📂' },
  { id: 'timeline', label: '玩家时间线', icon: '📊' },
  { id: 'search', label: '事件搜索', icon: '🔍' },
  { id: 'mark', label: '异常标记', icon: '🏷️' },
  { id: 'summary', label: '工单摘要', icon: '📝' },
];

const AppContent: React.FC = () => {
  const { state, dispatch } = useApp();

  const renderWindow = () => {
    switch (state.activeWindow) {
      case 'import':
        return <ImportWindow />;
      case 'timeline':
        return <TimelineWindow />;
      case 'search':
        return <SearchWindow />;
      case 'mark':
        return <MarkWindow />;
      case 'summary':
        return <SummaryWindow />;
      default:
        return <ImportWindow />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-icon">🎮</span>
          <span>游戏日志分析平台</span>
        </div>
        <div className="flex items-center gap-3">
          {state.allEvents.length > 0 && (
            <>
              <span className="text-sm text-muted">
                已加载 <span className="text-primary font-mono">{state.allEvents.length}</span> 条事件
              </span>
              {state.markedEvents.size > 0 && (
                <span className="text-sm text-muted">
                  已标记 <span className="text-primary font-mono">{state.markedEvents.size}</span> 条
                </span>
              )}
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (confirm('确定要清空所有已导入的日志数据吗？')) {
                    dispatch({ type: 'RESET_ALL' });
                  }
                }}
              >
                🗑️ 清空数据
              </button>
            </>
          )}
        </div>
      </header>

      <nav className="app-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${state.activeWindow === tab.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_WINDOW', payload: tab.id })}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-content">{renderWindow()}</main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
