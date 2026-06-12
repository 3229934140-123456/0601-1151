"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialState = void 0;
exports.appReducer = appReducer;
exports.initialState = {
    logFiles: [],
    allEvents: [],
    filteredEvents: [],
    selectedPlayerId: null,
    currentFilter: {},
    savedFilters: {},
    selectedEventIds: [],
    markedEvents: new Map(),
    mergedEventGroups: [],
    csNotes: [],
    summary: null,
    activeWindow: 'import',
    isLoading: false,
    loadingProgress: 0,
    loadingMessage: '',
};
function appReducer(state, action) {
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
            if (state.selectedEventIds.includes(action.payload))
                return state;
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
            const newAllEvents = state.allEvents.map((e) => e.id === action.payload.id
                ? { ...e, isMarked: true, markNote: action.payload.note, markType: action.payload.markType }
                : e);
            return {
                ...state,
                markedEvents: newMarked,
                allEvents: newAllEvents,
                filteredEvents: state.filteredEvents.map((e) => e.id === action.payload.id
                    ? { ...e, isMarked: true, markNote: action.payload.note, markType: action.payload.markType }
                    : e),
            };
        }
        case 'UNMARK_EVENT': {
            const newMarked = new Map(state.markedEvents);
            newMarked.delete(action.payload);
            return {
                ...state,
                markedEvents: newMarked,
                allEvents: state.allEvents.map((e) => e.id === action.payload ? { ...e, isMarked: false, markNote: undefined, markType: undefined } : e),
                filteredEvents: state.filteredEvents.map((e) => e.id === action.payload ? { ...e, isMarked: false, markNote: undefined, markType: undefined } : e),
            };
        }
        case 'MERGE_EVENTS': {
            const mergedIds = action.payload;
            const newAllEvents = state.allEvents.map((e) => mergedIds.includes(e.id) ? { ...e, isMerged: true, mergedIds } : e);
            return {
                ...state,
                allEvents: newAllEvents,
                filteredEvents: state.filteredEvents.map((e) => mergedIds.includes(e.id) ? { ...e, isMerged: true, mergedIds } : e),
                mergedEventGroups: [...state.mergedEventGroups, mergedIds],
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
                filteredEvents: state.filteredEvents.map((e) => e.id === action.payload.id ? action.payload : e),
            };
        case 'RESET_ALL':
            return {
                ...exports.initialState,
                savedFilters: state.savedFilters,
                activeWindow: 'import',
            };
        default:
            return state;
    }
}
