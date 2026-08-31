import { supabase } from '../lib/supabase';

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationRow {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  created_at: string;
  last_message_at: string;
}

export interface Conversation {
  id: string;
  listingId: string;
  guestId: string;
  hostId: string;
  createdAt: Date;
  lastMessageAt: Date;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: new Date(row.created_at),
    readAt: row.read_at ? new Date(row.read_at) : null,
  };
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    listingId: row.listing_id,
    guestId: row.guest_id,
    hostId: row.host_id,
    createdAt: new Date(row.created_at),
    lastMessageAt: new Date(row.last_message_at),
  };
}

class MessageService {
  /**
   * Finds or creates the (listing, guest) conversation - the RLS
   * `UNIQUE (listing_id, guest_id)` constraint means calling this again for
   * the same listing/guest just returns the existing thread. `guestId` and
   * `hostId` are always the real guest/host, regardless of which of them is
   * the one currently starting the conversation (a host reaching out to a
   * past guest calls this the same way a guest messaging a host does) -
   * callers send the actual first message via `sendMessage()` afterwards
   * with whichever of the two is the current user as `senderId`.
   */
  async findOrCreateConversation(listingId: string, guestId: string, hostId: string): Promise<Conversation> {
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('listing_id', listingId)
      .eq('guest_id', guestId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return mapConversation(existing as ConversationRow);

    const { data, error } = await supabase
      .from('conversations')
      .insert([{ listing_id: listingId, guest_id: guestId, host_id: hostId }])
      .select('*')
      .single();
    if (error || !data) throw error || new Error('Failed to start conversation');
    return mapConversation(data as ConversationRow);
  }

  async startConversation(
    listingId: string,
    guestId: string,
    hostId: string,
    senderId: string,
    body: string
  ): Promise<Conversation> {
    const conversation = await this.findOrCreateConversation(listingId, guestId, hostId);
    await this.sendMessage(conversation.id, senderId, body);
    return conversation;
  }

  async getConversationsForUser(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`guest_id.eq.${userId},host_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
    return (data as ConversationRow[]).map(mapConversation);
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error fetching conversation:', error);
      return undefined;
    }
    return mapConversation(data as ConversationRow);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
    return (data as MessageRow[]).map(mapMessage);
  }

  async sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Message cannot be empty');

    const { data, error } = await supabase
      .from('messages')
      .insert([{ conversation_id: conversationId, sender_id: senderId, body: trimmed }])
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to send message');
    return mapMessage(data as MessageRow);
  }

  async markRead(conversationId: string, readerId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', readerId)
      .is('read_at', null);

    if (error) console.error('Error marking messages read:', error);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const conversations = await this.getConversationsForUser(userId);
    if (conversations.length === 0) return 0;

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversations.map((c) => c.id))
      .neq('sender_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
    return count || 0;
  }

  /** Live updates for a single open thread. Returns an unsubscribe function. */
  subscribeToConversation(conversationId: string, onMessage: (message: Message) => void): () => void {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onMessage(mapMessage(payload.new as MessageRow))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const messageService = new MessageService();
