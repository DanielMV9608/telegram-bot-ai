'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Database,
  Globe,
  FileText,
  Link,
  Loader2,
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

interface Knowledge {
  id: string;
  title: string;
  type: string;
  content: string;
  sourceUrl: string | null;
  fileName: string | null;
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
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Form states
  const [tokenInput, setTokenInput] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  // AI Configuration
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [isSavingAI, setIsSavingAI] = useState(false);
  
  // Feedback form
  const [newFeedback, setNewFeedback] = useState({ triggerText: '', correction: '', category: 'response_style' });
  
  // Knowledge form
  const [newKnowledge, setNewKnowledge] = useState({ title: '', type: 'text', content: '', sourceUrl: '' });
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  
  // Selected lead for details
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Fetch all data - silent=true para actualizaciones en segundo plano
  const fetchData = async (silent = false, retryCount = 0) => {
    // Solo mostrar loading en la primera carga o cuando el usuario lo solicita
    if (!silent && retryCount === 0) setLoading(true);
    try {
      const [statusRes, leadsRes, feedbackRes, configRes, knowledgeRes] = await Promise.all([
        fetch('/api/bot/status', { cache: 'no-store' }),
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/feedback', { cache: 'no-store' }),
        fetch('/api/bot/config', { cache: 'no-store' }),
        fetch('/api/knowledge', { cache: 'no-store' }),
      ]);
      
      const statusData = await statusRes.json();
      const leadsData = await leadsRes.json();
      const feedbackData = await feedbackRes.json();
      const configData = await configRes.json();
      const knowledgeData = await knowledgeRes.json();
      
      if (statusData.success) setStatus(statusData.status);
      if (leadsData.success) setLeads(leadsData.leads);
      if (feedbackData.success) setFeedbacks(feedbackData.feedbacks);
      if (configData.success) {
        setConfig(configData.config);
        setSystemPrompt(configData.config.systemPrompt || '');
        // Cargar configuración de IA guardada
        if (configData.config.aiProvider) setAiProvider(configData.config.aiProvider);
        if (configData.config.aiModel) setAiModel(configData.config.aiModel);
      }
      if (knowledgeData.success) setKnowledge(knowledgeData.knowledge);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Reintentar hasta 2 veces
      if (retryCount < 2) {
        console.log(`Reintentando... (${retryCount + 1}/2)`);
        setTimeout(() => fetchData(silent, retryCount + 1), 1000);
        return;
      }
      // Solo mostrar toast de error si no es silencioso
      if (!silent) {
        toast({ title: 'Error de conexión', description: 'No se pudieron cargar los datos. Verifica tu conexión.', variant: 'destructive' });
      }
    } finally {
      if (!silent && (retryCount === 0 || retryCount >= 2)) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Primera carga con loading
    const interval = setInterval(() => fetchData(true), 30000); // Actualizaciones silenciosas
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
      const saveRes = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput, isActive: true }),
      });
      
      if (!saveRes.ok) throw new Error('Error al guardar token');
      
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

  // Extract content from URL
  const handleExtractUrl = async () => {
    if (!newKnowledge.sourceUrl) {
      toast({ title: 'Error', description: 'Ingresa una URL', variant: 'destructive' });
      return;
    }
    
    setIsExtractingUrl(true);
    try {
      const res = await fetch('/api/knowledge/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newKnowledge.sourceUrl }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setNewKnowledge({
          ...newKnowledge,
          title: data.data.title || 'Contenido extraído',
          content: data.data.content,
          type: 'url'
        });
        toast({ title: '¡Listo!', description: 'Contenido extraído de la URL' });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo extraer el contenido', variant: 'destructive' });
    } finally {
      setIsExtractingUrl(false);
    }
  };

  // Add knowledge
  const handleAddKnowledge = async () => {
    if (!newKnowledge.title || !newKnowledge.content) {
      toast({ title: 'Error', description: 'Completa título y contenido', variant: 'destructive' });
      return;
    }
    
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKnowledge),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: '¡Agregado!', description: 'Información añadida a la base de conocimiento' });
        setNewKnowledge({ title: '', type: 'text', content: '', sourceUrl: '' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo agregar', variant: 'destructive' });
    }
  };

  // Delete knowledge
  const handleDeleteKnowledge = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: 'Eliminado', description: 'Información eliminada' });
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

  // Get knowledge type badge
  const getKnowledgeTypeBadge = (type: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string; icon: React.ReactNode }> = {
      text: { variant: 'default', label: 'Texto', icon: <FileText className="w-3 h-3" /> },
      url: { variant: 'secondary', label: 'URL', icon: <Globe className="w-3 h-3" /> },
      pdf: { variant: 'outline', label: 'PDF', icon: <FileText className="w-3 h-3" /> },
    };
    const style = styles[type] || styles.text;
    return <Badge variant={style.variant} className="flex items-center gap-1">{style.icon}{style.label}</Badge>;
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
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="leads" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Leads</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">Conocimiento</span>
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
              <TabsTrigger value="learning" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">IA</span>
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
                    <p className="text-xs text-slate-500 mt-1">+{status?.todayLeads || 0} hoy</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Mensajes Hoy</CardTitle>
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status?.todayMessages || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">{status?.todayStats.messagesIn || 0} recibidos</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Conocimiento</CardTitle>
                    <Database className="w-5 h-5 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{knowledge.length}</div>
                    <p className="text-xs text-slate-500 mt-1">Fuentes activas</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Estado del Sistema
                    </CardTitle>
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
                        <Button variant="destructive" onClick={handleDisconnectBot} disabled={isConnecting} className="w-full">
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
                  </CardHeader>
                  <CardContent>
                    {leads.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No hay leads todavía</p>
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
                      <CardDescription>{leads.length} leads en total</CardDescription>
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
                                  <p className="font-medium">{lead.firstName || '-'}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {lead.phone ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{lead.phone}</span>
                                  </div>
                                ) : <span className="text-slate-400">-</span>}
                              </TableCell>
                              <TableCell>{lead.username ? `@${lead.username}` : '-'}</TableCell>
                              <TableCell>{getStatusBadge(lead.status)}</TableCell>
                              <TableCell>
                                <div className="text-sm">{new Date(lead.createdAt).toLocaleDateString()}</div>
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
                                      </DialogHeader>
                                      <ScrollArea className="h-96 rounded-lg border p-4 bg-slate-50 dark:bg-slate-900">
                                        {lead.messages && lead.messages.length > 0 ? (
                                          <div className="space-y-3">
                                            {lead.messages.map((msg) => (
                                              <div key={msg.id} className={`flex ${msg.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-lg ${msg.direction === 'incoming' ? 'bg-white dark:bg-slate-800 border' : 'bg-emerald-500 text-white'}`}>
                                                  <p className="text-sm">{msg.content}</p>
                                                  <p className="text-xs opacity-70 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : <p className="text-center text-slate-500">Sin mensajes</p>}
                                      </ScrollArea>
                                    </DialogContent>
                                  </Dialog>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteLead(lead.id)}>
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

            {/* Knowledge Tab */}
            <TabsContent value="knowledge" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add Knowledge */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-500" />
                      Agregar Conocimiento
                    </CardTitle>
                    <CardDescription>
                      Agrega información para que el bot responda mejor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* URL Extractor */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Label className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Globe className="w-4 h-4" />
                        Extraer de URL
                      </Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="https://tu-negocio.com"
                          value={newKnowledge.sourceUrl}
                          onChange={(e) => setNewKnowledge({ ...newKnowledge, sourceUrl: e.target.value })}
                        />
                        <Button onClick={handleExtractUrl} disabled={isExtractingUrl}>
                          {isExtractingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Extrae automáticamente el contenido de una página web</p>
                    </div>

                    <Separator />

                    {/* Manual Input */}
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        placeholder="Ej: Precios de servicios"
                        value={newKnowledge.title}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Contenido / Información</Label>
                      <Textarea
                        placeholder="Escribe aquí la información que quieres que el bot sepa..."
                        className="min-h-32"
                        value={newKnowledge.content}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <select
                        className="w-full p-2 border rounded-lg"
                        value={newKnowledge.type}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, type: e.target.value })}
                      >
                        <option value="text">Texto manual</option>
                        <option value="url">Contenido web</option>
                        <option value="pdf">PDF (próximamente)</option>
                      </select>
                    </div>

                    <Button onClick={handleAddKnowledge} className="w-full">
                      <Database className="w-4 h-4 mr-2" />
                      Guardar en Base de Conocimiento
                    </Button>
                  </CardContent>
                </Card>

                {/* Knowledge List */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-purple-500" />
                      Base de Conocimiento
                    </CardTitle>
                    <CardDescription>{knowledge.length} fuentes de información</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {knowledge.length === 0 ? (
                      <div className="text-center py-8">
                        <Database className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500">No hay información guardada</p>
                        <p className="text-sm text-slate-400">Agrega contenido para que el bot responda mejor</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-80">
                        <div className="space-y-3">
                          {knowledge.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getKnowledgeTypeBadge(item.type)}
                                    <span className="font-medium text-sm truncate">{item.title}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 line-clamp-2">{item.content}</p>
                                  {item.sourceUrl && (
                                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                                      <Globe className="w-3 h-3" />
                                      {item.sourceUrl.substring(0, 40)}...
                                    </a>
                                  )}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteKnowledge(item.id)}>
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

              {/* Info Card */}
              <Card className="border-0 shadow-md border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Info className="w-5 h-5" />
                    ¿Cómo funciona?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <Globe className="w-8 h-8 text-blue-500 mb-2" />
                      <h4 className="font-medium">1. Extrae URLs</h4>
                      <p className="text-sm text-slate-500">Pega la URL de tu negocio y extraemos la información automáticamente</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <FileText className="w-8 h-8 text-emerald-500 mb-2" />
                      <h4 className="font-medium">2. Agrega textos</h4>
                      <p className="text-sm text-slate-500">Escribe precios, servicios, horarios y cualquier información relevante</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <Brain className="w-8 h-8 text-purple-500 mb-2" />
                      <h4 className="font-medium">3. El bot aprende</h4>
                      <p className="text-sm text-slate-500">La IA usa esta información para responder preguntas de clientes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-500" />
                      Conexión del Bot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Token del Bot</Label>
                      <Input
                        type="password"
                        placeholder="123456789:ABCdefGHI..."
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                      />
                      <p className="text-xs text-slate-500">Obtén tu token de @BotFather en Telegram</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>URL Pública</Label>
                      <Input
                        placeholder="https://tu-servidor.com"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                      />
                    </div>
                    
                    {status?.isConnected ? (
                      <Button variant="destructive" onClick={handleDisconnectBot} disabled={isConnecting} className="w-full">
                        {isConnecting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                        Desconectar Bot
                      </Button>
                    ) : (
                      <Button onClick={handleConnectBot} disabled={isConnecting} className="w-full">
                        {isConnecting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                        Conectar Bot
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      Configuración de IA
                    </CardTitle>
                    <CardDescription>Selecciona qué API de IA usará el bot</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Alerta informativa */}
                    {aiProvider === 'zai' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              Recomendación para producción
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              El modelo interno (z-ai) puede tener limitaciones en Vercel. 
                              Te recomendamos configurar <strong>Google Gemini</strong> (gratis) u <strong>OpenAI</strong> para mejor rendimiento.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Proveedor de IA</Label>
                      <select
                        className="w-full p-2 border rounded-lg bg-background"
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value)}
                      >
                        <option value="gemini">🔵 Google Gemini (Recomendado)</option>
                        <option value="openai">🟢 OpenAI (GPT-4)</option>
                        <option value="zai">🤖 z-ai (Interno - Limitado)</option>
                      </select>
                    </div>
                    
                    {aiProvider !== 'zai' && (
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          placeholder="sk-..."
                          value={aiApiKey}
                          onChange={(e) => setAiApiKey(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">
                          {aiProvider === 'openai' && 'Obtén tu API Key en platform.openai.com'}
                          {aiProvider === 'gemini' && 'Obtén tu API Key en aistudio.google.com'}
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <select
                        className="w-full p-2 border rounded-lg bg-background"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                      >
                        {aiProvider === 'openai' && (
                          <>
                            <option value="gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          </>
                        )}
                        {aiProvider === 'gemini' && (
                          <>
                            <optgroup label="Gemini 2.5 (Más recientes)">
                              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</option>
                              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            </optgroup>
                            <optgroup label="Gemini 3 (Experimental)">
                              <option value="gemini-3.5-flash-preview-06-17">Gemini 3.5 Flash Preview</option>
                            </optgroup>
                            <optgroup label="Gemini 1.5 (Estable)">
                              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            </optgroup>
                          </>
                        )}
                        {aiProvider === 'zai' && (
                          <option value="default">Modelo interno optimizado</option>
                        )}
                      </select>
                    </div>
                    
                    <Button 
                      onClick={async () => {
                        setIsSavingAI(true);
                        try {
                          const res = await fetch('/api/bot/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ aiProvider, aiApiKey, aiModel })
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast({ title: '✅ Guardado', description: 'Configuración de IA actualizada' });
                          } else {
                            throw new Error(data.error);
                          }
                        } catch (error) {
                          toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
                        } finally {
                          setIsSavingAI(false);
                        }
                      }}
                      disabled={isSavingAI}
                      className="w-full"
                    >
                      {isSavingAI ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                      Guardar Configuración IA
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      Personalidad del Bot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        placeholder="Eres un asistente amable..."
                        className="min-h-32"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleUpdatePrompt}>Guardar Prompt</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Learning Tab */}
            <TabsContent value="learning" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-500" />
                      Enseñar al Bot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cuando el cliente pregunte...</Label>
                      <Textarea
                        placeholder="Ej: ¿Cuánto cuesta el servicio?"
                        value={newFeedback.triggerText}
                        onChange={(e) => setNewFeedback({ ...newFeedback, triggerText: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>El bot debe responder...</Label>
                      <Textarea
                        placeholder="Ej: Nuestros precios son: Plan Básico $50, Plan Pro $100..."
                        value={newFeedback.correction}
                        onChange={(e) => setNewFeedback({ ...newFeedback, correction: e.target.value })}
                      />
                    </div>
                    
                    <Button onClick={handleAddFeedback} className="w-full">
                      <Brain className="w-4 h-4 mr-2" />
                      Guardar Aprendizaje
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      Aprendizajes Guardados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {feedbacks.length === 0 ? (
                      <div className="text-center py-8">
                        <Brain className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500">No hay aprendizajes guardados</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {feedbacks.map((fb) => (
                            <div key={fb.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border">
                              <p className="text-sm font-medium">"{fb.triggerText}"</p>
                              <p className="text-xs text-slate-500 mt-1">{fb.correction}</p>
                              <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteFeedback(fb.id)}>
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
