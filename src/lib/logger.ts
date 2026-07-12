import fs from 'fs'
import path from 'path'

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  category: 'webhook' | 'automation' | 'ai' | 'database' | 'general'
  message: string
  details?: string
}

let logsInMemory: LogEntry[] = [
  {
    id: 'log-init',
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'general',
    message: 'StrixMind logging engine successfully initialized.',
    details: 'Log stream active. Temporary storage in memory and Vercel-compatible /tmp mount established.'
  }
]

// Vercel-compatible writeable temp file path
const LOG_FILE_PATH = path.join('/tmp', 'strixmind_logs.json')

function loadLogs() {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const content = fs.readFileSync(LOG_FILE_PATH, 'utf-8')
      const loaded = JSON.parse(content)
      if (Array.isArray(loaded)) {
        const map = new Map<string, LogEntry>()
        // Load file logs
        loaded.forEach(l => {
          if (l && l.id) map.set(l.id, l)
        })
        // Merge with memory logs (newest takes precedence)
        logsInMemory.forEach(l => {
          if (l && l.id) map.set(l.id, l)
        })
        logsInMemory = Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      }
    }
  } catch (e) {
    console.error('[Logger] Failed to load logs from file:', e)
  }
}

function saveLogs() {
  try {
    const parentDir = path.dirname(LOG_FILE_PATH)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logsInMemory.slice(0, 100), null, 2), 'utf-8')
  } catch (e) {
    // Graceful fallback for environments where file system is absolutely read-only
    console.warn('[Logger] Write failed, falling back to pure in-memory logs:', e)
  }
}

// Initial hydration
if (typeof window === 'undefined') {
  loadLogs()
}

export function addLog(
  level: 'info' | 'warn' | 'error' | 'success',
  category: 'webhook' | 'automation' | 'ai' | 'database' | 'general',
  message: string,
  details?: any
) {
  const entry: LogEntry = {
    id: 'log-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details: !details ? undefined : typeof details === 'string' ? details : JSON.stringify(details, null, 2)
  }
  
  logsInMemory.unshift(entry)
  if (logsInMemory.length > 200) {
    logsInMemory = logsInMemory.slice(0, 200)
  }
  saveLogs()
}

export function getLogs(): LogEntry[] {
  if (typeof window === 'undefined') {
    loadLogs()
  }
  return logsInMemory
}

export function clearLogs() {
  logsInMemory = []
  saveLogs()
}
