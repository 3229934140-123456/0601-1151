"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLogLine = parseLogLine;
exports.parseLogContent = parseLogContent;
exports.parseLogFiles = parseLogFiles;
exports.extractUniquePlayerIds = extractUniquePlayerIds;
exports.getPlayerEvents = getPlayerEvents;
exports.buildPlayerSessions = buildPlayerSessions;
exports.formatDuration = formatDuration;
exports.formatTimestamp = formatTimestamp;
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
function parseTimestamp(raw) {
    const patterns = [
        /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/,
        /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})/,
        /\[(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})\]/,
    ];
    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
            let year, month, day;
            if (match[1].length === 4) {
                year = parseInt(match[1], 10);
                month = parseInt(match[2], 10);
                day = parseInt(match[3], 10);
            }
            else {
                year = parseInt(match[3], 10);
                month = parseInt(match[1], 10);
                day = parseInt(match[2], 10);
            }
            const hour = parseInt(match[4] || '0', 10);
            const minute = parseInt(match[5] || '0', 10);
            const second = parseInt(match[6] || '0', 10);
            const date = new Date(year, month - 1, day, hour, minute, second);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    return null;
}
function detectEventType(content) {
    const lower = content.toLowerCase();
    if (/登录|login|connected|online/i.test(lower))
        return 'login';
    if (/登出|logout|disconnect|offline/i.test(lower) && !/异常|error|crash/i.test(lower))
        return 'logout';
    if (/掉线|断连|disconnect|timeout|connection lost/i.test(lower))
        return 'disconnect';
    if (/崩溃|crash|fatal|panic/i.test(lower))
        return 'crash';
    if (/道具|背包|物品|item|inventory|bag|获得|使用|消耗|删除/i.test(lower))
        return 'item_change';
    if (/支付|充值|付款|payment|pay|purchase|order|订单|钻石|金币.*充值/i.test(lower))
        return 'payment';
    if (/任务|quest|mission/i.test(lower))
        return 'quest';
    if (/战斗|combat|fight|battle|attack|kill|die|death/i.test(lower))
        return 'combat';
    if (/聊天|chat|message|say|talk/i.test(lower))
        return 'chat';
    if (/系统|system|server|维护|update/i.test(lower))
        return 'system';
    return 'unknown';
}
function detectSeverity(content) {
    const lower = content.toLowerCase();
    if (/fatal|critical|panic|崩溃|严重|卡死|无法登录/i.test(lower))
        return 'critical';
    if (/error|exception|fail|failed|错误|异常|失败/i.test(lower))
        return 'error';
    if (/warn|warning|注意|警告/i.test(lower))
        return 'warning';
    return 'info';
}
function extractPlayerId(content) {
    const patterns = [
        /player[_\s]?id[:\s]+(\d+)/i,
        /玩家[_\s]?id[:\s]+(\d+)/i,
        /用户[_\s]?id[:\s]+(\d+)/i,
        /uid[:\s]+(\d+)/i,
        /pid[:\s]+(\d+)/i,
        /\[(\d{6,})\]/,
        /#(\d{6,})/,
    ];
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}
function extractPlayerName(content) {
    const patterns = [
        /player[_\s]?name[:\s]+["']?([^"'\s,，]+)["']?/i,
        /玩家名[:\s]+["']?([^"'\s,，]+)["']?/i,
        /角色名[:\s]+["']?([^"'\s,，]+)["']?/i,
        /name[:\s]+["']?([^"'\s,，]{2,})["']?/i,
    ];
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return undefined;
}
function extractDetails(content) {
    const details = {};
    const kvPattern = /(\w+(?:_\w+)*)[:=]\s*["']?([^"'\s,，]+)["']?/gi;
    let match;
    while ((match = kvPattern.exec(content)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2];
        if (!isNaN(Number(value)) && value !== '') {
            details[key] = Number(value);
        }
        else if (value === 'true' || value === 'false') {
            details[key] = value === 'true';
        }
        else {
            details[key] = value;
        }
    }
    return Object.keys(details).length > 0 ? details : undefined;
}
function parseLogLine(line, index, fileName) {
    if (!line.trim())
        return null;
    const timestamp = parseTimestamp(line) || new Date();
    const playerId = extractPlayerId(line) || 'unknown';
    const type = detectEventType(line);
    const severity = detectSeverity(line);
    return {
        id: generateId(),
        timestamp,
        rawTimestamp: line.match(/\[[^\]]+\]|\d{4}[^]*\d{2}:\d{2}:\d{2}/)?.[0] || '',
        type,
        playerId,
        playerName: extractPlayerName(line),
        content: line.replace(/\[[^\]]+\]\s*/, '').trim() || line,
        rawContent: line,
        details: extractDetails(line),
        severity,
    };
}
function parseLogContent(content, fileName) {
    const lines = content.split(/\r?\n/);
    const events = [];
    lines.forEach((line, index) => {
        const event = parseLogLine(line, index, fileName);
        if (event) {
            events.push(event);
        }
    });
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
function parseLogFiles(files) {
    const allEvents = [];
    for (const file of files) {
        if (file.error)
            continue;
        const events = parseLogContent(file.content, file.name);
        allEvents.push(...events);
    }
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
function extractUniquePlayerIds(events) {
    const ids = new Set();
    for (const event of events) {
        if (event.playerId && event.playerId !== 'unknown') {
            ids.add(event.playerId);
        }
    }
    return Array.from(ids).sort();
}
function getPlayerEvents(events, playerId) {
    return events
        .filter((e) => e.playerId === playerId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
function buildPlayerSessions(events, playerId) {
    const playerEvents = getPlayerEvents(events, playerId);
    if (playerEvents.length === 0)
        return [];
    const sessions = [];
    const loginEvents = playerEvents.filter((e) => e.type === 'login');
    const disconnectEvents = playerEvents.filter((e) => e.type === 'disconnect' || e.type === 'logout' || e.type === 'crash');
    if (loginEvents.length === 0 && playerEvents.length > 0) {
        sessions.push({
            playerId,
            playerName: playerEvents[0].playerName || playerId,
            events: playerEvents,
            loginEvents: [],
            disconnectEvents: disconnectEvents,
            startTime: playerEvents[0].timestamp,
            endTime: playerEvents[playerEvents.length - 1].timestamp,
            totalDuration: (playerEvents[playerEvents.length - 1].timestamp.getTime() -
                playerEvents[0].timestamp.getTime()) /
                1000,
        });
        return sessions;
    }
    let currentEvents = [];
    let currentStart = loginEvents[0]?.timestamp || playerEvents[0].timestamp;
    for (const event of playerEvents) {
        if (event.type === 'login' && currentEvents.length > 0) {
            sessions.push({
                playerId,
                playerName: event.playerName || playerId,
                events: currentEvents,
                loginEvents: currentEvents.filter((e) => e.type === 'login'),
                disconnectEvents: currentEvents.filter((e) => e.type === 'disconnect' || e.type === 'logout' || e.type === 'crash'),
                startTime: currentStart,
                endTime: currentEvents[currentEvents.length - 1].timestamp,
                totalDuration: (currentEvents[currentEvents.length - 1].timestamp.getTime() - currentStart.getTime()) /
                    1000,
            });
            currentEvents = [event];
            currentStart = event.timestamp;
        }
        else {
            currentEvents.push(event);
        }
    }
    if (currentEvents.length > 0) {
        sessions.push({
            playerId,
            playerName: currentEvents[0].playerName || playerId,
            events: currentEvents,
            loginEvents: currentEvents.filter((e) => e.type === 'login'),
            disconnectEvents: currentEvents.filter((e) => e.type === 'disconnect' || e.type === 'logout' || e.type === 'crash'),
            startTime: currentStart,
            endTime: currentEvents[currentEvents.length - 1].timestamp,
            totalDuration: (currentEvents[currentEvents.length - 1].timestamp.getTime() - currentStart.getTime()) /
                1000,
        });
    }
    return sessions;
}
function formatDuration(seconds) {
    if (seconds < 60)
        return `${Math.floor(seconds)}秒`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}时${mins}分`;
}
function formatTimestamp(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
