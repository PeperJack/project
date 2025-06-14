import { useState, useEffect } from 'react';
import { MessageSquare, Send, Search, Phone, Clock, Check, CheckCheck } from 'lucide-react';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simuler des conversations
    setConversations([
      {
        id: 1,
        customerName: 'Mohammed Ali',
        phoneNumber: '+212 6 12 34 56 78',
        lastMessage: 'Je voudrais commander 2 t-shirts',
        timestamp: new Date().toISOString(),
        unread: 2,
        messages: [
          { id: 1, text: 'Bonjour', from: 'customer', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: 2, text: 'Bonjour! Comment puis-je vous aider?', from: 'agent', timestamp: new Date(Date.now() - 3500000).toISOString() },
          { id: 3, text: 'Je voudrais commander 2 t-shirts', from: 'customer', timestamp: new Date(Date.now() - 3000000).toISOString() }
        ]
      },
      {
        id: 2,
        customerName: 'Fatima Zahra',
        phoneNumber: '+212 6 98 76 54 32',
        lastMessage: 'Merci pour votre aide!',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        unread: 0,
        messages: [
          { id: 1, text: 'Ma commande est-elle prête?', from: 'customer', timestamp: new Date(Date.now() - 90000000).toISOString() },
          { id: 2, text: 'Oui, elle sera expédiée demain', from: 'agent', timestamp: new Date(Date.now() - 87000000).toISOString() },
          { id: 3, text: 'Merci pour votre aide!', from: 'customer', timestamp: new Date(Date.now() - 86400000).toISOString() }
        ]
      }
    ]);
  }, []);

  const filteredConversations = conversations.filter(conv =>
    conv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.phoneNumber.includes(searchTerm)
  );

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    const newMessage = {
      id: Date.now(),
      text: messageText,
      from: 'agent',
      timestamp: new Date().toISOString()
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id === selectedConversation.id) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: messageText,
          timestamp: newMessage.timestamp
        };
      }
      return conv;
    }));

    setSelectedConversation(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));

    setMessageText('');
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow">
      {/* Liste des conversations */}
      <div className="w-1/3 border-r border-gray-200">
        {/* Recherche */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="overflow-y-auto h-[calc(100%-5rem)]">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                selectedConversation?.id === conversation.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{conversation.customerName}</h3>
                    <span className="text-xs text-gray-500">
                      {new Date(conversation.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <Phone className="w-3 h-3" />
                    {conversation.phoneNumber}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 truncate">{conversation.lastMessage}</p>
                </div>
                {conversation.unread > 0 && (
                  <span className="ml-2 bg-indigo-600 text-white text-xs rounded-full px-2 py-1">
                    {conversation.unread}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone de chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedConversation.customerName}</h2>
                  <p className="text-sm text-gray-500">{selectedConversation.phoneNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg">
                    <Phone className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.from === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      message.from === 'agent'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <div className={`flex items-center gap-1 mt-1 ${
                      message.from === 'agent' ? 'text-indigo-200' : 'text-gray-500'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">
                        {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.from === 'agent' && <CheckCheck className="w-3 h-3 ml-1" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Tapez votre message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!messageText.trim()}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Sélectionnez une conversation pour commencer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;