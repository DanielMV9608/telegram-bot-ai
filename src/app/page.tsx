'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Send,
  Users,
  Settings,
  Brain,
  MessageSquare,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Copy,
  Zap,
  Shield,
  Target,
  Sparkles,
  TrendingUp,
  Clock,
  Phone,
  Mail,
  User,
  AlertCircle,
  Info,
  Terminal,
} from 'lucide-react';

// Types
interface BotStatus {
  isConnected: boolean;
  isActive: boolean;
  hasToken: boolean;
  botUsername: string | null;
  todayStats: {
    messagesIn: number;
    messagesOut: number;
    leadsCaptured: number;
    uniqueUsers: number;
  };
  totalLeads: number;
  todayLeads: number;
  todayMessages: number;
  activeFeedback: number;
}

interface Lead {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  messages?: Array<{
    id: string;
    direction: string;
    content: string;
    createdAt: string;
  }>;
}

interface Feedback {
  id: string;
  triggerText: string;
  badResponse: string | null;
  correction: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

interface BotConfig {
  id: string;
  token: string | null;
  systemPrompt: string;
  isActive: boolean;
  webhookUrl: string | null;
  botUsername: string | null;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Form states
  const [tokenInput, setTokenInput] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Feedback form
  const [newFeedback, setNewFeedback] = useState({ triggerText: '', correction: '', category: 'response_style' });
  
  // Selected lead for details
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, leadsRes, feedbackRes, configRes] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/leads'),
        fetch('/api/feedback'),
        fetch('/api/bot/config'),
      ]);
      
      const statusData = await statusRes.json();
      const leadsData = await leadsRes.json();
      const feedbackData = await feedbackRes.json();
      const configData = await configRes.json();
      
      if (statusData.success) setStatus(statusData.status);
      if (leadsData.success) setLeads(leadsData.leads);
      if (feedbackData.success) setFeedbacks(feedbackData.feedbacks);
      if (configData.success) {
        setConfig(configData.config);
        setSystemPrompt(configData.config.systemPrompt || '');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Save token and setup webhook
  const handleConnectBot = async () => {
    if (!tokenInput) {
      toast({ title: 'Error', description: 'Ingresa el token del bot', variant: 'destructive' });
      return;
    }
    if (!webhookUrl) {
      toast({ title: 'Error', description: 'Ingresa la URL pública de tu servidor', variant: 'destructive' });
      return;
    }

    setIsConnecting(true);
    try {
      // Save token first
      const saveRes = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput, isActive: true }),
      });
      
      if (!saveRes.ok) throw new Error('Error al guardar token');
      
      // Setup webhook
      const webhookRes = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', webhookUrl }),
      });
      
      const webhookData = await webhookRes.json();
      
      if (webhookData.success) {
        toast({
          title: '¡Bot conectado!',
          description: `Bot @${webhookData.botUsername} configurado correctamente`,
        });
        setTokenInput('');
        fetchData();
      } else {
        throw new Error(webhookData.error);
      }
    } catch (error) {
      console.error('Error connecting bot:', error);
      toast({
        title: 'Error de conexión',
        description: error instanceof Error ? error.message : 'No se pudo conectar el bot',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect bot
  const handleDisconnectBot = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Bot desconectado', description: 'El webhook ha sido eliminado' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo desconectar', variant: 'destructive' });
    } finally {
      setIsConnecting(false);
    }
  };

  // Update system prompt
  const handleUpdatePrompt = async () => {
    try {
      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Actualizado', description: 'System prompt guardado correctamente' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  // Add feedback
  const handleAddFeedback = async () => {
    if (!newFeedback.triggerText || !newFeedback.correction) {
      toast({ title: 'Error', description: 'Completa todos los campos', variant: 'destructive' });
      return;
    }
    
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeedback),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Feedback agregado', description: 'El bot aprenderá de esta corrección' });
        setNewFeedback({ triggerText: '', correction: '', category: 'response_style' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo agregar feedback', variant: 'destructive' });
    }
  };

  // Delete feedback
  const handleDeleteFeedback = async (id: string) => {
    try {
      const res = await fetch(`/api/feedback?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Eliminado', description: 'Feedback eliminado' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  // Update lead status
  const handleUpdateLeadStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Actualizado', description: 'Estado del lead actualizado' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  // Delete lead
  const handleDeleteLead = async (id: string) => {
    try {
      const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Eliminado', description: 'Lead eliminado' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      new: { variant: 'default', label: 'Nuevo' },
      contacted: { variant: 'secondary', label: 'Contactado' },
      converted: { variant: 'default', label: 'Convertido' },
      lost: { variant: 'destructive', label: 'Perdido' },
    };
    const style = styles[status] || { variant: 'outline', label: status };
    return <Badge variant={style.variant}>{style.label}</Badge>;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: 'Texto copiado al portapapeles' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bot Autónomo Telegram</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Powered by AI</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {status && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${status.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {status.isConnected ? `@${status.botUsername}` : 'Desconectado'}
                  </span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="leads" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Leads</span>
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configuración</span>
              </TabsTrigger>
              <TabsTrigger value="learning" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Aprendizaje</span>
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Estado del Bot</CardTitle>
                    {status?.isConnected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {status?.isConnected ? 'Conectado' : 'Desconectado'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {status?.botUsername ? `@${status.botUsername}` : 'Sin configurar'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Total Leads</CardTitle>
                    <Users className="w-5 h-5 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.totalLeads || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      +{status?.todayLeads || 0} hoy
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Mensajes Hoy</CardTitle>
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.todayMessages || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      {status?.todayStats.messagesIn || 0} recibidos
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Aprendizajes</CardTitle>
                    <Brain className="w-5 h-5 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.activeFeedback || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Reglas activas
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Acción Rápida
                    </CardTitle>
                    <CardDescription>
                      {status?.isConnected 
                        ? 'Tu bot está funcionando y capturando leads automáticamente'
                        : 'Conecta tu bot para empezar a capturar leads automáticamente'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {status?.isConnected ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Bot activo y funcionando</span>
                          </div>
                          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-2">
                            Los mensajes que recibas en Telegram serán procesados por IA automáticamente.
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          onClick={handleDisconnectBot}
                          disabled={isConnecting}
                        >
                          {isConnecting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Desconectar Bot
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => setActiveTab('config')} className="w-full">
                        <Settings className="w-4 h-4 mr-2" />
                        Ir a Configuración
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Actividad Reciente
                    </CardTitle>
                    <CardDescription>
                      Últimos leads capturados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {leads.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No hay leads todavía</p>
                        <p className="text-sm">Conecta tu bot para empezar a capturar</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-48">
                        <div className="space-y-3">
                          {leads.slice(0, 5).map((lead) => (
                            <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                                  {lead.firstName?.[0] || lead.username?.[0] || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{lead.firstName || lead.username || 'Sin nombre'}</p>
                                  <p className="text-xs text-slate-500">{lead.phone || 'Sin teléfono'}</p>
                                </div>
                              </div>
                              {getStatusBadge(lead.status)}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Instructions */}
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-500" />
                    Cómo Funciona
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
                      <div>
                        <h4 className="font-medium">Crea un Bot</h4>
                        <p className="text-sm text-slate-500">Ve a @BotFather en Telegram y crea un nuevo bot para obtener tu token.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
                      <div>
                        <h4 className="font-medium">Conecta el Token</h4>
                        <p className="text-sm text-slate-500">Pega el token y la URL pública en la configuración para activar el webhook.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold shrink-0">3</div>
                      <div>
                        <h4 className="font-medium">Captura Leads</h4>
                        <p className="text-sm text-slate-500">El bot usa IA para conversar y capturar datos de clientes automáticamente.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Leads Tab */}
            <TabsContent value="leads" className="space-y-6">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        Leads Capturados
                      </CardTitle>
                      <CardDescription>
                        {leads.length} leads en total
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={fetchData}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Actualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {leads.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                      <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">No hay leads todavía</h3>
                      <p className="text-slate-500 dark:text-slate-500 mt-1">Los leads aparecerán aquí cuando el bot capture datos de clientes.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads.map((lead) => (
                            <TableRow key={lead.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                                    {lead.firstName?.[0] || lead.username?.[0] || '?'}
                                  </div>
                                  <div>
                                    <p className="font-medium">{lead.firstName || '-'}</p>
                                    {lead.lastName && <p className="text-xs text-slate-500">{lead.lastName}</p>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {lead.phone ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{lead.phone}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.username ? `@${lead.username}` : '-'}
                              </TableCell>
                              <TableCell>{getStatusBadge(lead.status)}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {new Date(lead.createdAt).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm" onClick={() => setSelectedLead(lead)}>
                                        <MessageSquare className="w-4 h-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                      <DialogHeader>
                                        <DialogTitle>Conversación con {lead.firstName || lead.username}</DialogTitle>
                                        <DialogDescription>
                                          Historial de mensajes
                                        </DialogDescription>
                                      </DialogHeader>
                                      <ScrollArea className="h-96 rounded-lg border p-4 bg-slate-50 dark:bg-slate-900">
                                        {lead.messages && lead.messages.length > 0 ? (
                                          <div className="space-y-3">
                                            {lead.messages.map((msg) => (
                                              <div key={msg.id} className={`flex ${msg.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-lg ${
                                                  msg.direction === 'incoming' 
                                                    ? 'bg-white dark:bg-slate-800 border' 
                                                    : 'bg-emerald-500 text-white'
                                                }`}>
                                                  <p className="text-sm">{msg.content}</p>
                                                  <p className="text-xs opacity-70 mt-1">
                                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-center text-slate-500">Sin mensajes</p>
                                        )}
                                      </ScrollArea>
                                    </DialogContent>
                                  </Dialog>
                                  
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Editar Lead</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label>Estado</Label>
                                          <select 
                                            className="w-full p-2 border rounded-lg"
                                            defaultValue={lead.status}
                                            onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                          >
                                            <option value="new">Nuevo</option>
                                            <option value="contacted">Contactado</option>
                                            <option value="converted">Convertido</option>
                                            <option value="lost">Perdido</option>
                                          </select>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleDeleteLead(lead.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bot Connection */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-500" />
                      Conexión del Bot
                    </CardTitle>
                    <CardDescription>
                      Configura tu bot de Telegram
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="token">Token del Bot</Label>
                      <Input
                        id="token"
                        type="password"
                        placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                      />
                      <p className="text-xs text-slate-500">
                        Obtén tu token de <span className="font-medium">@BotFather</span> en Telegram
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="webhook">URL Pública del Servidor</Label>
                      <Input
                        id="webhook"
                        placeholder="https://tu-servidor.com"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                      />
                      <p className="text-xs text-slate-500">
                        URL donde está alojado este dashboard (sin /api al final)
                      </p>
                    </div>
                    
                    <Separator />
                    
                    {status?.isConnected ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Bot conectado: @{status.botUsername}</span>
                          </div>
                        </div>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          onClick={handleDisconnectBot}
                          disabled={isConnecting}
                        >
                          {isConnecting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Desconectar Bot
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        className="w-full" 
                        onClick={handleConnectBot}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Conectando...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Conectar Bot
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* System Prompt */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      Personalidad del Bot
                    </CardTitle>
                    <CardDescription>
                      Define cómo responde el bot a los clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prompt">System Prompt</Label>
                      <Textarea
                        id="prompt"
                        placeholder="Eres un asistente amable y profesional..."
                        className="min-h-48"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleUpdatePrompt} className="w-full">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Prompt
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Instructions */}
              <Card className="border-0 shadow-md border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                    Guía de Configuración
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                      <h4 className="font-medium mb-2">¿Cómo obtener el Token de Telegram?</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li>Abre Telegram y busca <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">@BotFather</span></li>
                        <li>Envía el comando <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">/newbot</span></li>
                        <li>Sigue las instrucciones para nombrar tu bot</li>
                        <li>Copia el token que te proporciona (formato: 123456789:ABC...)</li>
                      </ol>
                    </div>
                    
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <h4 className="font-medium mb-2">¿Qué URL de Webhook usar?</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        La URL debe ser la dirección pública donde está alojado este servidor. 
                        Telegram necesita poder acceder a esta URL para enviar los mensajes.
                        <br /><br />
                        <strong>Ejemplo:</strong> <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">https://tu-dominio.com</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Learning Tab */}
            <TabsContent value="learning" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add Feedback */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-500" />
                      Agregar Aprendizaje
                    </CardTitle>
                    <CardDescription>
                      Enseña al bot cómo responder mejor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="trigger">Cuando el cliente diga algo como...</Label>
                      <Textarea
                        id="trigger"
                        placeholder="Ej: ¿Cuánto cuesta el servicio?"
                        value={newFeedback.triggerText}
                        onChange={(e) => setNewFeedback({ ...newFeedback, triggerText: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="correction">El bot debe responder...</Label>
                      <Textarea
                        id="correction"
                        placeholder="Ej: responde con los precios: Plan Básico $50/mes, Plan Pro $100/mes"
                        value={newFeedback.correction}
                        onChange={(e) => setNewFeedback({ ...newFeedback, correction: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoría</Label>
                      <select 
                        id="category"
                        className="w-full p-2 border rounded-lg"
                        value={newFeedback.category}
                        onChange={(e) => setNewFeedback({ ...newFeedback, category: e.target.value })}
                      >
                        <option value="response_style">Estilo de respuesta</option>
                        <option value="information">Información específica</option>
                        <option value="tone">Tono</option>
                        <option value="sales">Ventas</option>
                      </select>
                    </div>
                    
                    <Button onClick={handleAddFeedback} className="w-full">
                      <Brain className="w-4 h-4 mr-2" />
                      Guardar Aprendizaje
                    </Button>
                  </CardContent>
                </Card>

                {/* Active Learnings */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      Aprendizajes Activos
                    </CardTitle>
                    <CardDescription>
                      {feedbacks.length} reglas de aprendizaje
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feedbacks.length === 0 ? (
                      <div className="text-center py-8">
                        <Brain className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500">No hay aprendizajes configurados</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-80">
                        <div className="space-y-3">
                          {feedbacks.map((fb) => (
                            <div key={fb.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">"{fb.triggerText}"</p>
                                  <p className="text-xs text-slate-500 mt-1">{fb.correction}</p>
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    {fb.category}
                                  </Badge>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteFeedback(fb.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Learning from Telegram */}
              <Card className="border-0 shadow-md border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Terminal className="w-5 h-5" />
                    Modo Aprendizaje desde Telegram
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      También puedes enseñar al bot directamente desde Telegram. Cuando el bot dé una respuesta incorrecta:
                    </p>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg font-mono text-sm">
                      <p className="text-slate-500"># Ejemplo:</p>
                      <p>Bot, no digas eso. En lugar de eso, responde con...</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      El bot detectará automáticamente que es una corrección y la guardará como aprendizaje.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <p>Bot Autónomo Telegram &copy; {new Date().getFullYear()}</p>
            <p className="flex items-center gap-1">
              Built with <span className="text-red-500">♥</span> by <span className="font-medium">GLM AI</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Missing import
function Save({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}
