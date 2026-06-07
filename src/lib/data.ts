export type ConversationStatus = 'open' | 'waiting' | 'resolved'
export type LeadStage = 'new' | 'qualified' | 'contacted' | 'scheduled' | 'negotiation' | 'converted'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Message {
  id: string
  sender: 'customer' | 'agent' | 'ai'
  content: string
  timestamp: Date
  read: boolean
  type: 'text' | 'image' | 'note'
}

export interface Conversation {
  id: string
  customerName: string
  customerPhone: string
  customerAvatar?: string
  lastMessage: string
  lastMessageTime: Date
  status: ConversationStatus
  priority: Priority
  unreadCount: number
  tags: string[]
  assignedTo?: string
  aiScore: number
  sentiment: 'positive' | 'neutral' | 'negative'
  messages: Message[]
}

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  stage: LeadStage
  score: number
  budget: number
  intent: string
  urgency: 'low' | 'medium' | 'high'
  confidence: number
  lastContact: Date
  tags: string[]
  notes: string
}

export interface Task {
  id: string
  title: string
  leadId?: string
  leadName?: string
  dueDate: Date
  priority: Priority
  status: 'pending' | 'in_progress' | 'done'
  aiGenerated: boolean
}

export const mockConversations: Conversation[] = [
  {
    id: '1',
    customerName: 'Priya Sharma',
    customerPhone: '+91 98765 43210',
    lastMessage: 'I am interested in the premium wedding package. What is the cost?',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 1000),
    status: 'open',
    priority: 'urgent',
    unreadCount: 3,
    tags: ['wedding', 'premium', 'hot-lead'],
    assignedTo: 'Arjun',
    aiScore: 94,
    sentiment: 'positive',
    messages: [
      { id: 'm1', sender: 'customer', content: 'Hello! I saw your bridal collection online.', timestamp: new Date(Date.now() - 15 * 60 * 1000), read: true, type: 'text' },
      { id: 'm2', sender: 'agent', content: 'Hi Priya! Welcome to StrixMind Bridal. How can I help you today?', timestamp: new Date(Date.now() - 14 * 60 * 1000), read: true, type: 'text' },
      { id: 'm3', sender: 'customer', content: 'I am looking for a bridal lehenga for my wedding in December.', timestamp: new Date(Date.now() - 10 * 60 * 1000), read: true, type: 'text' },
      { id: 'm4', sender: 'ai', content: '✨ AI Note: Lead shows high purchase intent. Budget likely ₹3-5L. Recommend premium collection showcase.', timestamp: new Date(Date.now() - 9 * 60 * 1000), read: true, type: 'note' },
      { id: 'm5', sender: 'customer', content: 'I am interested in the premium wedding package. What is the cost?', timestamp: new Date(Date.now() - 2 * 60 * 1000), read: false, type: 'text' },
    ]
  },
  {
    id: '2',
    customerName: 'Rahul Mehta',
    customerPhone: '+91 87654 32109',
    lastMessage: 'Can we schedule a viewing this weekend?',
    lastMessageTime: new Date(Date.now() - 18 * 60 * 1000),
    status: 'waiting',
    priority: 'high',
    unreadCount: 1,
    tags: ['viewing', 'weekend'],
    assignedTo: 'Meera',
    aiScore: 78,
    sentiment: 'positive',
    messages: [
      { id: 'm1', sender: 'customer', content: 'Hi, I want to see the saree collection.', timestamp: new Date(Date.now() - 60 * 60 * 1000), read: true, type: 'text' },
      { id: 'm2', sender: 'customer', content: 'Can we schedule a viewing this weekend?', timestamp: new Date(Date.now() - 18 * 60 * 1000), read: false, type: 'text' },
    ]
  },
  {
    id: '3',
    customerName: 'Ananya Patel',
    customerPhone: '+91 76543 21098',
    lastMessage: 'Thank you! I will confirm by tomorrow.',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'waiting',
    priority: 'medium',
    unreadCount: 0,
    tags: ['confirmed', 'appointment'],
    assignedTo: 'Arjun',
    aiScore: 88,
    sentiment: 'positive',
    messages: [
      { id: 'm1', sender: 'customer', content: 'Thank you! I will confirm by tomorrow.', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), read: true, type: 'text' },
    ]
  },
  {
    id: '4',
    customerName: 'Kavya Reddy',
    customerPhone: '+91 65432 10987',
    lastMessage: 'The price seems a bit high for my budget.',
    lastMessageTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
    status: 'open',
    priority: 'medium',
    unreadCount: 0,
    tags: ['price-sensitive', 'negotiation'],
    aiScore: 52,
    sentiment: 'negative',
    messages: [
      { id: 'm1', sender: 'customer', content: 'The price seems a bit high for my budget.', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), read: true, type: 'text' },
    ]
  },
  {
    id: '5',
    customerName: 'Divya Krishnan',
    customerPhone: '+91 54321 09876',
    lastMessage: 'Perfect! Looking forward to our appointment.',
    lastMessageTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
    status: 'resolved',
    priority: 'low',
    unreadCount: 0,
    tags: ['appointment-set', 'premium'],
    aiScore: 96,
    sentiment: 'positive',
    messages: [
      { id: 'm1', sender: 'customer', content: 'Perfect! Looking forward to our appointment.', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), read: true, type: 'text' },
    ]
  },
]

export const mockLeads: Lead[] = [
  { id: 'l1', name: 'Priya Sharma', phone: '+91 98765 43210', email: 'priya@example.com', stage: 'qualified', score: 94, budget: 450000, intent: 'bridal_purchase', urgency: 'high', confidence: 0.93, lastContact: new Date(Date.now() - 2 * 60 * 1000), tags: ['wedding', 'premium'], notes: 'December wedding. Looking for premium lehenga.' },
  { id: 'l2', name: 'Rahul Mehta', phone: '+91 87654 32109', email: 'rahul@example.com', stage: 'contacted', score: 78, budget: 200000, intent: 'saree_purchase', urgency: 'medium', confidence: 0.81, lastContact: new Date(Date.now() - 18 * 60 * 1000), tags: ['saree', 'viewing'], notes: 'Wants weekend viewing.' },
  { id: 'l3', name: 'Ananya Patel', phone: '+91 76543 21098', email: 'ananya@example.com', stage: 'scheduled', score: 88, budget: 350000, intent: 'bridal_purchase', urgency: 'high', confidence: 0.89, lastContact: new Date(Date.now() - 2 * 60 * 60 * 1000), tags: ['appointment'], notes: 'Appointment scheduled for next week.' },
  { id: 'l4', name: 'Kavya Reddy', phone: '+91 65432 10987', email: 'kavya@example.com', stage: 'new', score: 52, budget: 150000, intent: 'casual_browse', urgency: 'low', confidence: 0.55, lastContact: new Date(Date.now() - 5 * 60 * 60 * 1000), tags: ['budget-sensitive'], notes: 'Price concerns. Needs value offering.' },
  { id: 'l5', name: 'Divya Krishnan', phone: '+91 54321 09876', email: 'divya@example.com', stage: 'converted', score: 96, budget: 800000, intent: 'bridal_purchase', urgency: 'high', confidence: 0.97, lastContact: new Date(Date.now() - 8 * 60 * 60 * 1000), tags: ['premium', 'converted'], notes: 'Premium package confirmed. ₹8L deal closed.' },
  { id: 'l6', name: 'Sneha Iyer', phone: '+91 43210 98765', email: 'sneha@example.com', stage: 'negotiation', score: 71, budget: 280000, intent: 'bridal_purchase', urgency: 'medium', confidence: 0.74, lastContact: new Date(Date.now() - 24 * 60 * 60 * 1000), tags: ['negotiation'], notes: 'Negotiating on package inclusions.' },
]

export const mockTasks: Task[] = [
  { id: 't1', title: 'Send premium catalogue to Priya Sharma', leadId: 'l1', leadName: 'Priya Sharma', dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), priority: 'urgent', status: 'pending', aiGenerated: true },
  { id: 't2', title: 'Schedule weekend viewing for Rahul Mehta', leadId: 'l2', leadName: 'Rahul Mehta', dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), priority: 'high', status: 'pending', aiGenerated: true },
  { id: 't3', title: 'Follow up with Kavya — offer budget collection', leadId: 'l4', leadName: 'Kavya Reddy', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), priority: 'medium', status: 'pending', aiGenerated: true },
  { id: 't4', title: 'Confirm appointment details with Ananya', leadId: 'l3', leadName: 'Ananya Patel', dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000), priority: 'high', status: 'in_progress', aiGenerated: false },
  { id: 't5', title: 'Send invoice to Divya Krishnan', leadId: 'l5', leadName: 'Divya Krishnan', dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), priority: 'medium', status: 'done', aiGenerated: false },
]

export const analyticsData = {
  revenue: [
    { month: 'Jul', value: 420000 },
    { month: 'Aug', value: 580000 },
    { month: 'Sep', value: 510000 },
    { month: 'Oct', value: 730000 },
    { month: 'Nov', value: 680000 },
    { month: 'Dec', value: 920000 },
  ],
  conversionRate: 34,
  avgResponseTime: '4.2m',
  totalLeads: 142,
  activeConversations: 23,
  aiTasksGenerated: 89,
  leadsThisWeek: 18,
  revenueThisMonth: 920000,
}
