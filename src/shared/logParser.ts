import type { LogEvent, LogEventType, LogFile, PlayerSession, FileImportDetail, FileParseStatus, ImportSummary, ImportBatch, ProblemChain } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function parseTimestamp(raw: string): Date | null {
  const patterns = [
    /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/,
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})/,
    /\[(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})\]/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      let year: number, month: number, day: number;
      if (match[1].length === 4) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else {
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

function detectEventType(content: string): LogEventType {
  const lower = content.toLowerCase();

  if (/登录|login|connected|online/i.test(lower) && !/异常|error|crash|fail|失败/i.test(lower)) return 'login';
  if (/登出|logout|offline/i.test(lower) && !/异常|error|crash|fail|失败|掉线|断/i.test(lower)) return 'logout';
  if (/掉线|断连|disconnect|timeout|connection.?lost|断开连接|网络断|连接中断|连接超时|网络超时|net.*disconnect|连接异常断|异常断开/i.test(lower)) return 'disconnect';
  if (/崩溃|crash|fatal|panic|闪退|卡死|无响应|not.?responding|hang|freeze/i.test(lower)) return 'crash';
  if (/道具|背包|物品|item|inventory|bag|获得|使用|消耗|删除|捡起|丢弃|购买成功|发放/i.test(lower)) return 'item_change';
  if (/支付|充值|付款|payment|pay|purchase|order|订单|钻石.*充值|recharge|到账|扣费|退款/i.test(lower)) return 'payment';
  if (/任务|quest|mission/i.test(lower)) return 'quest';
  if (/战斗|combat|fight|battle|attack|kill|die|death/i.test(lower)) return 'combat';
  if (/聊天|chat|message|say|talk/i.test(lower)) return 'chat';
  if (/系统|system|server|维护|update|启动|关闭服务/i.test(lower)) return 'system';

  return 'unknown';
}

function detectSeverity(content: string): 'info' | 'warning' | 'error' | 'critical' {
  const lower = content.toLowerCase();

  if (/fatal|critical|panic|崩溃|严重|卡死|无法登录/i.test(lower)) return 'critical';
  if (/error|exception|fail|failed|错误|异常|失败/i.test(lower)) return 'error';
  if (/warn|warning|注意|警告/i.test(lower)) return 'warning';

  return 'info';
}

function extractPlayerId(content: string): string | null {
  const patterns = [
    /player[_\s]?id[:\s]+(\d+)/i,
    /玩家[_\s]?id[:\s]+(\d+)/i,
    /用户[_\s]?id[:\s]+(\d+)/i,
    /uid[:\s]+(\d+)/i,
    /pid[:\s]+(\d+)/i,
    /玩家\s*[:：]?\s*(\d{5,})/,
    /\[(\d{6,})\]/,
    /#(\d{6,})/,
    /与玩家\s*(\d{5,})/,
    /玩家\s*#?\s*(\d{5,})/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractPlayerName(content: string): string | undefined {
  const patterns = [
    /player[_\s]?name[:\s]+["']?([^"'\s,，]+)["']?/i,
    /玩家名[:\s]+["']?([^"'\s,，]+)["']?/i,
    /角色名[:\s]+["']?([^"'\s,，]+)["']?/i,
    /name[:\s]+["']?([^"'\s,，]{2,})["']?/i,
    /Player\s+([^\s]+?)\s+(?:LOGIN|登录)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function extractDetails(content: string): Record<string, string | number | boolean> | undefined {
  const details: Record<string, string | number | boolean> = {};

  const kvPattern = /(\w+(?:_\w+)*)[:=]\s*["']?([^"'\s,，]+)["']?/gi;
  let match: RegExpExecArray | null;
  while ((match = kvPattern.exec(content)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2];

    if (!isNaN(Number(value)) && value !== '') {
      details[key] = Number(value);
    } else if (value === 'true' || value === 'false') {
      details[key] = value === 'true';
    } else {
      details[key] = value;
    }
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

function isLikelyPlayerEvent(content: string): boolean {
  return /玩家|进入|退出|副本|任务|战斗|道具|背包|装备|强化|充值|支付|聊天|组队|登录|登出|掉线|崩溃/i.test(content);
}

export function parseLogLine(
  line: string,
  index: number,
  fileName: string,
  lastKnownPlayerId?: string,
  lastKnownPlayerName?: string
): LogEvent | null {
  if (!line.trim()) return null;

  const timestamp = parseTimestamp(line) || new Date();
  let playerId = extractPlayerId(line);
  let playerName = extractPlayerName(line);
  const type = detectEventType(line);
  const severity = detectSeverity(line);

  if (!playerId && isLikelyPlayerEvent(line) && lastKnownPlayerId) {
    playerId = lastKnownPlayerId;
  }

  if (!playerName && lastKnownPlayerName && playerId === lastKnownPlayerId) {
    playerName = lastKnownPlayerName;
  }

  return {
    id: generateId(),
    timestamp,
    rawTimestamp: line.match(/\[[^\]]+\]|\d{4}[^]*\d{2}:\d{2}:\d{2}/)?.[0] || '',
    type,
    playerId: playerId || 'unknown',
    playerName,
    content: line.replace(/\[[^\]]+\]\s*/, '').trim() || line,
    rawContent: line,
    details: extractDetails(line),
    severity,
  };
}

export function parseLogContent(content: string, fileName: string): LogEvent[] {
  const lines = content.split(/\r?\n/);
  const events: LogEvent[] = [];
  let lastKnownPlayerId: string | undefined;
  let lastKnownPlayerName: string | undefined;
  let lastEventTime: Date | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const event = parseLogLine(line, index, fileName, lastKnownPlayerId, lastKnownPlayerName);
    if (!event) continue;

    if (lastEventTime && event.timestamp.getTime() - lastEventTime.getTime() > 1000 * 60 * 30) {
      lastKnownPlayerId = undefined;
      lastKnownPlayerName = undefined;
    }

    if (event.playerId && event.playerId !== 'unknown') {
      lastKnownPlayerId = event.playerId;
      if (event.playerName) {
        lastKnownPlayerName = event.playerName;
      }
    }

    lastEventTime = event.timestamp;
    events.push(event);
  }

  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function parseLogFiles(files: LogFile[]): LogEvent[] {
  const allEvents: LogEvent[] = [];

  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

  for (const file of sortedFiles) {
    if (file.error) continue;
    const events = parseLogContent(file.content, file.name);
    allEvents.push(...events);
  }

  return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function extractUniquePlayerIds(events: LogEvent[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.playerId && event.playerId !== 'unknown') {
      ids.add(event.playerId);
    }
  }
  return Array.from(ids).sort();
}

export function getPlayerEvents(events: LogEvent[], playerId: string): LogEvent[] {
  return events
    .filter((e) => e.playerId === playerId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function buildPlayerSessions(events: LogEvent[], playerId: string): PlayerSession[] {
  const playerEvents = getPlayerEvents(events, playerId);
  if (playerEvents.length === 0) return [];

  const sessions: PlayerSession[] = [];
  const loginEvents = playerEvents.filter((e) => e.type === 'login');
  const disconnectEvents = playerEvents.filter(
    (e) => e.type === 'disconnect' || e.type === 'logout' || e.type === 'crash'
  );

  if (loginEvents.length === 0 && playerEvents.length > 0) {
    sessions.push({
      playerId,
      playerName: playerEvents[0].playerName || playerId,
      events: playerEvents,
      loginEvents: [],
      disconnectEvents: disconnectEvents,
      startTime: playerEvents[0].timestamp,
      endTime: playerEvents[playerEvents.length - 1].timestamp,
      totalDuration:
        (playerEvents[playerEvents.length - 1].timestamp.getTime() -
          playerEvents[0].timestamp.getTime()) /
        1000,
    });
    return sessions;
  }

  let currentEvents: LogEvent[] = [];
  let currentStart = loginEvents[0]?.timestamp || playerEvents[0].timestamp;

  for (const event of playerEvents) {
    if (event.type === 'login' && currentEvents.length > 0) {
      sessions.push({
        playerId,
        playerName: event.playerName || playerId,
        events: currentEvents,
        loginEvents: currentEvents.filter((e) => e.type === 'login'),
        disconnectEvents: currentEvents.filter(
          (e) => e.type === 'disconnect' || e.type === 'logout' || e.type === 'crash'
        ),
        startTime: currentStart,
        endTime: currentEvents[currentEvents.length - 1].timestamp,
        totalDuration:
          (currentEvents[currentEvents.length - 1].timestamp.getTime() - currentStart.getTime()) /
          1000,
      });
      currentEvents = [event];
      currentStart = event.timestamp;
    } else {
      currentEvents.push(event);
    }
  }

  if (currentEvents.length > 0) {
    sessions.push({
      playerId,
      playerName: currentEvents[0].playerName || playerId,
      events: currentEvents,
      loginEvents: currentEvents.filter((e) => e.type === 'login'),
      disconnectEvents: currentEvents.filter(
        (e) => e.type === 'disconnect' || e.type === 'logout' || e.type === 'crash'
      ),
      startTime: currentStart,
      endTime: currentEvents[currentEvents.length - 1].timestamp,
      totalDuration:
        (currentEvents[currentEvents.length - 1].timestamp.getTime() - currentStart.getTime()) /
        1000,
    });
  }

  return sessions;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}时${mins}分`;
}

export function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isJsonLike(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function extractJsonStringValue(obj: unknown, keys: string[]): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const o = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = o[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }
  return undefined;
}

function extractJsonNumberValue(obj: unknown, keys: string[]): number | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const o = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = o[key];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
  }
  return undefined;
}

function parseJsonTimestamp(obj: unknown): Date | null {
  const tsStr = extractJsonStringValue(obj, ['timestamp', 'time', 'datetime', 'created_at', 'createdAt', 'log_time', 'event_time', 't']);
  if (tsStr) {
    const date = parseTimestamp(tsStr);
    if (date) return date;
  }
  const tsNum = extractJsonNumberValue(obj, ['timestamp', 'time', 'ts', 'unix_time']);
  if (tsNum !== undefined) {
    let ms = tsNum;
    if (tsNum < 1e12) ms *= 1000;
    const date = new Date(ms);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function parseJsonPlayerId(obj: unknown): string | null {
  const id = extractJsonStringValue(obj, ['player_id', 'playerId', 'user_id', 'userId', 'uid', 'pid', 'playerid', 'account_id']);
  if (id) return id;
  const idNum = extractJsonNumberValue(obj, ['player_id', 'playerId', 'user_id', 'userId', 'uid', 'pid']);
  if (idNum !== undefined) return String(idNum);
  return null;
}

function parseJsonPlayerName(obj: unknown): string | undefined {
  return extractJsonStringValue(obj, ['player_name', 'playerName', 'user_name', 'userName', 'nickname', 'role_name', 'name']);
}

function parseJsonEventType(obj: unknown): LogEventType {
  const typeStr = extractJsonStringValue(obj, ['event_type', 'eventType', 'type', 'action', 'category', 'event']);
  if (typeStr) {
    return detectEventType(typeStr);
  }
  const content = extractJsonStringValue(obj, ['message', 'content', 'msg', 'detail', 'description', 'data']);
  if (content) {
    return detectEventType(content);
  }
  return 'unknown';
}

function parseJsonSeverity(obj: unknown): 'info' | 'warning' | 'error' | 'critical' {
  const sev = extractJsonStringValue(obj, ['severity', 'level', 'log_level', 'status']);
  if (sev) {
    return detectSeverity(`[${sev}]`);
  }
  const content = extractJsonStringValue(obj, ['message', 'content', 'msg', 'type', 'action']);
  if (content) {
    return detectSeverity(content);
  }
  return 'info';
}

function extractJsonContent(obj: unknown): string {
  const parts: string[] = [];
  if (typeof obj === 'object' && obj !== null) {
    const o = obj as Record<string, unknown>;
    ['action', 'event_type', 'type', 'message', 'content', 'msg', 'detail', 'description'].forEach((key) => {
      if (o[key] !== undefined && o[key] !== null) {
        parts.push(String(o[key]));
      }
    });
    const remaining: Record<string, unknown> = {};
    Object.keys(o).forEach((key) => {
      if (!['timestamp', 'time', 'datetime', 'event_type', 'eventType', 'type', 'action', 'category', 'event', 'message', 'content', 'msg', 'detail', 'description', 'player_id', 'playerId', 'user_id', 'userId', 'uid', 'pid', 'player_name', 'playerName', 'user_name', 'userName', 'nickname', 'role_name', 'name', 'severity', 'level', 'log_level', 'status'].includes(key)) {
        remaining[key] = o[key];
      }
    });
    if (Object.keys(remaining).length > 0) {
      parts.push(JSON.stringify(remaining));
    }
  }
  return parts.join(' ').trim() || JSON.stringify(obj);
}

function parseJsonDetails(obj: unknown): Record<string, string | number | boolean> | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const details: Record<string, string | number | boolean> = {};
  const o = obj as Record<string, unknown>;
  Object.keys(o).forEach((key) => {
    const value = o[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      details[key.toLowerCase()] = value;
    }
  });
  return Object.keys(details).length > 0 ? details : undefined;
}

function eventFromJsonObject(obj: unknown, raw: string, index: number, fileName: string): LogEvent | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const timestamp = parseJsonTimestamp(obj) || new Date();
  const playerId = parseJsonPlayerId(obj) || 'unknown';
  const playerName = parseJsonPlayerName(obj);
  const type = parseJsonEventType(obj);
  const severity = parseJsonSeverity(obj);
  const content = extractJsonContent(obj);
  const details = parseJsonDetails(obj);
  const rawTimestamp = raw.match(/\[[^\]]+\]|\d{4}[^]*\d{2}:\d{2}:\d{2}/)?.[0] || extractJsonStringValue(obj, ['timestamp', 'time', 'datetime', 'created_at']) || '';
  return {
    id: generateId(),
    timestamp,
    rawTimestamp,
    type,
    playerId,
    playerName,
    content,
    rawContent: raw,
    details,
    severity,
  };
}

function parseJsonArray(arr: unknown[], rawLines: string[], fileName: string): { events: LogEvent[]; detail: FileImportDetail } {
  const events: LogEvent[] = [];
  const errors: string[] = [];
  let failedCount = 0;
  arr.forEach((item, index) => {
    try {
      const event = eventFromJsonObject(item, rawLines[index] || JSON.stringify(item), index, fileName);
      if (event) {
        events.push(event);
      } else {
        failedCount++;
        if (errors.length < 5) {
          errors.push(`行${index + 1}: 无法解析JSON对象`);
        }
      }
    } catch (err) {
      failedCount++;
      if (errors.length < 5) {
        errors.push(`行${index + 1}: ${String(err)}`);
      }
    }
  });
  const status: FileParseStatus = failedCount === 0 ? 'success' : events.length > 0 ? 'partial' : 'failed';
  return {
    events,
    detail: {
      path: fileName,
      name: fileName,
      status,
      totalLines: arr.length,
      parsedCount: events.length,
      failedCount,
      sampleErrors: errors.length > 0 ? errors : undefined,
    },
  };
}

function parseJsonContent(content: string, fileName: string): { events: LogEvent[]; detail: FileImportDetail } {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      events: [],
      detail: {
        path: fileName,
        name: fileName,
        status: 'empty',
        totalLines: 0,
        parsedCount: 0,
        failedCount: 0,
        errorMessage: '文件为空',
      },
    };
  }
  if (!isJsonLike(trimmed)) {
    return {
      events: [],
      detail: {
        path: fileName,
        name: fileName,
        status: 'unknown_format',
        totalLines: 0,
        parsedCount: 0,
        failedCount: 0,
        errorMessage: '无法识别为JSON格式',
      },
    };
  }
  if (trimmed.startsWith('[')) {
    const parsed = tryParseJson(trimmed);
    if (Array.isArray(parsed)) {
      return parseJsonArray(parsed, parsed.map((item) => JSON.stringify(item)), fileName);
    }
    if (parsed === null) {
      return {
        events: [],
        detail: {
          path: fileName,
          name: fileName,
          status: 'failed',
          totalLines: 1,
          parsedCount: 0,
          failedCount: 1,
          errorMessage: 'JSON数组解析失败',
        },
      };
    }
  }
  if (trimmed.startsWith('{')) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const events: LogEvent[] = [];
    const errors: string[] = [];
    let failedCount = 0;
    let parsedSingle: LogEvent | null = null;
    if (lines.length === 1) {
      const parsed = tryParseJson(lines[0]);
      if (parsed && typeof parsed === 'object') {
        parsedSingle = eventFromJsonObject(parsed, lines[0], 0, fileName);
        if (parsedSingle) {
          events.push(parsedSingle);
        }
      }
    }
    if (events.length === 0) {
      lines.forEach((line, index) => {
        const lineTrimmed = line.trim();
        if (!lineTrimmed) return;
        const parsed = tryParseJson(lineTrimmed);
        if (parsed && typeof parsed === 'object') {
          const event = eventFromJsonObject(parsed, lineTrimmed, index, fileName);
          if (event) {
            events.push(event);
          } else {
            failedCount++;
            if (errors.length < 5) {
              errors.push(`行${index + 1}: 无法解析JSON对象`);
            }
          }
        } else {
          failedCount++;
          if (errors.length < 5) {
            errors.push(`行${index + 1}: JSON解析失败`);
          }
        }
      });
    }
    const totalLines = lines.length;
    const status: FileParseStatus = failedCount === 0 ? 'success' : events.length > 0 ? 'partial' : 'failed';
    return {
      events,
      detail: {
        path: fileName,
        name: fileName,
        status,
        totalLines,
        parsedCount: events.length,
        failedCount,
        sampleErrors: errors.length > 0 ? errors : undefined,
      },
    };
  }
  return {
    events: [],
    detail: {
      path: fileName,
      name: fileName,
      status: 'unknown_format',
      totalLines: 0,
      parsedCount: 0,
      failedCount: 0,
      errorMessage: '无法识别的JSON格式',
    },
  };
}

function determineFileParseStatus(file: LogFile): FileParseStatus {
  if (file.error) return 'failed';
  if (!file.content || !file.content.trim()) return 'empty';
  return 'success';
}

export function parseLogContentWithDetail(
  content: string,
  fileName: string,
  batchId?: string
): { events: LogEvent[]; detail: FileImportDetail } {
  const isJson = fileName.toLowerCase().endsWith('.json');
  if (isJson) {
    const result = parseJsonContent(content, fileName);
    result.events.forEach((e) => { e.batchId = batchId; });
    result.detail.batchId = batchId;
    return result;
  }
  const lines = content.split(/\r?\n/);
  const events: LogEvent[] = [];
  const errors: string[] = [];
  const sampleSuccessLines: string[] = [];
  const sampleFailedLines: string[] = [];
  let failedCount = 0;
  let unknownCount = 0;
  let lastKnownPlayerId: string | undefined;
  let lastKnownPlayerName: string | undefined;
  let lastEventTime: Date | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      const event = parseLogLine(line, index, fileName, lastKnownPlayerId, lastKnownPlayerName);
      if (!event) {
        failedCount++;
        if (sampleFailedLines.length < 5) {
          sampleFailedLines.push(line.trim().substring(0, 120));
          errors.push(`行${index + 1}: 无法解析`);
        }
        continue;
      }
      if (event.type === 'unknown' && event.playerId === 'unknown') {
        unknownCount++;
        failedCount++;
        if (sampleFailedLines.length < 5) {
          sampleFailedLines.push(line.trim().substring(0, 120));
          errors.push(`行${index + 1}: 内容无法识别为已知事件类型`);
        }
        continue;
      }
      if (lastEventTime && event.timestamp.getTime() - lastEventTime.getTime() > 1000 * 60 * 30) {
        lastKnownPlayerId = undefined;
        lastKnownPlayerName = undefined;
      }
      if (event.playerId && event.playerId !== 'unknown') {
        lastKnownPlayerId = event.playerId;
        if (event.playerName) {
          lastKnownPlayerName = event.playerName;
        }
      }
      lastEventTime = event.timestamp;
      event.batchId = batchId;
      events.push(event);
      if (sampleSuccessLines.length < 5) {
        sampleSuccessLines.push(line.trim().substring(0, 120));
      }
    } catch (err) {
      failedCount++;
      if (sampleFailedLines.length < 5) {
        sampleFailedLines.push(line.trim().substring(0, 120));
        errors.push(`行${index + 1}: ${String(err)}`);
      }
    }
  }
  const totalLines = lines.filter((l) => l.trim()).length;
  const status: FileParseStatus = failedCount === 0
    ? totalLines === 0 ? 'empty' : 'success'
    : events.length > 0
    ? 'partial'
    : totalLines === 0
    ? 'empty'
    : unknownCount === totalLines
    ? 'unknown_format'
    : 'failed';
  return {
    events: events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    detail: {
      path: fileName,
      name: fileName,
      status,
      totalLines,
      parsedCount: events.length,
      failedCount,
      sampleErrors: errors.length > 0 ? errors : undefined,
      sampleSuccessLines: sampleSuccessLines.length > 0 ? sampleSuccessLines : undefined,
      sampleFailedLines: sampleFailedLines.length > 0 ? sampleFailedLines : undefined,
      batchId,
    },
  };
}

export function parseLogFilesWithDetail(
  files: LogFile[],
  existingEvents: LogEvent[] = []
): { events: LogEvent[]; summary: ImportSummary; batch: ImportBatch } {
  const batchId = generateId();
  const allEvents: LogEvent[] = [...existingEvents];
  const details: FileImportDetail[] = [];
  const sourcePaths: string[] = [];
  const sourceZipNames: string[] = [];
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of sortedFiles) {
    if (!sourcePaths.includes(file.path)) sourcePaths.push(file.path);
    if (file.name.includes('/')) {
      const zipName = file.name.split('/')[0];
      if (!sourceZipNames.includes(zipName)) sourceZipNames.push(zipName);
    }
    if (file.error) {
      details.push({
        path: file.path,
        name: file.name,
        size: file.size,
        status: 'failed',
        totalLines: 0,
        parsedCount: 0,
        failedCount: 0,
        errorMessage: file.error,
        batchId,
      });
      continue;
    }
    const { events, detail } = parseLogContentWithDetail(file.content, file.name, batchId);
    detail.size = file.size;
    detail.path = file.path;
    if (file.name.includes('/')) {
      detail.sourceZip = file.name.split('/')[0];
    }
    details.push(detail);
    allEvents.push(...events);
  }
  const summary: ImportSummary = {
    totalFiles: details.length,
    successFiles: details.filter((d) => d.status === 'success').length,
    failedFiles: details.filter((d) => d.status === 'failed' || d.status === 'unknown_format').length,
    emptyFiles: details.filter((d) => d.status === 'empty').length,
    unknownFormatFiles: details.filter((d) => d.status === 'unknown_format').length,
    totalParsedEvents: allEvents.length - existingEvents.length,
    totalFailedLines: details.reduce((sum, d) => sum + d.failedCount, 0),
    details,
  };
  const batch: ImportBatch = {
    id: batchId,
    timestamp: new Date(),
    sourcePaths,
    sourceZipNames,
    fileCount: details.length,
    successFiles: summary.successFiles,
    failedFiles: summary.failedFiles,
    emptyFiles: summary.emptyFiles,
    unknownFormatFiles: summary.unknownFormatFiles,
    totalParsedEvents: summary.totalParsedEvents,
    totalFailedLines: summary.totalFailedLines,
    details,
  };
  return {
    events: allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    summary,
    batch,
  };
}

export function buildProblemChains(events: LogEvent[], playerId: string): ProblemChain[] {
  const playerEvents = events
    .filter((e) => e.playerId === playerId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (playerEvents.length === 0) return [];

  const chains: ProblemChain[] = [];
  const CONTEXT_WINDOW_MS = 5 * 60 * 1000;

  const paymentEvents = playerEvents.filter((e) => e.type === 'payment');
  const crashEvents = playerEvents.filter((e) => e.type === 'crash' || e.type === 'disconnect');
  const itemEvents = playerEvents.filter((e) => e.type === 'item_change');
  const disconnectEvents = playerEvents.filter((e) => e.type === 'disconnect');

  for (const payment of paymentEvents) {
    const related = playerEvents.filter(
      (e) =>
        e.id !== payment.id &&
        Math.abs(e.timestamp.getTime() - payment.timestamp.getTime()) <= CONTEXT_WINDOW_MS
    );
    const hasItemChange = related.some((e) => e.type === 'item_change');
    const hasDisconnect = related.some((e) => e.type === 'disconnect' || e.type === 'crash');
    let description = `支付事件 @ ${formatTimestamp(payment.timestamp)}`;
    if (!hasItemChange) description += ' — 之后未见道具发放记录';
    if (hasDisconnect) description += ' — 附近有断线事件';
    chains.push({
      id: generateId(),
      playerId,
      anchorEvent: payment,
      relatedEvents: related,
      chainType: 'payment_missing',
      startTime: new Date(payment.timestamp.getTime() - CONTEXT_WINDOW_MS),
      endTime: new Date(payment.timestamp.getTime() + CONTEXT_WINDOW_MS),
      description,
    });
  }

  for (const crash of crashEvents) {
    const beforeEvents = playerEvents.filter(
      (e) =>
        e.id !== crash.id &&
        e.timestamp.getTime() <= crash.timestamp.getTime() &&
        e.timestamp.getTime() >= crash.timestamp.getTime() - CONTEXT_WINDOW_MS
    );
    const afterEvents = playerEvents.filter(
      (e) =>
        e.id !== crash.id &&
        e.timestamp.getTime() > crash.timestamp.getTime() &&
        e.timestamp.getTime() <= crash.timestamp.getTime() + CONTEXT_WINDOW_MS
    );
    const related = [...beforeEvents, ...afterEvents];
    const chainType = crash.type === 'crash' ? 'crash_freeze' as const : 'disconnect_anomaly' as const;
    let description = `${crash.type === 'crash' ? '崩溃' : '掉线'} @ ${formatTimestamp(crash.timestamp)}`;
    if (beforeEvents.length > 0) {
      const lastBefore = beforeEvents[beforeEvents.length - 1];
      description += ` — 之前: ${lastBefore.content.substring(0, 40)}`;
    }
    chains.push({
      id: generateId(),
      playerId,
      anchorEvent: crash,
      relatedEvents: related,
      chainType,
      startTime: new Date(crash.timestamp.getTime() - CONTEXT_WINDOW_MS),
      endTime: new Date(crash.timestamp.getTime() + CONTEXT_WINDOW_MS),
      description,
    });
  }

  for (const item of itemEvents) {
    const lower = item.content.toLowerCase();
    if (/丢失|消失|减少|missing|lost|remove|-?\d/.test(lower) || /消耗|删除/.test(lower)) {
      const related = playerEvents.filter(
        (e) =>
          e.id !== item.id &&
          Math.abs(e.timestamp.getTime() - item.timestamp.getTime()) <= CONTEXT_WINDOW_MS
      );
      const hasPayment = related.some((e) => e.type === 'payment');
      let description = `道具变更 @ ${formatTimestamp(item.timestamp)}: ${item.content.substring(0, 50)}`;
      if (!hasPayment) description += ' — 附近无支付记录';
      chains.push({
        id: generateId(),
        playerId,
        anchorEvent: item,
        relatedEvents: related,
        chainType: 'item_missing',
        startTime: new Date(item.timestamp.getTime() - CONTEXT_WINDOW_MS),
        endTime: new Date(item.timestamp.getTime() + CONTEXT_WINDOW_MS),
        description,
      });
    }
  }

  return chains.sort((a, b) => a.anchorEvent.timestamp.getTime() - b.anchorEvent.timestamp.getTime());
}

export function getEventContext(
  event: LogEvent,
  allEvents: LogEvent[],
  contextMinutes: number = 3
): LogEvent[] {
  const windowMs = contextMinutes * 60 * 1000;
  return allEvents
    .filter(
      (e) =>
        e.playerId === event.playerId &&
        Math.abs(e.timestamp.getTime() - event.timestamp.getTime()) <= windowMs
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
