import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, CheckCircle, AlertCircle, User, MessageSquare, ListTodo } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { missionService } from '../../services/missionService';

interface SquadOpsPanelProps {
  squadId: string;
  currentUserId: string;
  onLocateMessage: (lat: number, lng: number) => void;
  selectedSegment?: any; // If a segment is selected on map, we can attach it to chat
}

export const SquadOpsPanel: React.FC<SquadOpsPanelProps> = ({ squadId, currentUserId, onLocateMessage, selectedSegment }) => {
  const [activeTab, setActiveTab] = useState<'CHAT' | 'TASKS'>('CHAT');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    loadMessages();
    loadMembers();

    // Subscribe to new messages
    const channel = supabase
      .channel('squad_chat_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'squad_chat', filter: `squad_id=eq.${squadId}` },
        (payload) => {
            // Fetch full message with sender info (since payload only has IDs)
            // For now, just append payload and we might miss sender email until refresh
            // Better: fetch the single new message
            fetchNewMessage(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [squadId]);

  const loadMessages = async () => {
    const { data } = await missionService.getChatMessages(squadId);
    if (data) setMessages(data);
  };

  const loadMembers = async () => {
    const { data } = await missionService.getSquadMembers(squadId);
    if (data) setMembers(data);
  };

  const fetchNewMessage = async (id: string) => {
    const { data } = await supabase
        .from('squad_chat')
        .select(`*, sender:sender_id(email)`)
        .eq('id', id)
        .single();
    if (data) {
        setMessages(prev => [...prev, data]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // Check for @mentions (simple logic for now)
    // In a real app, we'd parse this and create notifications
    
    await missionService.sendChatMessage(
        squadId, 
        currentUserId, 
        newMessage, 
        selectedSegment?.properties?.id,
        // If segment selected, use its center? Or user's current location?
        // For now, let's just pass null for location unless we have it
        undefined 
    );
    
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-full bg-background-default border-l border-stroke-default shadow-xl w-80 pointer-events-auto">
      {/* Header Tabs */}
      <div className="flex border-b border-stroke-default">
        <button 
          onClick={() => setActiveTab('CHAT')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'CHAT' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-content-subtle'}`}
        >
          <MessageSquare size={16} /> Squad Chat
        </button>
        <button 
          onClick={() => setActiveTab('TASKS')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'TASKS' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-content-subtle'}`}
        >
          <ListTodo size={16} /> Tasks
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'CHAT' ? (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender_id === currentUserId ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                  msg.sender_id === currentUserId 
                    ? 'bg-brand-primary text-white rounded-br-none' 
                    : 'bg-background-subtle text-content-default rounded-bl-none'
                }`}>
                  {/* Sender Name */}
                  {msg.sender_id !== currentUserId && (
                    <div className="text-xs opacity-70 mb-1 font-bold">
                        {msg.sender?.email?.split('@')[0] || 'User'}
                    </div>
                  )}
                  
                  {/* Message Body */}
                  <div>{msg.message}</div>

                  {/* Context Attachment */}
                  {msg.related_segment_id && (
                    <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1 text-xs cursor-pointer hover:underline">
                        <MapPin size={12} />
                        <span>Linked to Street</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-content-subtle mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center text-content-subtle mt-10">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>No active assignments.</p>
            <p className="text-xs mt-2">Leaders can assign streets from the map.</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      {activeTab === 'CHAT' && (
        <div className="p-3 border-t border-stroke-default bg-background-subtle">
            {selectedSegment && (
                <div className="text-xs flex items-center gap-1 text-brand-primary mb-2 bg-brand-primary/10 p-1 rounded px-2">
                    <MapPin size={12} />
                    <span>Attaching: {selectedSegment.properties.name || 'Selected Street'}</span>
                    <button className="ml-auto hover:text-status-error" onClick={() => {/* clear selection logic passed down? */}}>×</button>
                </div>
            )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={selectedSegment ? "Discuss this street..." : "Message squad..."}
              className="flex-1 bg-background-default border border-stroke-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
            />
            <button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
