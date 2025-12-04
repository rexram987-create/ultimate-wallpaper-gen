import React, { useState, useRef, useEffect } from 'react';
import { generateWallpaper } from './services/geminiService';
import { ChatMessage, Role, AspectRatio } from './types';
import { Button } from './components/Button';
import { 
  Send, Image as ImageIcon, Smartphone, Monitor, Download, 
  Trash2, Wand2, RefreshCw, X, Edit, Grid, Square, Palette, Sparkles 
} from 'lucide-react';

const MUSEUM_FRAME_STYLE = {
  border: '12px ridge #d4af37',
  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 10px 20px rgba(0,0,0,0.5)',
  backgroundColor: '#1a1a1a'
};

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // ברירת מחדל: יחס 9:16 (טלפון)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  
  const [uploadedImage, setUploadedImage] = useState<string | undefined>(undefined);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<'creative' | 'styles'>('creative');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const welcomeText = appMode === 'creative'
      ? "Hello! I'm your AI Art Director. Choose ratio (Mobile/PC) and describe your vision."
      : "Welcome to Style Master. I will generate 7 distinct styles (including Japanese Art).";

    setMessages([{
      id: '1',
      role: 'assistant',
      content: welcomeText,
      timestamp: Date.now()
    }]);
  }, [appMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() && !uploadedImage) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      image: uploadedImage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setUploadedImage(undefined);
    setIsLoading(true);

    try {
      // אם המצב הוא סגנונות - מייצרים 7 תמונות!
      const count = appMode === 'styles' ? 7 : 1;
      
      const result = await generateWallpaper({
        prompt: userMessage.content,
        baseImageBase64: userMessage.image,
        aspectRatio,
        count: count,
        mode: appMode
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        relatedImages: result.images,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wallpaper-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Ultimate Gen
            </h1>
            
            {/* Aspect Ratio Selector */}
            <div className="flex bg-slate-800 rounded-lg p-1">
                <button 
                  onClick={() => setAspectRatio('9:16')}
                  className={`p-2 rounded-md transition-all ${aspectRatio === '9:16' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                  title="Mobile (9:16)"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setAspectRatio('16:9')}
                  className={`p-2 rounded-md transition-all ${aspectRatio === '16:9' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                  title="Desktop (16:9)"
                >
                  <Monitor className="w-4 h-4" />
                </button>
            </div>
          </div>
          
          {/* Mode Switcher */}
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setAppMode('creative')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                appMode === 'creative' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span className="text-sm font-medium">Creative AI</span>
            </button>
            <button
              onClick={() => setAppMode('styles')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                appMode === 'styles' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span className="text-sm font-medium">Pro Styles (x7)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat */}
      <main className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-slate-800/80 border border-slate-700 text-slate-100 rounded-tl-none'
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {msg.relatedImages && (
                  <div className={`grid gap-2 mt-2 w-full ${msg.relatedImages.length > 1 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
                    {msg.relatedImages.map((img, idx) => (
                      <div 
                        key={idx} 
                        className="relative group cursor-pointer overflow-hidden"
                        style={MUSEUM_FRAME_STYLE}
                        onClick={() => setFullScreenImage(img)}
                      >
                        <img 
                          src={img} 
                          alt="Generated wallpaper" 
                          className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="bg-slate-900/80 backdrop-blur-md border-t border-slate-800 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={appMode === 'creative' ? "Describe image..." : "Enter subject for 7 styles..."}
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <Button onClick={handleSend} disabled={isLoading} variant="primary" className="rounded-xl px-4">
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </footer>

      {/* Full Screen */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <button 
            onClick={() => setFullScreenImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="relative max-w-full max-h-full flex flex-col items-center gap-4">
            <div style={MUSEUM_FRAME_STYLE} className="relative">
              <img 
                src={fullScreenImage} 
                alt="Full screen" 
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>
            <Button 
              onClick={() => handleDownload(fullScreenImage)}
              variant="primary"
              className="mt-4 flex items-center gap-2 shadow-xl hover:scale-105 transition-transform"
            >
              <Download className="w-4 h-4" /> Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
