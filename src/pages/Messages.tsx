import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { messageService, Conversation, Message } from '@/services/messageService';
import { profileService } from '@/services/profileService';
import { listingService } from '@/services/listingService';
import { formatDistanceToNow } from 'date-fns';

interface ConversationSummary {
  conversation: Conversation;
  otherPartyName: string;
  listingTitle: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summaries, setSummaries] = useState<ConversationSummary[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeId = searchParams.get('c') || summaries?.[0]?.conversation.id;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const conversations = await messageService.getConversationsForUser(user.id);
        const enriched = await Promise.all(
          conversations.map(async (conversation) => {
            const otherId = conversation.guestId === user.id ? conversation.hostId : conversation.guestId;
            const [otherProfile, listing] = await Promise.all([
              profileService.getByUserId(otherId),
              listingService.getById(conversation.listingId),
            ]);
            return {
              conversation,
              otherPartyName: otherProfile
                ? `${otherProfile.first_name} ${otherProfile.last_name}`.trim()
                : 'Trivara user',
              listingTitle: listing?.title || 'Listing',
            };
          })
        );
        if (!cancelled) setSummaries(enriched);
      } catch (error) {
        console.error('Error loading conversations:', error);
        if (!cancelled) setSummaries([]);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!activeId || !user?.id) return;
    let cancelled = false;

    messageService.getMessages(activeId).then((data) => {
      if (!cancelled) setMessages(data);
    }).catch((error) => {
      console.error('Error loading messages:', error);
    });
    messageService.markRead(activeId, user.id);

    const unsubscribe = messageService.subscribeToConversation(activeId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      if (message.senderId !== user.id) {
        messageService.markRead(activeId, user.id);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeId, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!activeId || !user?.id || !draft.trim()) return;
    setSending(true);
    try {
      const message = await messageService.sendMessage(activeId, user.id, draft.trim());
      setMessages((prev) => [...prev, message]);
      setDraft('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [activeId, user?.id, draft]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-3xl font-display font-medium text-foreground mb-6">Messages</h1>

        {summaries === null ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="py-20 text-center text-text-secondary">
            <MessageCircle className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <p>No conversations yet. Message a host from any listing page to start one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-220px)] min-h-[400px]">
            <div className="md:col-span-1 border border-border rounded-xl overflow-y-auto">
              {summaries.map(({ conversation, otherPartyName, listingTitle }) => (
                <button
                  key={conversation.id}
                  onClick={() => setSearchParams({ c: conversation.id })}
                  className={`w-full text-left p-4 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors ${
                    activeId === conversation.id ? 'bg-surface-2' : ''
                  }`}
                >
                  <p className="font-medium text-foreground truncate">{otherPartyName}</p>
                  <p className="text-sm text-text-secondary truncate">{listingTitle}</p>
                  <p className="text-xs text-text-meta mt-1">
                    {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>

            <div className="md:col-span-2 border border-border rounded-xl flex flex-col overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      message.senderId === user.id
                        ? 'ml-auto bg-accent text-accent-foreground'
                        : 'bg-surface-2 text-foreground'
                    }`}
                  >
                    {message.body}
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3 flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Write a message..."
                  className="min-h-[44px] max-h-32 resize-none"
                />
                <Button onClick={handleSend} disabled={sending || !draft.trim()} size="icon" className="flex-shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
