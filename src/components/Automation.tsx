'use client'
import { useState, useRef, useEffect } from 'react'
import {
  useWorkflows, useUpdateWorkflow, useCreateWorkflow, useDeleteWorkflow,
} from '@/lib/hooks'
import {
  Zap, Play, Pause, Plus, Loader2, Trash2, Bell, CheckSquare,
  MessageSquare, Bot, Tag, Calendar, X, Brain, Send, Clock,
  GitBranch, Edit3, AlertCircle, CheckCircle2, Activity,
  MousePointer2, PlusCircle, Link2, Unlink2, Trash, Copy, Check,
  ZoomIn, ZoomOut, Maximize2, ChevronRight, Sparkles, LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import WorkflowTemplates from '@/components/WorkflowTemplates'

const C = {
  green:'#22c55e', greenDark:'#166534', greenLight:'#dcfce7',
  blue:'#3b82f6', purple:'#8b5cf6', amber:'#f59e0b', pink:'#ec4899',
  cyan:'#06b6d4', indigo:'#6366f1', red:'#ef4444', slate:'#64748b',
  whatsapp:'#25d366', orange:'#f97316',
}

const TRIGGERS: Record<string,{label:string;color:string;icon:string;description:string;configFields:CField[]}> = {
  keyword_trigger:{label:'Keyword Trigger',color:C.indigo,icon:'#️⃣',description:'Fires when a contact sends a specific keyword',configFields:[{key:'keyword',label:'Keywords (comma-separated)',type:'text',placeholder:'Price, Info, Help'},{key:'match_type',label:'Match type',type:'select',options:['contains','exact','starts_with'],optionLabels:['Contains','Exact match','Starts with']}]},
  inbound_message:{label:'Inbound Message',color:C.blue,icon:'💬',description:'Fires when any new WhatsApp message arrives',configFields:[{key:'keyword',label:'Optional keyword filter',type:'text',placeholder:'Leave blank to match all'}]},
  lead_score:{label:'Lead Score ≥ N',color:C.green,icon:'📊',description:'Fires when AI score crosses a threshold',configFields:[{key:'threshold',label:'Min score (0–100)',type:'number',placeholder:'80',default:'80'}]},
  inactivity:{label:'Inactivity Timer',color:C.amber,icon:'⏱️',description:'Fires when a lead has been silent for X hours',configFields:[{key:'hours',label:'Hours of silence',type:'number',placeholder:'72',default:'72'}]},
  stage_change:{label:'Stage Changed',color:C.purple,icon:'🔀',description:'Fires when a lead moves to a pipeline stage',configFields:[{key:'to_stage',label:'Target stage',type:'select',options:['new','qualified','contacted','scheduled','negotiation','converted','closed']}]},
  appointment:{label:'Appointment Event',color:C.pink,icon:'📅',description:'Fires on appointment creation or reminder',configFields:[{key:'event',label:'Event type',type:'select',options:['created','reminder_24h','reminder_1h','completed','cancelled']}]},
  manual:{label:'Manual Trigger',color:C.slate,icon:'👆',description:'Triggered manually',configFields:[]},
  scheduled:{label:'Scheduled',color:C.cyan,icon:'🕐',description:'Runs on a recurring schedule',configFields:[{key:'cron',label:'Schedule',type:'select',options:['daily_9am','daily_6pm','weekly_monday','monthly_1st'],optionLabels:['Daily 9 AM','Daily 6 PM','Weekly Monday','Monthly 1st']}]},
}

const STEPS: StepDef[] = [
  {type:'send_template',label:'Send Template',icon:MessageSquare,color:C.whatsapp,cat:'message',fields:[{key:'template_name',label:'Template name',type:'text',placeholder:'resource_requested'},{key:'variable_1',label:'{{1}} value',type:'text',placeholder:'{{contact.name}}',optional:true}]},
  {type:'send_whatsapp',label:'Send Message',icon:MessageSquare,color:C.whatsapp,cat:'message',fields:[{key:'message',label:'Message body',type:'textarea',placeholder:'Hi {{1}},\nWelcome! 👋'}]},
  {type:'notify',label:'Notify Team',icon:Bell,color:C.blue,cat:'message',fields:[{key:'message',label:'Notification text',type:'text',placeholder:'🔥 Hot lead: {{lead.name}}'}]},
  {type:'create_task',label:'Create Task',icon:CheckSquare,color:C.green,cat:'action',fields:[{key:'title',label:'Task title',type:'text',placeholder:'Follow up with {{lead.name}}'},{key:'priority',label:'Priority',type:'select',options:['urgent','high','medium','low']},{key:'due_hours',label:'Due in (hours)',type:'number',placeholder:'2'}]},
  {type:'update_lead',label:'Update Lead',icon:Tag,color:C.amber,cat:'action',fields:[{key:'stage',label:'Set stage',type:'select',options:['new','qualified','contacted','scheduled','negotiation','converted','closed'],optional:true},{key:'urgency',label:'Set urgency',type:'select',options:['low','medium','high'],optional:true}]},
  {type:'update_appointment',label:'Update Appointment',icon:Calendar,color:C.pink,cat:'action',fields:[{key:'reminder_sent',label:'Mark reminder sent',type:'checkbox'}]},
  {type:'condition',label:'Condition / Branch',icon:GitBranch,color:C.purple,cat:'logic',fields:[{key:'field',label:'Check field',type:'select',options:['lead.stage','lead.ai_score','lead.urgency'],optionLabels:['Lead stage','AI Score','Urgency']},{key:'operator',label:'Operator',type:'select',options:['eq','gte','lte','contains'],optionLabels:['equals','≥','≤','contains']},{key:'value',label:'Value',type:'text',placeholder:'e.g. qualified or 80'}]},
  {type:'wait',label:'Wait / Delay',icon:Clock,color:C.cyan,cat:'logic',fields:[{key:'duration',label:'Duration',type:'number',placeholder:'1'},{key:'unit',label:'Unit',type:'select',options:['minutes','hours','days']}]},
  {type:'ai_outreach',label:'AI Agent Outreach',icon:Brain,color:C.purple,cat:'ai',fields:[{key:'agent',label:'Agent name',type:'text',placeholder:'Lead Qualifier'},{key:'goal',label:'Outreach goal',type:'text',placeholder:'Invite to free consultation',optional:true}]},
  {type:'ai_reply',label:'AI Auto-Reply',icon:Bot,color:C.purple,cat:'ai',fields:[{key:'agent',label:'Agent name',type:'text',placeholder:'Reply Agent'}]},
  {type:'send_options',label:'Send Options',icon:MessageSquare,color:C.whatsapp,cat:'message',fields:[{key:'body',label:'Message body',type:'textarea',placeholder:'Which option would you like?'},{key:'options',label:'Options (one per line)',type:'textarea',placeholder:'Rent a car\nBook a hotel'}]},
  {type:'wait_for_reply',label:'Wait for Reply',icon:Clock,color:C.cyan,cat:'logic',fields:[{key:'timeout_hours',label:'Timeout (hours)',type:'number',placeholder:'24'}]},
]

const STEP_CATS=[{id:'message',label:'Messages',color:C.whatsapp},{id:'action',label:'Actions',color:C.amber},{id:'logic',label:'Logic',color:C.purple},{id:'ai',label:'AI',color:C.blue}]

interface CField{key:string;label:string;type:'text'|'number'|'select'|'checkbox'|'textarea';placeholder?:string;default?:string;options?:string[];optionLabels?:string[];optional?:boolean}
interface StepDef{type:string;label:string;icon:any;color:string;cat:string;fields:CField[]}
interface FlowNode{id:string;type:'trigger'|'step';stepType?:string;config:Record<string,any>;x:number;y:number;connections:string[]}
interface RunResult{triggered:number;skipped:number;errors:string[];leads:{name:string;phone:string;action:string}[]}

function uid(){return Math.random().toString(36).slice(2,10)}
function Skeleton({className=''}:{className?:string}){return <div className={`animate-pulse rounded-xl bg-black/6 ${className}`}/>}
function nodeColor(n:FlowNode){return n.type==='trigger'?TRIGGERS[n.stepType??'manual']?.color??C.slate:STEPS.find(s=>s.type===n.stepType)?.color??C.green}
function nodeLabel(n:FlowNode){return n.type==='trigger'?TRIGGERS[n.stepType??'manual']?.label??'Trigger':STEPS.find(s=>s.type===n.stepType)?.label??n.stepType??'Step'}
function nodeEmoji(n:FlowNode){if(n.type==='trigger')return TRIGGERS[n.stepType??'manual']?.icon??'⚡';const m:Record<string,string>={send_template:'📋',send_whatsapp:'💬',send_options:'🔘',wait_for_reply:'⏳',notify:'🔔',create_task:'✅',update_lead:'🏷️',update_appointment:'📅',condition:'🔀',wait:'⏱️',ai_outreach:'🧠',ai_reply:'🤖'};return m[n.stepType??'']??'⚡'}

function FieldInput({field,value,onChange}:{field:CField;value:any;onChange:(v:any)=>void}){
  const base="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all"
  const sty={background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.09)',color:'var(--text-primary)'}
  if(field.type==='checkbox')return(<label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} className="w-4 h-4 rounded accent-emerald-500"/><span className="text-xs" style={{color:'var(--text-secondary)'}}>{field.label}</span></label>)
  if(field.type==='select')return(<div><label className="block text-[10px] mb-1 font-medium" style={{color:'var(--text-muted)'}}>{field.label}{field.optional&&' (opt.)'}</label><select value={value??''} onChange={e=>onChange(e.target.value)} className={base} style={sty}>{field.optional&&<option value="">— unchanged —</option>}{(field.options??[]).map((o,i)=><option key={o} value={o}>{field.optionLabels?.[i]??o}</option>)}</select></div>)
  if(field.type==='textarea')return(<div><label className="block text-[10px] mb-1 font-medium" style={{color:'var(--text-muted)'}}>{field.label}</label><textarea value={value??''} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder} rows={4} className={base} style={{...sty,resize:'none',lineHeight:1.6}}/></div>)
  return(<div><label className="block text-[10px] mb-1 font-medium" style={{color:'var(--text-muted)'}}>{field.label}</label><input type={field.type==='number'?'number':'text'} value={value??''} onChange={e=>onChange(field.type==='number'?Number(e.target.value):e.target.value)} placeholder={field.placeholder} className={base} style={sty}/></div>)
}

// ── Canvas ────────────────────────────────────────────────────────────────────
const NODE_W=210,NODE_H=76
function bezierPath(x1:number,y1:number,x2:number,y2:number){const cy=(y1+y2)/2;return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`}

function Canvas({nodes,selectedId,connectingFrom,onSelect,onMove,onStartConnect,onFinishConnect,onCancelConnect,onAddStep,onDeleteNode,onDuplicateNode}:{nodes:FlowNode[];selectedId:string|null;connectingFrom:string|null;onSelect:(id:string)=>void;onMove:(id:string,x:number,y:number)=>void;onStartConnect:(id:string)=>void;onFinishConnect:(id:string)=>void;onCancelConnect:()=>void;onAddStep:()=>void;onDeleteNode:(id:string)=>void;onDuplicateNode:(id:string)=>void}){
  const svgRef=useRef<SVGSVGElement>(null)
  const [pan,setPan]=useState({x:80,y:50})
  const [zoom,setZoom]=useState(1)
  const [isPanning,setIsPanning]=useState(false)
  const panStart=useRef({mx:0,my:0,px:0,py:0})
  const dragging=useRef<{id:string;ox:number;oy:number;sx:number;sy:number}|null>(null)
  const [mousePos,setMousePos]=useState({x:0,y:0})
  const [ctxMenu,setCtxMenu]=useState<{id:string;cx:number;cy:number}|null>(null)
  const toCanvas=(ex:number,ey:number)=>{const r=svgRef.current!.getBoundingClientRect();return{x:(ex-r.left-pan.x)/zoom,y:(ey-r.top-pan.y)/zoom}}
  const onWheel=(e:React.WheelEvent)=>{e.preventDefault();setZoom(z=>Math.max(0.3,Math.min(2.5,z*(e.deltaY>0?0.9:1.1))))}
  const onSvgDown=(e:React.MouseEvent)=>{if(connectingFrom){onCancelConnect();return}if((e.target as SVGElement).closest('[data-node]'))return;setCtxMenu(null);setIsPanning(true);panStart.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y}}
  const onSvgMove=(e:React.MouseEvent)=>{setMousePos(toCanvas(e.clientX,e.clientY));if(isPanning&&!dragging.current)setPan({x:panStart.current.px+(e.clientX-panStart.current.mx),y:panStart.current.py+(e.clientY-panStart.current.my)});if(dragging.current)onMove(dragging.current.id,dragging.current.ox+(e.clientX-dragging.current.sx)/zoom,dragging.current.oy+(e.clientY-dragging.current.sy)/zoom)}
  const onSvgUp=()=>{setIsPanning(false);dragging.current=null}
  const startDrag=(e:React.MouseEvent,node:FlowNode)=>{e.stopPropagation();if(connectingFrom){onFinishConnect(node.id);return}dragging.current={id:node.id,ox:node.x,oy:node.y,sx:e.clientX,sy:e.clientY}}
  const nodeClick=(e:React.MouseEvent,node:FlowNode)=>{e.stopPropagation();if(!dragging.current||(Math.abs(dragging.current.ox-node.x)<3&&Math.abs(dragging.current.oy-node.y)<3))onSelect(node.id)}
  const ctxClick=(e:React.MouseEvent,id:string)=>{e.preventDefault();e.stopPropagation();setCtxMenu({id,cx:e.clientX,cy:e.clientY})}
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onCancelConnect()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onCancelConnect])
  const edges:{from:FlowNode;to:FlowNode}[]=[]
  for(const n of nodes)for(const cid of n.connections){const ch=nodes.find(x=>x.id===cid);if(ch)edges.push({from:n,to:ch})}
  return(
    <div style={{position:'relative',width:'100%',height:'100%',overflow:'hidden',borderRadius:20,background:'#f0faf2'}} onClick={()=>setCtxMenu(null)}>
      <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
        <defs><pattern id="cdots" x={pan.x%(20*zoom)} y={pan.y%(20*zoom)} width={20*zoom} height={20*zoom} patternUnits="userSpaceOnUse"><circle cx={1} cy={1} r={1} fill="rgba(34,197,94,0.2)"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#cdots)"/>
      </svg>
      <div style={{position:'absolute',top:12,right:12,zIndex:20,display:'flex',flexDirection:'column',gap:4}}>
        {[{icon:<ZoomIn className="w-3.5 h-3.5"/>,fn:()=>setZoom(z=>Math.min(z+0.15,2.5))},{icon:<ZoomOut className="w-3.5 h-3.5"/>,fn:()=>setZoom(z=>Math.max(z-0.15,0.3))},{icon:<Maximize2 className="w-3.5 h-3.5"/>,fn:()=>{setZoom(1);setPan({x:80,y:50})}}].map((b,i)=>(
          <button key={i} onClick={b.fn} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.92)',border:'1px solid rgba(0,0,0,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-secondary)',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>{b.icon}</button>
        ))}
        <div style={{height:28,paddingInline:6,borderRadius:8,background:'rgba(255,255,255,0.92)',border:'1px solid rgba(0,0,0,0.1)',display:'flex',alignItems:'center',fontSize:10,color:'var(--text-muted)',fontFamily:'monospace'}}>{Math.round(zoom*100)}%</div>
      </div>
      <div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:20}}>
        <button onClick={onAddStep} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',borderRadius:20,background:'linear-gradient(135deg,#166534,#22c55e)',border:'none',cursor:'pointer',fontSize:11,fontWeight:700,color:'white',boxShadow:'0 4px 16px rgba(34,197,94,0.4)'}}>
          <PlusCircle style={{width:14,height:14}}/> Add Step
        </button>
      </div>
      {connectingFrom&&<div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',zIndex:20,padding:'6px 14px',borderRadius:20,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',fontSize:11,color:'#4f46e5',fontWeight:600,whiteSpace:'nowrap'}}>🔗 Click any node to connect — Esc to cancel</div>}
      <svg ref={svgRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',cursor:isPanning?'grabbing':connectingFrom?'crosshair':'grab',userSelect:'none'}}
        onMouseDown={onSvgDown} onMouseMove={onSvgMove} onMouseUp={onSvgUp} onWheel={onWheel}>
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="rgba(34,197,94,0.65)"/></marker>
          <marker id="arr-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill={C.indigo}/></marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {edges.map(({from,to})=><path key={`${from.id}-${to.id}`} d={bezierPath(from.x+NODE_W/2,from.y+NODE_H,to.x+NODE_W/2,to.y)} fill="none" stroke="rgba(34,197,94,0.5)" strokeWidth={2} strokeDasharray="6 3" markerEnd="url(#arr)"/>)}
          {connectingFrom&&(()=>{const src=nodes.find(n=>n.id===connectingFrom);if(!src)return null;return<path d={bezierPath(src.x+NODE_W/2,src.y+NODE_H,mousePos.x,mousePos.y)} fill="none" stroke={C.indigo} strokeWidth={2} strokeDasharray="8 4" markerEnd="url(#arr-blue)" opacity={0.75}/>})()}
          {nodes.map(node=>{
            const col=nodeColor(node),lbl=nodeLabel(node),emj=nodeEmoji(node),isSel=node.id===selectedId,isSrc=node.id===connectingFrom
            const cfgLine=Object.entries(node.config).filter(([,v])=>v!==''&&v!==false).slice(0,1).map(([,v])=>String(v).slice(0,24)).join('')
            return(
              <g key={node.id} data-node={node.id} onMouseDown={e=>startDrag(e,node)} onClick={e=>nodeClick(e,node)} onContextMenu={e=>ctxClick(e,node.id)} style={{cursor:connectingFrom?'crosshair':'pointer'}}>
                {isSel&&<rect x={node.x-3} y={node.y-3} width={NODE_W+6} height={NODE_H+6} rx={17} fill="none" stroke={col} strokeWidth={2.5} opacity={0.5} style={{filter:`drop-shadow(0 0 6px ${col}60)`}}/>}
                {isSrc&&<rect x={node.x-4} y={node.y-4} width={NODE_W+8} height={NODE_H+8} rx={18} fill="none" stroke={C.indigo} strokeWidth={2} strokeDasharray="6 3"/>}
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={14} fill={isSel?`${col}14`:'rgba(255,255,255,0.96)'} stroke={isSel?col:'rgba(0,0,0,0.09)'} strokeWidth={isSel?2:1} style={{filter:isSel?`drop-shadow(0 4px 16px ${col}28)`:'drop-shadow(0 2px 6px rgba(0,0,0,0.07))'}}/>
                <rect x={node.x} y={node.y+14} width={3} height={NODE_H-28} rx={2} fill={col}/>
                <rect x={node.x+10} y={node.y+10} width={26} height={26} rx={8} fill={`${col}1a`}/>
                <text x={node.x+23} y={node.y+26} textAnchor="middle" dominantBaseline="middle" fontSize={13}>{emj}</text>
                <text x={node.x+44} y={node.y+20} fontSize={11.5} fontWeight="700" fill={isSel?col:'#111'} fontFamily="DM Sans,sans-serif">{lbl.length>17?lbl.slice(0,16)+'…':lbl}</text>
                <text x={node.x+44} y={node.y+34} fontSize={9} fill="rgba(0,0,0,0.38)" fontFamily="DM Sans,sans-serif">{node.type==='trigger'?'TRIGGER':'STEP'}</text>
                {cfgLine&&<text x={node.x+44} y={node.y+56} fontSize={9} fill="rgba(0,0,0,0.3)" fontFamily="DM Mono,monospace">{cfgLine.length>22?cfgLine.slice(0,22)+'…':cfgLine}</text>}
                <circle cx={node.x+NODE_W-12} cy={node.y+12} r={4} fill={C.green}/>
                <circle cx={node.x+NODE_W/2} cy={node.y+NODE_H} r={7} fill={isSrc?C.indigo:'white'} stroke={isSrc?C.indigo:col} strokeWidth={2} style={{cursor:'crosshair'}} onMouseDown={e=>{e.stopPropagation();onStartConnect(node.id)}}/>
                <circle cx={node.x+NODE_W/2} cy={node.y} r={5} fill="white" stroke={col} strokeWidth={1.5} style={{cursor:connectingFrom&&connectingFrom!==node.id?'crosshair':'default'}}/>
              </g>
            )
          })}
        </g>
      </svg>
      {ctxMenu&&(
        <div style={{position:'fixed',left:ctxMenu.cx,top:ctxMenu.cy,zIndex:100,background:'rgba(255,255,255,0.97)',border:'1px solid rgba(0,0,0,0.1)',borderRadius:12,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',overflow:'hidden',minWidth:168}} onClick={e=>e.stopPropagation()}>
          {[{icon:<Link2 style={{width:12,height:12}}/>,label:'Connect from here',fn:()=>{onStartConnect(ctxMenu.id);setCtxMenu(null)}},{icon:<Copy style={{width:12,height:12}}/>,label:'Duplicate node',fn:()=>{onDuplicateNode(ctxMenu.id);setCtxMenu(null)}},{icon:<Trash style={{width:12,height:12}}/>,label:'Delete node',fn:()=>{onDeleteNode(ctxMenu.id);setCtxMenu(null)},danger:true}].map((item,i)=>(
            <button key={i} onClick={item.fn} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 14px',background:'none',border:'none',cursor:'pointer',fontSize:12,color:(item as any).danger?'#ef4444':'var(--text-primary)',textAlign:'left'}}>{item.icon}{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Props Panel ───────────────────────────────────────────────────────────────
function PropsPanel({node,nodes,onUpdate,onDelete,onStartConnect,onDisconnect}:{node:FlowNode|null;nodes:FlowNode[];onUpdate:(id:string,p:Partial<FlowNode>)=>void;onDelete:(id:string)=>void;onStartConnect:(id:string)=>void;onDisconnect:(from:string,to:string)=>void}){
  if(!node)return(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:10,padding:24,textAlign:'center'}}><MousePointer2 style={{width:28,height:28,color:'rgba(0,0,0,0.12)'}}/><div style={{fontSize:12,color:'var(--text-muted)'}}>Select a node to edit</div><div style={{fontSize:10,color:'rgba(0,0,0,0.2)',lineHeight:1.6}}>Right-click for options<br/>Drag bottom ● to connect</div></div>)
  const isTrigger=node.type==='trigger',meta=isTrigger?TRIGGERS[node.stepType??'manual']:null,def=!isTrigger?STEPS.find(s=>s.type===node.stepType):null,col=nodeColor(node),children=nodes.filter(n=>node.connections.includes(n.id))
  return(
    <div style={{height:'100%',overflowY:'auto',padding:14}}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,paddingBottom:12,borderBottom:'1px solid rgba(0,0,0,0.06)'}}>
        <div style={{width:30,height:30,borderRadius:9,background:`${col}1a`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{nodeEmoji(node)}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:'var(--text-primary)'}}>{nodeLabel(node)}</div><div style={{fontSize:9,color:col,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>{isTrigger?'TRIGGER':'STEP'}</div></div>
        <button onClick={()=>onDelete(node.id)} style={{padding:5,borderRadius:7,background:'rgba(239,68,68,0.08)',border:'none',cursor:'pointer',color:'#ef4444',display:'flex'}}><Trash2 style={{width:12,height:12}}/></button>
      </div>
      {isTrigger&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'var(--text-muted)',marginBottom:8}}>Trigger Type</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
            {Object.entries(TRIGGERS).map(([key,m])=>(
              <button key={key} onClick={()=>onUpdate(node.id,{stepType:key,config:{}})} style={{padding:'7px 8px',borderRadius:9,textAlign:'left',cursor:'pointer',background:node.stepType===key?`${m.color}14`:'rgba(0,0,0,0.025)',border:`1px solid ${node.stepType===key?m.color+'50':'rgba(0,0,0,0.07)'}`,transition:'all 0.12s'}}>
                <div style={{fontSize:13,marginBottom:2}}>{m.icon}</div>
                <div style={{fontSize:9.5,fontWeight:600,color:node.stepType===key?m.color:'var(--text-primary)',lineHeight:1.3}}>{m.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {(isTrigger?meta?.configFields:def?.fields)?.length?(
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14,padding:12,borderRadius:11,background:`${col}06`,border:`1px solid ${col}18`}}>
          {(isTrigger?meta!.configFields:def!.fields).map(field=>(
            <FieldInput key={field.key} field={field} value={node.config[field.key]??field.default??(field.type==='checkbox'?false:'')} onChange={v=>onUpdate(node.id,{config:{...node.config,[field.key]:v}})}/>
          ))}
        </div>
      ):null}
      {node.stepType==='wait'&&node.config.duration&&<div style={{marginBottom:14,padding:10,borderRadius:10,background:`${C.cyan}08`,border:`1px solid ${C.cyan}20`,fontSize:11,color:C.cyan,fontWeight:600,textAlign:'center'}}>⏱️ Wait {node.config.duration} {node.config.unit??'hours'}</div>}
      <div style={{marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'var(--text-muted)'}}>Connections ({children.length})</div>
          <button onClick={()=>onStartConnect(node.id)} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:7,background:`${C.indigo}10`,border:`1px solid ${C.indigo}25`,fontSize:10,color:C.indigo,cursor:'pointer',fontWeight:600}}><Link2 style={{width:10,height:10}}/> Add</button>
        </div>
        {children.length===0?<div style={{fontSize:10,color:'rgba(0,0,0,0.22)',textAlign:'center',padding:'6px 0'}}>No outgoing connections</div>:
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {children.map(ch=>(
              <div key={ch.id} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderRadius:8,background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.05)'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:nodeColor(ch),flexShrink:0}}/>
                <span style={{flex:1,fontSize:11,color:'var(--text-secondary)'}}>{nodeLabel(ch)}</span>
                <button onClick={()=>onDisconnect(node.id,ch.id)} style={{padding:3,borderRadius:4,background:'none',border:'none',cursor:'pointer',color:'#ef4444',display:'flex'}}><Unlink2 style={{width:10,height:10}}/></button>
              </div>
            ))}
          </div>
        }
      </div>
      <div style={{padding:9,borderRadius:9,background:'rgba(0,0,0,0.025)',fontSize:10,color:'rgba(0,0,0,0.28)',lineHeight:1.6}}>💡 Drag bottom ● to connect. Right-click for options.</div>
    </div>
  )
}

// ── Step Picker ───────────────────────────────────────────────────────────────
function StepPicker({onAdd,onClose}:{onAdd:(t:string)=>void;onClose:()=>void}){
  const [search,setSearch]=useState('')
  const filtered=STEPS.filter(s=>s.label.toLowerCase().includes(search.toLowerCase())||s.cat.includes(search))
  return(
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{width:380,maxHeight:'80vh',borderRadius:20,background:'rgba(247,253,248,0.98)',border:'1px solid rgba(34,197,94,0.15)',boxShadow:'0 20px 60px rgba(0,0,0,0.22)',overflow:'hidden',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 16px 10px',borderBottom:'1px solid rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Add a Step</span><button onClick={onClose} style={{padding:4,borderRadius:8,background:'rgba(0,0,0,0.05)',border:'none',cursor:'pointer',display:'flex',color:'var(--text-muted)'}}><X style={{width:14,height:14}}/></button></div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search steps…" style={{width:'100%',padding:'7px 11px',borderRadius:10,background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.08)',fontSize:12,outline:'none',color:'var(--text-primary)'}}/>
        </div>
        <div style={{overflowY:'auto',padding:14,display:'flex',flexDirection:'column',gap:12}}>
          {STEP_CATS.map(cat=>{const catSteps=filtered.filter(s=>s.cat===cat.id);if(!catSteps.length)return null;return(
            <div key={cat.id}>
              <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:cat.color,marginBottom:6}}>{cat.label}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {catSteps.map(def=><button key={def.type} onClick={()=>onAdd(def.type)} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:10,cursor:'pointer',background:`${def.color}0c`,border:`1px solid ${def.color}22`,textAlign:'left'}}><def.icon style={{width:14,height:14,color:def.color,flexShrink:0}}/><span style={{fontSize:11,fontWeight:600,color:'var(--text-primary)'}}>{def.label}</span></button>)}
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}

// ── Workflow Editor Modal ─────────────────────────────────────────────────────
function WorkflowEditor({ workflow, onClose }: { workflow?: any; onClose: () => void }) {
  const create = useCreateWorkflow()
  const update = useUpdateWorkflow()
  const [name, setName] = useState(workflow?.name ?? '')
  const [description, setDescription] = useState(workflow?.description ?? '')
  const [showPicker, setShowPicker] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)

  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    if (!workflow) {
      const tid = uid()
      return [{ id: tid, type: 'trigger', stepType: 'inbound_message', config: {}, x: 120, y: 50, connections: [] }]
    }
    const steps: any[] = Array.isArray(workflow.steps) ? workflow.steps : JSON.parse(workflow.steps ?? '[]')
    const tid = uid()
    const stepNodes: FlowNode[] = steps.map((s: any, i: number) => ({ id: uid(), type: 'step' as const, stepType: s.type, config: s.config ?? {}, x: 120, y: 170 + i * 130, connections: [] }))
    const trig: FlowNode = { id: tid, type: 'trigger', stepType: workflow.trigger_type ?? 'inbound_message', config: workflow.trigger_config ?? {}, x: 120, y: 50, connections: stepNodes.length > 0 ? [stepNodes[0].id] : [] }
    for (let i = 0; i < stepNodes.length - 1; i++) stepNodes[i].connections = [stepNodes[i + 1].id]
    return [trig, ...stepNodes]
  })

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null
  const addStep = (type: string) => {
    const def = STEPS.find(s => s.type === type)!
    const cfg: Record<string, any> = {}
    def.fields.forEach(f => { if (f.default) cfg[f.key] = f.default })
    const last = nodes[nodes.length - 1]
    const newNode: FlowNode = { id: uid(), type: 'step', stepType: type, config: cfg, x: last ? last.x : 120, y: last ? last.y + 130 : 200, connections: [] }
    setNodes(ns => {
      const arr = [...ns, newNode]
      if (last) arr[ns.length - 1] = { ...last, connections: [...last.connections, newNode.id] }
      return arr
    })
    setSelectedId(newNode.id); setShowPicker(false)
  }
  const updateNode = (id: string, patch: Partial<FlowNode>) => setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n))
  const moveNode = (id: string, x: number, y: number) => setNodes(ns => ns.map(n => n.id === id ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n))
  const deleteNode = (id: string) => { setNodes(ns => ns.filter(n => n.id !== id).map(n => ({ ...n, connections: n.connections.filter(c => c !== id) }))); if (selectedId === id) setSelectedId(null) }
  const duplicateNode = (id: string) => { const src = nodes.find(n => n.id === id); if (!src) return; setNodes(ns => [...ns, { ...src, id: uid(), x: src.x + 24, y: src.y + 24, connections: [] }]); toast.success('Duplicated') }
  const startConnect = (id: string) => setConnectingFrom(id)
  const finishConnect = (toId: string) => {
    if (!connectingFrom || connectingFrom === toId) { setConnectingFrom(null); return }
    setNodes(ns => ns.map(n => n.id === connectingFrom ? { ...n, connections: [...new Set([...n.connections, toId])] } : n))
    setConnectingFrom(null); toast.success('Connected')
  }
  const disconnect = (fromId: string, toId: string) => setNodes(ns => ns.map(n => n.id === fromId ? { ...n, connections: n.connections.filter(c => c !== toId) } : n))

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setConnectingFrom(null) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const save = async () => {
    if (!name.trim()) { toast.error('Name required'); return }
    const trigger = nodes.find(n => n.type === 'trigger')
    if (!trigger) { toast.error('Trigger needed'); return }
    if (nodes.filter(n => n.type === 'step').length === 0) { toast.error('Add at least one step'); return }
    const visited = new Set<string>(); const order: FlowNode[] = []; const q = [trigger]
    while (q.length) { const cur = q.shift()!; for (const cid of cur.connections) { const ch = nodes.find(n => n.id === cid); if (ch && !visited.has(ch.id)) { visited.add(ch.id); order.push(ch); q.push(ch) } } }
    const rawTriggerType = trigger.stepType ?? 'manual'
    const dbTriggerType = rawTriggerType === 'keyword_trigger' ? 'inbound_message' : rawTriggerType
    const payload = { name: name.trim(), description: description.trim(), trigger_type: dbTriggerType, trigger_config: trigger.config, steps: order.map(n => ({ type: n.stepType ?? '', config: n.config })), active: true, run_count: workflow?.run_count ?? 0, success_count: workflow?.success_count ?? 0 }
    try {
      if (workflow) { await update.mutateAsync({ id: workflow.id, ...payload }); toast.success('Updated!') }
      else { await create.mutateAsync(payload); toast.success('Created!') }
      onClose()
    } catch (err: any) { toast.error(err.message) }
  }

  const isPending = create.isPending || update.isPending
  const stepCount = nodes.filter(n => n.type === 'step').length
  const connCount = nodes.reduce((a, n) => a + n.connections.length, 0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ width: '100%', maxWidth: 1100, height: '94vh', display: 'flex', flexDirection: 'column', borderRadius: 24, background: '#f7fdf8', border: '1px solid rgba(34,197,94,0.15)', boxShadow: '0 32px 80px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#166534,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap style={{ width: 16, height: 16, color: 'white' }} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Workflow name *" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', width: 260 }} />
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" style={{ fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: 'none', outline: 'none', width: 260 }} />
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'rgba(34,197,94,0.08)', color: C.greenDark, fontWeight: 700 }}>{stepCount} steps</span>
            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', color: '#4f46e5', fontWeight: 700 }}>{connCount} connections</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#166534,#22c55e)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'white', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}>
            {isPending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
            {workflow ? 'Update' : 'Create'}
          </button>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 258px', overflow: 'hidden' }}>
          <Canvas nodes={nodes} selectedId={selectedId} connectingFrom={connectingFrom}
            onSelect={id => setSelectedId(id)} onMove={moveNode}
            onStartConnect={startConnect} onFinishConnect={finishConnect} onCancelConnect={() => setConnectingFrom(null)}
            onAddStep={() => setShowPicker(true)} onDeleteNode={deleteNode} onDuplicateNode={duplicateNode} />
          <div style={{ borderLeft: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.55)', overflowY: 'auto' }}>
            <PropsPanel node={selectedNode} nodes={nodes} onUpdate={updateNode} onDelete={deleteNode} onStartConnect={startConnect} onDisconnect={disconnect} />
          </div>
        </div>
        <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(0,0,0,0.05)', flexShrink: 0, display: 'flex', gap: 16, background: 'rgba(255,255,255,0.5)' }}>
          {['🖱️ Drag canvas to pan', '⚙️ Click node to edit', '🔗 Drag bottom ● to connect', '📋 Right-click for options', '⌨️ Esc to cancel connect'].map((t, i) => (
            <span key={i} style={{ fontSize: 10, color: 'rgba(0,0,0,0.28)' }}>{t}</span>
          ))}
        </div>
      </div>
      {showPicker && <StepPicker onAdd={addStep} onClose={() => setShowPicker(false)} />}
    </div>
  )
}

// ── Run Results Modal ─────────────────────────────────────────────────────────
function RunResultsModal({ result, onClose }: { result: RunResult; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)' }}>
      <div style={{ width: '100%', maxWidth: 440, borderRadius: 24, overflow: 'hidden', background: 'rgba(247,253,248,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#166534,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap style={{ width: 16, height: 16, color: 'white' }} /></div>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Workflow Executed</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Run complete</div></div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}><X style={{ width: 14, height: 14 }} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[{ label: 'Triggered', value: result.triggered, color: C.green }, { label: 'Skipped', value: result.skipped, color: '#94a3b8' }, { label: 'Errors', value: result.errors.length, color: result.errors.length > 0 ? C.red : '#94a3b8' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: 12, borderRadius: 14, background: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.04em' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {result.leads.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {result.leads.map((lead, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#166534', flexShrink: 0 }}>{lead.name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{lead.name}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.action}</div></div>
                  <Send style={{ width: 12, height: 12, color: C.green, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Errors</div>
              {result.errors.map((e, i) => <div key={i} style={{ fontSize: 10, color: '#dc2626' }}>• {e}</div>)}
            </div>
          )}
          {result.triggered === 0 && result.errors.length === 0 && <div style={{ textAlign: 'center', padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>No leads matched the trigger conditions.</div>}
        </div>
        <div style={{ padding: '0 20px 20px' }}><button onClick={onClose} style={{ width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#166534,#22c55e)', border: 'none', cursor: 'pointer' }}>Done</button></div>
      </div>
    </div>
  )
}

// ── Execution Log ─────────────────────────────────────────────────────────────
interface StepLog { step: number; type: string; label: string; status: 'success'|'skipped'|'error'; message: string; durationMs: number }
interface LeadExecution { leadId: string; name: string; phone: string; steps: StepLog[]; whatsappSent: boolean; taskCreated: boolean }
interface ExecutionRecord { runId: string; workflowId: string; workflowName: string; triggeredAt: string; durationMs: number; triggered: number; skipped: number; errors: string[]; leads: LeadExecution[] }

const STATUS_COLORS: Record<string, string> = { success: C.green, skipped: C.amber, error: C.red }
const STATUS_BG: Record<string, string> = { success: 'rgba(34,197,94,0.08)', skipped: 'rgba(245,158,11,0.08)', error: 'rgba(239,68,68,0.08)' }
const STATUS_BORDER: Record<string, string> = { success: 'rgba(34,197,94,0.18)', skipped: 'rgba(245,158,11,0.18)', error: 'rgba(239,68,68,0.18)' }

function StatusIcon({ status, size = 11 }: { status: string; size?: number }) {
  const col = STATUS_COLORS[status] ?? C.slate
  if (status === 'success') return <CheckCircle2 style={{ width: size, height: size, color: col }} />
  if (status === 'skipped') return <Clock style={{ width: size, height: size, color: col }} />
  return <AlertCircle style={{ width: size, height: size, color: col }} />
}

function NodeStepRow({ s, isLast }: { s: StepLog; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  const autoStep = s.type === 'auto_notify'
  return (
    <div style={{ position: 'relative' }}>
      {!isLast && (
        <div style={{ position: 'absolute', left: 9, top: 34, bottom: -4, width: 2, background: 'rgba(34,197,94,0.18)', borderRadius: 2 }} />
      )}
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10,
          background: open ? STATUS_BG[s.status] : 'rgba(255,255,255,0.7)',
          border: `1px solid ${open ? STATUS_BORDER[s.status] : 'rgba(0,0,0,0.06)'}`,
          cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', marginBottom: 4 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${STATUS_COLORS[s.status]}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <StatusIcon status={s.status} size={10} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
              {autoStep ? '🤖 Auto-Notify' : `Step ${s.step}`}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
            {autoStep && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: C.indigo, fontWeight: 700 }}>AUTO</span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{s.durationMs}ms</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: STATUS_COLORS[s.status], textTransform: 'uppercase', flexShrink: 0, minWidth: 44, textAlign: 'right' }}>{s.status}</span>
        <ChevronRight style={{ width: 10, height: 10, color: 'rgba(0,0,0,0.25)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ margin: '0 0 6px 28px', padding: '8px 10px', borderRadius: 8,
          background: STATUS_BG[s.status], border: `1px solid ${STATUS_BORDER[s.status]}`,
          fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {s.message}
        </div>
      )}
    </div>
  )
}

function LeadExecutionCard({ lead, isSelected, onClick }: { lead: LeadExecution; isSelected: boolean; onClick: () => void }) {
  const successCount = lead.steps.filter(s => s.status === 'success').length
  const errorCount   = lead.steps.filter(s => s.status === 'error').length
  const skipCount    = lead.steps.filter(s => s.status === 'skipped').length
  const overall = errorCount > 0 ? 'error' : successCount > 0 ? 'success' : 'skipped'
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
      background: isSelected ? STATUS_BG[overall] : 'rgba(255,255,255,0.75)',
      border: `1px solid ${isSelected ? STATUS_BORDER[overall] : 'rgba(0,0,0,0.07)'}`,
      transition: 'all 0.12s', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#166534', flexShrink: 0 }}>
          {lead.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{lead.phone}</div>
        </div>
        <StatusIcon status={overall} size={12} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[{ label: `${successCount} ok`, color: C.green }, { label: `${skipCount} skip`, color: C.amber }, { label: `${errorCount} err`, color: C.red }].map(b => (
          <span key={b.label} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: `${b.color}12`, color: b.color, fontWeight: 700 }}>{b.label}</span>
        ))}
        {lead.whatsappSent && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: 'rgba(37,211,102,0.12)', color: '#25d366', fontWeight: 700 }}>📱 WA</span>}
        {lead.taskCreated  && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: C.green, fontWeight: 700 }}>✅ Task</span>}
      </div>
    </button>
  )
}

function ExecutionLog({ workflows }: { workflows: any[] }) {
  // Pull real execution records from the workflow's execution_logs field
  const allExecs: ExecutionRecord[] = (workflows ?? []).flatMap((wf: any) => {
    const raw = wf.execution_logs
    if (!raw) return []
    const logs: ExecutionRecord[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : [])
    return logs
  }).sort((a: ExecutionRecord, b: ExecutionRecord) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())

  const [selectedExecId, setSelectedExecId] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  useEffect(() => {
    if (allExecs.length && !selectedExecId) {
      setSelectedExecId(allExecs[0].runId)
      if (allExecs[0].leads.length) setSelectedLeadId(allExecs[0].leads[0].leadId)
    }
  }, [allExecs.length])

  const selExec = allExecs.find(e => e.runId === selectedExecId) ?? allExecs[0] ?? null
  const selLead = selExec?.leads.find(l => l.leadId === selectedLeadId) ?? selExec?.leads[0] ?? null

  if (!allExecs.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
      <Activity style={{ width: 28, height: 28, color: 'rgba(0,0,0,0.12)' }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No executions yet</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
        Run a workflow to see real per-node logs, WhatsApp delivery status, and task creation details here.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 220px 1fr', gap: 10, height: '100%', minHeight: 360 }}>

      {/* Column 1 — Run list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
          Runs ({allExecs.length})
        </div>
        {allExecs.map(exec => {
          const hasError = exec.errors.length > 0
          const isSel = exec.runId === selectedExecId
          return (
            <button key={exec.runId} onClick={() => { setSelectedExecId(exec.runId); setSelectedLeadId(exec.leads[0]?.leadId ?? null) }}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 11, cursor: 'pointer', textAlign: 'left', marginBottom: 4,
                background: isSel ? (hasError ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.08)') : 'rgba(255,255,255,0.7)',
                border: `1px solid ${isSel ? (hasError ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)') : 'rgba(0,0,0,0.07)'}`,
                transition: 'all 0.12s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                {hasError ? <AlertCircle style={{ width: 11, height: 11, color: C.red }} /> : <CheckCircle2 style={{ width: 11, height: 11, color: C.green }} />}
                <span style={{ fontSize: 10, fontWeight: 700, color: hasError ? '#dc2626' : '#166534' }}>
                  {hasError ? 'Partial' : 'Success'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{exec.durationMs}ms</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exec.workflowName}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(exec.triggeredAt).toLocaleString()}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', color: '#166534', fontWeight: 700 }}>{exec.triggered} triggered</span>
                {exec.skipped > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'rgba(100,116,139,0.1)', color: '#64748b', fontWeight: 700 }}>{exec.skipped} skipped</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Column 2 — Lead list for selected run */}
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
          Contacts ({selExec?.leads.length ?? 0})
        </div>
        {selExec?.leads.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No contacts matched</div>
        )}
        {(selExec?.leads ?? []).map(lead => (
          <LeadExecutionCard key={lead.leadId} lead={lead} isSelected={lead.leadId === selectedLeadId}
            onClick={() => setSelectedLeadId(lead.leadId)} />
        ))}
        {selExec && selExec.errors.length > 0 && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', marginBottom: 5 }}>⚠ Run Errors ({selExec.errors.length})</div>
            {selExec.errors.map((e, i) => <div key={i} style={{ fontSize: 9, color: '#dc2626', lineHeight: 1.5 }}>• {e}</div>)}
          </div>
        )}
      </div>

      {/* Column 3 — Per-node step log */}
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {selLead ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#166534' }}>
                {selLead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{selLead.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selLead.phone}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                {selLead.whatsappSent && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'rgba(37,211,102,0.12)', color: '#25d366', fontWeight: 700 }}>📱 WhatsApp Sent</span>
                )}
                {selLead.taskCreated && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: C.green, fontWeight: 700 }}>✅ Task Created</span>
                )}
              </div>
            </div>

            {/* Trigger node */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, marginBottom: 4,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.14)' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap style={{ width: 10, height: 10, color: C.green }} />
              </div>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {TRIGGERS[selExec?.workflowId ? (workflows.find(w => w.id === selExec.workflowId)?.trigger_type ?? 'manual') : 'manual']?.label ?? 'Trigger'} — fired
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>0ms</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.green, textTransform: 'uppercase' }}>success</span>
            </div>

            {/* Step nodes */}
            <div style={{ paddingLeft: 14, borderLeft: '2px solid rgba(34,197,94,0.15)', marginLeft: 9 }}>
              {selLead.steps.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '10px 0' }}>No step logs recorded</div>
              )}
              {selLead.steps.map((s, i) => (
                <NodeStepRow key={`${s.step}-${s.type}-${i}`} s={s} isLast={i === selLead.steps.length - 1} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <MousePointer2 style={{ width: 24, height: 24, color: 'rgba(0,0,0,0.12)' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select a contact to see step logs</div>
          </div>
        )}
      </div>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUTOMATION PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Automation() {
  const { data: workflows, isLoading } = useWorkflows()
  const updateWf = useUpdateWorkflow()
  const deleteWf = useDeleteWorkflow()
  const [pageTab, setPageTab] = useState<'workflows' | 'templates'>('workflows')
  const [selected, setSelected] = useState<any>(null)
  const [detailTab, setDetailTab] = useState<'flow' | 'executions'>('flow')
  const [showEditor, setShowEditor] = useState(false)
  const [editWf, setEditWf] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)

  const activeWf = selected ?? (workflows ?? [])[0] ?? null
  const tc = activeWf ? (TRIGGERS[activeWf.trigger_type] ?? TRIGGERS.manual) : null
  const steps = activeWf ? (Array.isArray(activeWf.steps) ? activeWf.steps : JSON.parse(activeWf.steps ?? '[]')) : []

  const toggle = async (wf: any) => {
    try { await updateWf.mutateAsync({ id: wf.id, active: !wf.active }); toast.success(wf.active ? 'Paused' : 'Activated') }
    catch (err: any) { toast.error(err.message) }
  }
  const runNow = async (wf: any) => {
    if (!wf) return; setRunning(true)
    try {
      const res = await fetch('/api/workflows/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflow_id: wf.id, manual: true }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setRunResult(json.data as RunResult)
      await updateWf.mutateAsync({ id: wf.id, run_count: (wf.run_count ?? 0) + (json.data?.triggered ?? 0), success_count: (wf.success_count ?? 0) + (json.data?.triggered ?? 0) })
    } catch (err: any) { toast.error(err.message ?? 'Failed') } finally { setRunning(false) }
  }
  const handleDelete = async (wf: any) => {
    if (!confirm(`Delete "${wf.name}"?`)) return
    try { await deleteWf.mutateAsync(wf.id); if (activeWf?.id === wf.id) setSelected(null); toast.success('Deleted') }
    catch (err: any) { toast.error(err.message) }
  }

  return (
    <div>
      {(showEditor || editWf) && <WorkflowEditor workflow={editWf} onClose={() => { setShowEditor(false); setEditWf(null) }} />}
      {runResult && <RunResultsModal result={runResult} onClose={() => setRunResult(null)} />}

      {/* ── Page-level tab bar ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, padding: '4px', borderRadius: 16, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', width: 'fit-content' }}>
        {([
          ['workflows', 'My Workflows', LayoutGrid],
          ['templates', 'Templates & Import', Sparkles],
        ] as [string, string, any][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setPageTab(id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: pageTab === id ? 'white' : 'transparent', color: pageTab === id ? '#166534' : 'var(--text-muted)', boxShadow: pageTab === id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>
            <Icon style={{ width: 13, height: 13 }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Templates tab ───────────────────────────────────────────────── */}
      {pageTab === 'templates' && (
        <div className="glass rounded-3xl p-5">
          <WorkflowTemplates onTemplateInstalled={() => setPageTab('workflows')} />
        </div>
      )}

      {/* ── Workflows tab ───────────────────────────────────────────────── */}
      {pageTab === 'workflows' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workflow list */}
        <div className="glass rounded-3xl p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Automations</span>
            <button onClick={() => { setEditWf(null); setShowEditor(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#166534,#22c55e)', border: 'none', cursor: 'pointer' }}>
              <Plus style={{ width: 12, height: 12 }} /> New
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {isLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) :
              (workflows ?? []).length === 0
                ? <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'var(--text-muted)' }}>No automations yet</div>
                : (workflows ?? []).map((wf: any) => {
                  const meta = TRIGGERS[wf.trigger_type] ?? TRIGGERS.manual
                  const isSel = activeWf?.id === wf.id
                  const stepCount = Array.isArray(wf.steps) ? wf.steps.length : JSON.parse(wf.steps ?? '[]').length
                  return (
                    <div key={wf.id} onClick={() => setSelected(wf)}
                      style={{ padding: '10px 12px', borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s', background: isSel ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isSel ? 'rgba(34,197,94,0.2)' : 'transparent'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 15 }}>{meta.icon}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wf.name}</span>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: wf.active ? C.green : '#94a3b8', flexShrink: 0 }} />
                      </div>
                      <div style={{ fontSize: 10, color: meta.color, fontWeight: 700, marginBottom: 3 }}>{meta.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stepCount} steps · {wf.run_count ?? 0} runs</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditWf(wf); setShowEditor(true) }} style={{ padding: 5, borderRadius: 7, background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}><Edit3 style={{ width: 11, height: 11 }} /></button>
                          <button onClick={() => handleDelete(wf)} style={{ padding: 5, borderRadius: 7, background: 'rgba(239,68,68,0.07)', border: 'none', cursor: 'pointer', display: 'flex', color: '#ef4444' }}><Trash2 style={{ width: 11, height: 11 }} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
          </div>
        </div>

        {/* Workflow detail */}
        <div className="glass rounded-3xl lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeWf ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>Select an automation</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Or create one to automate your lead flow</div>
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{tc?.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{activeWf.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: activeWf.active ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.06)', color: activeWf.active ? '#166534' : '#94a3b8' }}>
                        {activeWf.active ? '● Live' : '○ Paused'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: tc?.color, fontWeight: 700 }}>{tc?.label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => { setEditWf(activeWf); setShowEditor(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)' }}>
                      <Edit3 style={{ width: 12, height: 12 }} /> Edit
                    </button>
                    <button onClick={() => toggle(activeWf)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: activeWf.active ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.1)', color: activeWf.active ? '#dc2626' : '#166534' }}>
                      {activeWf.active ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
                      {activeWf.active ? 'Pause' : 'Activate'}
                    </button>
                    <button onClick={() => runNow(activeWf)} disabled={running || !activeWf.active}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 10, border: 'none', cursor: !activeWf.active ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, background: activeWf.active ? 'linear-gradient(135deg,#166534,#22c55e)' : 'rgba(0,0,0,0.08)', color: activeWf.active ? 'white' : '#94a3b8', boxShadow: activeWf.active ? '0 2px 12px rgba(34,197,94,0.3)' : 'none' }}>
                      {running ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Send style={{ width: 12, height: 12 }} />}
                      {running ? 'Running…' : 'Run Now'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
                {([['flow', 'Flow', GitBranch], ['executions', 'Executions', Activity]] as [string, string, any][]).map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setDetailTab(id as any)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'transparent', color: detailTab === id ? C.green : 'var(--text-muted)', borderBottom: `2px solid ${detailTab === id ? C.green : 'transparent'}`, marginBottom: -1, transition: 'all 0.15s' }}>
                    <Icon style={{ width: 12, height: 12 }} /> {label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {detailTab === 'flow' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                      {[
                        { label: 'Total Runs', value: String(activeWf.run_count ?? 0), color: C.green },
                        { label: 'Success Rate', value: activeWf.run_count ? `${Math.round((activeWf.success_count / activeWf.run_count) * 100)}%` : '—', color: C.green },
                        { label: 'Status', value: activeWf.active ? 'Live' : 'Paused', color: activeWf.active ? C.green : '#94a3b8' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: 14, borderRadius: 16, background: `${s.color}06`, border: `1px solid ${s.color}15` }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                      <div style={{ width: '100%', padding: 14, borderRadius: 16, textAlign: 'center', background: `${tc?.color}10`, border: `1px solid ${tc?.color}28` }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: tc?.color, marginBottom: 4 }}>TRIGGER</div>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{tc?.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{tc?.label}</div>
                        {activeWf.trigger_config && Object.keys(activeWf.trigger_config).length > 0 && (
                          <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {Object.entries(activeWf.trigger_config).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </div>
                        )}
                      </div>
                      {steps.map((step: any, i: number) => {
                        const def = STEPS.find(s => s.type === step.type)
                        const StepIcon = def?.icon ?? Zap
                        return (
                          <div key={i} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '5px 0' }}>
                              <svg width="2" height="20"><line x1="1" y1="0" x2="1" y2="20" stroke="rgba(34,197,94,0.4)" strokeWidth="2" strokeDasharray="4 3" /></svg>
                            </div>
                            <div style={{ width: '100%', padding: 12, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${def?.color ?? C.green}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><StepIcon style={{ width: 14, height: 14, color: def?.color ?? C.green }} /></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: def?.color ?? C.green, marginBottom: 2 }}>STEP {i + 1}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{def?.label ?? step.type}</div>
                                {step.config && Object.keys(step.config).filter(k => step.config[k] !== '' && step.config[k] !== false).length > 0 && (
                                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                    {Object.entries(step.config).filter(([, v]) => v !== '' && v !== false).map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`).join(' · ')}
                                  </div>
                                )}
                              </div>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : <ExecutionLog workflows={workflows ?? []} />}
              </div>
            </>
          )}
        </div>
      </div>}
    </div>
  )
}
