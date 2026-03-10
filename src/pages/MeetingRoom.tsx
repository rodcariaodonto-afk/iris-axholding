import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Clock, Users, Video, Loader2, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/Button';

interface AppointmentData {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  duration: number;
  type: string;
  attendees: string[] | null;
  meeting_url: string | null;
}

const MeetingRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;

    const fetchAppointment = async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, description, date, time, duration, type, attendees, meeting_url')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching appointment:', error);
      } else {
        setAppointment(data);
      }
      setLoading(false);
    };

    fetchAppointment();
  }, [id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background gap-4">
        <p className="text-muted-foreground">Agendamento não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/scheduling')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar aos Agendamentos
        </Button>
      </div>
    );
  }

  const jitsiRoomName = `axhub-${appointment.id.slice(0, 8)}`;
  const jitsiUrl = `https://meet.jit.si/${jitsiRoomName}#config.prejoinConfig.enabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.DEFAULT_BACKGROUND='#0a0a0f'`;

  const typeLabels: Record<string, string> = {
    demo: 'Demo',
    meeting: 'Reunião',
    support: 'Suporte',
    followup: 'Follow-up',
  };

  const formattedDate = new Date(appointment.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/scheduling')}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <h1 className="text-sm font-semibold text-foreground">{appointment.title}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {typeLabels[appointment.type] || appointment.type}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formattedDate} • {appointment.time.slice(0, 5)} • {appointment.duration}min
              </span>
              {appointment.attendees && appointment.attendees.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {appointment.attendees.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/scheduling')}
          >
            Sair da Reunião
          </Button>
        </div>
      </div>

      {/* Jitsi iframe */}
      <div className="flex-1 relative">
        <iframe
          src={jitsiUrl}
          className="w-full h-full border-0"
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          title="Sala de Reunião"
        />
      </div>
    </div>
  );
};

export default MeetingRoom;
