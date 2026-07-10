'use client'
import { useState, useRef, useCallback } from 'react'
import { useCSVImport, useBulkAnalyzeLeads, useLeadOutreach } from '@/lib/hooks'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Sparkles, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface ImportResult {
  imported: number
  failed: number
  total: number
  errors: { row: number; error: string }[]
  lead_ids?: string[]
}

interface OutreachResult {
  sent: number
  failed: number
  skipped: number
  results: { lead_id: string; name: string; phone: string; status: string; error?: string }[]
}

export default function CSVImporter({ onDone }: { onDone?: () => void }) {
  const [file, setFile]               = useState<File | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [scoring, setScoring]         = useState(false)
  const [launching, setLaunching]     = useState(false)
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null)
  const [showConfig, setShowConfig]   = useState(false)
  const [outreachMsg, setOutreachMsg] = useState('')
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const fileRef  = useRef<HTMLInputElement>(null)
  const csvImport    = useCSVImport()
  const bulkAnalyze  = useBulkAnalyzeLeads()
  const leadOutreach = useLeadOutreach()

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) { setFile(f); setResult(null) }
    else toast.error('Please drop a .csv file')
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setResult(null) }
  }

  const handleImport = async () => {
    if (!file) return
    try {
      const res = await csvImport.mutateAsync(file)
      setResult(res)
      if (res.imported > 0) {
        toast.success(`Imported ${res.imported} leads — starting AI scoring…`)
        if (res.lead_ids?.length) {
          setScoring(true)
          try {
            const scoreResults = await bulkAnalyze.mutateAsync(res.lead_ids)
            const ok = (scoreResults as any[]).filter((r: any) => r.ai_score !== undefined).length
            toast.success(`AI scored ${ok}/${res.lead_ids.length} imported leads`)
          } catch {
            toast('AI scoring can be triggered manually from the Leads board')
          } finally {
            setScoring(false)
          }
        }
      }
      if (res.failed > 0) toast.error(`${res.failed} rows failed`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleLaunchOutreach = async () => {
    if (!result?.lead_ids?.length) return
    setLaunching(true)
    try {
      const data = await leadOutreach.mutateAsync({
        lead_ids: result.lead_ids,
        message: outreachMsg || undefined,
        use_template: useTemplate,
        template_name: useTemplate ? templateName : undefined,
      })
      setOutreachResult(data)
      toast.success(`Outreach launched — ${data.sent} messages sent!`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLaunching(false)
    }
  }

  const reset = () => {
    setFile(null); setResult(null); setOutreachResult(null)
    setOutreachMsg(''); setUseTemplate(false); setTemplateName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!file && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-10 cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? '#22c55e' : 'rgba(0,0,0,0.1)',
            background: dragOver ? 'rgba(34,197,94,0.05)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <Upload className="w-8 h-8 mb-3" style={{ color: dragOver ? '#22c55e' : '#94a3b8' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Drop your CSV here
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            or click to browse — requires <code className="bg-black/5 px-1 rounded">name</code>, <code className="bg-black/5 px-1 rounded">phone</code>, <code className="bg-black/5 px-1 rounded">business_name</code>
          </p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {/* File selected */}
      {file && !result && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <FileText className="w-6 h-6 flex-shrink-0" style={{ color: '#22c55e' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button onClick={reset} className="p-1 rounded-lg hover:bg-black/5"><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>
      )}

      {/* Import Result */}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Rows', value: result.total,    color: '#3b82f6' },
              { label: 'Imported',   value: result.imported, color: '#22c55e' },
              { label: 'Failed',     value: result.failed,   color: result.failed > 0 ? '#ef4444' : '#94a3b8' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center"
                style={{ background: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626' }}>
                <AlertCircle className="w-3.5 h-3.5" /> {result.errors.length} errors
              </div>
              <div className="max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs border-t" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                    <span className="font-medium" style={{ color: '#dc2626' }}>Row {e.row}:</span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.imported > 0 && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#16a34a' }}>
              <CheckCircle className="w-4 h-4" />
              {result.imported} leads imported successfully
              {scoring && <span className="flex items-center gap-1 text-xs" style={{ color: '#94a3b8' }}><Loader2 className="w-3 h-3 animate-spin" /> AI scoring…</span>}
            </div>
          )}

          {/* ── Launch Outreach Section ── */}
          {result.imported > 0 && !outreachResult && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.03)' }}>
              <button
                onClick={() => setShowConfig(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
                style={{ color: '#166534' }}>
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Launch AI Outreach to {result.imported} leads
                </span>
                {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showConfig && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'rgba(34,197,94,0.15)' }}>
                  <p className="text-xs pt-3" style={{ color: 'var(--text-muted)' }}>
                    The AI will send an opening message to each lead, then continue the conversation automatically — asking about their business, pitching StrixMind, and tracking whether they're interested.
                  </p>

                  {/* Template toggle */}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="useTemplate" checked={useTemplate}
                      onChange={e => setUseTemplate(e.target.checked)}
                      className="rounded" />
                    <label htmlFor="useTemplate" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Use approved WhatsApp template (required for numbers outside 24h session)
                    </label>
                  </div>

                  {useTemplate ? (
                    <input
                      type="text"
                      placeholder="Template name (e.g. hello_world)"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl outline-none"
                      style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
                    />
                  ) : (
                    <div className="space-y-1">
                      <textarea
                        placeholder={`Custom opening message (optional)\n\nDefault: "Hi {name}! 👋 I'm reaching out from StrixMind — we help businesses automate client acquisition using AI..."`}
                        value={outreachMsg}
                        onChange={e => setOutreachMsg(e.target.value)}
                        rows={3}
                        className="w-full text-xs px-3 py-2 rounded-xl outline-none resize-none"
                        style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
                      />
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        ⚠️ Plain text only works for test numbers or within a 24h session window. Use a template for cold outreach.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleLaunchOutreach}
                    disabled={launching || (useTemplate && !templateName)}
                    className="w-full py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#166534,#22c55e)', opacity: launching ? 0.7 : 1 }}>
                    {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {launching ? 'Sending…' : `Send to ${result.imported} leads`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Outreach result */}
          {outreachResult && (
            <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#166534' }}>
                <Send className="w-4 h-4" /> Outreach launched!
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Sent',    value: outreachResult.sent,    color: '#22c55e' },
                  { label: 'Failed',  value: outreachResult.failed,  color: outreachResult.failed > 0 ? '#ef4444' : '#94a3b8' },
                  { label: 'Skipped', value: outreachResult.skipped, color: '#94a3b8' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2 text-center"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                The AI will continue conversations automatically. Monitor replies in your Inbox — leads will be automatically updated as interested or not interested.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {file && !result && (
          <>
            <button onClick={reset} className="flex-1 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handleImport} disabled={csvImport.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#166534,#22c55e)', opacity: csvImport.isPending ? 0.7 : 1 }}>
              {csvImport.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Import Leads
            </button>
          </>
        )}
        {result && (
          <button onClick={() => { reset(); onDone?.() }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
            Done
          </button>
        )}
      </div>

      {/* Sample format */}
      {!file && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.03)' }}>
          <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Example CSV format:</div>
          <code className="text-[11px] block" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            name,phone,business_name,email,budget<br />
            Priya Sharma,+91 9876543210,Sharma Boutique,priya@ex.com,500000
          </code>
        </div>
      )}
    </div>
  )
}
