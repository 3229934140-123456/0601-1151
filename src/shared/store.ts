import type { LogEvent, LogFile, SearchFilter, WorkTicketSummary } from './types';

export interface AppState {
  logFiles: LogFile[];
  allEvents: LogEvent[];
  filteredEvents: LogEvent[];
  selectedPlayerId: string | null;
  currentFilter: SearchFilter;
  savedFilters: Record<string, SearchFilter>;
  selectedEventIds: string[];
  markedEvents: Map<string, { note: string; markType: 'freeze' | 'abnormal' | 'bug' | 'important' }>;
  mergedEventGroups: string[][];
  mergedRepresentatives: Map<string, string[]>;
  csNotes: string[];
  summary: WorkTicketSummary | null;
  activeWindow: 'import' | 'timeline' | 'search' | 'mark' | 'summary';
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
}

export const initialState: AppState = {
  logFiles: [],
  allEvents: [],
  filteredEvents: [],
  selectedPlayerId: null,
  currentFilter: {},
  savedFilters: {},
  selectedEventIds: [],
  markedEvents: new Map(),
  mergedEventGroups: [],
  mergedRepresentatives: new Map(),
  csNotes: [],
  summary: null,
  activeWindow: 'import',
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
};

export type AppAction =
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; progress?: number; message?: string } }
  | { type: 'ADD_LOG_FILES'; payload: LogFile[] }
  | { type: 'SET_ALL_EVENTS'; payload: LogEvent[] }
  | { type: 'SET_FILTERED_EVENTS'; payload: LogEvent[] }
  | { type: 'SET_SELECTED_PLAYER'; payload: string | null }
  | { type: 'SET_CURRENT_FILTER'; payload: SearchFilter }
  | { type: 'SET_SAVED_FILTERS'; payload: Record<string, SearchFilter> }
  | { type: 'ADD_SELECTED_EVENT'; payload: string }
  | { type: 'REMOVE_SELECTED_EVENT'; payload: string }
  | { type: 'CLEAR_SELECTED_EVENTS' }
  | {
      type: 'MARK_EVENT';
      payload: { id: string; note: string; markType: 'freeze' | 'abnormal' | 'bug' | 'important' };
    }
  | { type: 'UNMARK_EVENT'; payload: string }
  | { type: 'MERGE_EVENTS'; payload: string[] }
  | { type: 'ADD_CS_NOTE'; payload: string }
  | { type: 'REMOVE_CS_NOTE'; payload: number }
  | { type: 'SET_SUMMARY'; payload: WorkTicketSummary | null }
  | { type: 'SET_ACTIVE_WINDOW'; payload: AppState['activeWindow'] }
  | { type: 'UPDATE_EVENT'; payload: LogEvent }
  | { type: 'RESET_ALL' };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingProgress: action.payload.progress ?? state.loadingProgress,
        loadingMessage: action.payload.message ?? state.loadingMessage,
      };

    case 'ADD_LOG_FILES':
      return {
        ...state,
        logFiles: [...state.logFiles, ...action.payload],
      };

    case 'SET_ALL_EVENTS':
      return {
        ...state,
        allEvents: action.payload,
        filteredEvents: action.payload,
      };

    case 'SET_FILTERED_EVENTS':
      return {
        ...state,
        filteredEvents: action.payload,
      };

    case 'SET_SELECTED_PLAYER':
      return {
        ...state,
        selectedPlayerId: action.payload,
      };

    case 'SET_CURRENT_FILTER':
      return {
        ...state,
        currentFilter: action.payload,
      };

    case 'SET_SAVED_FILTERS':
      return {
        ...state,
        savedFilters: action.payload,
      };

    case 'ADD_SELECTED_EVENT':
      if (state.selectedEventIds.includes(action.payload)) return state;
      return {
        ...state,
        selectedEventIds: [...state.selectedEventIds, action.payload],
      };

    case 'REMOVE_SELECTED_EVENT':
      return {
        ...state,
        selectedEventIds: state.selectedEventIds.filter((id) => id !== action.payload),
      };

    case 'CLEAR_SELECTED_EVENTS':
      return {
        ...state,
        selectedEventIds: [],
      };

    case 'MARK_EVENT': {
      const newMarked = new Map(state.markedEvents);
      newMarked.set(action.payload.id, { note: action.payload.note, markType: action.payload.markType });
      const newAllEvents = state.allEvents.map((e) =>
        e.id === action.payload.id
          ? { ...e, isMarked: true, markNote: action.payload.note, markType: action.payload.markType }
          : e
      );
      return {
        ...state,
        markedEvents: newMarked,
        allEvents: newAllEvents,
        filteredEvents: state.filteredEvents.map((e) =>
          e.id === action.payload.id
            ? { ...e, isMarked: true, markNote: action.payload.note, markType: action.payload.markType }
            : e
        ),
      };
    }

    case 'UNMARK_EVENT': {
      const newMarked = new Map(state.markedEvents);
      newMarked.delete(action.payload);
      return {
        ...state,
        markedEvents: newMarked,
        allEvents: state.allEvents.map((e) =>
          e.id === action.payload ? { ...e, isMarked: false, markNote: undefined, markType: undefined } : e
        ),
        filteredEvents: state.filteredEvents.map((e) =>
          e.id === action.payload ? { ...e, isMarked: false, markNote: undefined, markType: undefined } : e
        ),
      };
    }

    case 'MERGE_EVENTS': {
      const mergedIds = action.payload;
      if (mergedIds.length < 2) return state;

      const sorted = [...mergedIds].sort((a, b) => {
        const ea = state.allEvents.find((e) => e.id === a);
        const eb = state.allEvents.find((e) => e.id === b);
        if (!ea || !eb) return 0;
        return ea.timestamp.getTime() - eb.timestamp.getTime();
      });
      const repId = sorted[0];

      const newReps = new Map(state.mergedRepresentatives);
      newReps.set(repId, sorted);

      const newAllEvents = state.allEvents.map((e) => {
        if (!sorted.includes(e.id)) return e;
        if (e.id === repId) {
          return {
            ...e,
            isMerged: true,
            mergedIds: sorted,
            isMergedRep: true,
          };
        }
        return {
          ...e,
          isMerged: true,
          mergedIds: sorted,
          isMergedRep: false,
          mergedRepId: repId,
        };
      });

      return {
        ...state,
        allEvents: newAllEvents,
        filteredEvents: state.filteredEvents.map((e) => {
          if (!sorted.includes(e.id)) return e;
          if (e.id === repId) {
            return { ...e, isMerged: true, mergedIds: sorted, isMergedRep: true };
          }
          return { ...e, isMerged: true, mergedIds: sorted, isMergedRep: false, mergedRepId: repId };
        }),
        mergedEventGroups: [...state.mergedEventGroups, sorted],
        mergedRepresentatives: newReps,
      };
    }

    case 'ADD_CS_NOTE':
      return {
        ...state,
        csNotes: [...state.csNotes, action.payload],
      };

    case 'REMOVE_CS_NOTE':
      return {
        ...state,
        csNotes: state.csNotes.filter((_, i) => i !== action.payload),
      };

    case 'SET_SUMMARY':
      return {
        ...state,
        summary: action.payload,
      };

    case 'SET_ACTIVE_WINDOW':
      return {
        ...state,
        activeWindow: action.payload,
      };

    case 'UPDATE_EVENT':
      return {
        ...state,
        allEvents: state.allEvents.map((e) => (e.id === action.payload.id ? action.payload : e)),
        filteredEvents: state.filteredEvents.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      };

    case 'RESET_ALL':
      return {
        ...initialState,
        savedFilters: state.savedFilters,
        activeWindow: 'import',
        mergedRepresentatives: new Map(),
      };

    default:
      return state;
  }
}

export function getDisplayEvents(events: LogEvent[]): LogEvent[] {
  return events.filter((e) => !e.isMerged || e.isMergedRep);
}

export function getMergedGroupEvents(repEvent: LogEvent, allEvents: LogEvent[]): LogEvent[] {
  if (!repEvent.mergedIds || !repEvent.isMergedRep) return [repEvent];
  return repEvent.mergedIds
    .map((id) => allEvents.find((e) => e.id === id))
    .filter((e): e is LogEvent => !!e)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function buildMergedContent(repEvent: LogEvent, allEvents: LogEvent[]): string {
  const group = getMergedGroupEvents(repEvent, allEvents);
  if (group.length <= 1) return repEvent.content;
  const parts = group.map((e) => `[${e.rawTimestamp || ''}] ${e.content}`.trim());
  return `【合并${group.length}条记录】\n${parts.join('\n')}`;
}

export function buildMergedRawContent(repEvent: LogEvent, allEvents: LogEvent[]): string {
  const group = getMergedGroupEvents(repEvent, allEvents);
  if (group.length <= 1) return repEvent.rawContent;
  return group.map((e) => e.rawContent).join('\n');
}
