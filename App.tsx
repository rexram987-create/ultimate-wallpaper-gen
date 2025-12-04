import React, { useState, useRef, useEffect } from 'react';
import { generateWallpaper } from './services/geminiService';
import { ChatMessage, Role, AspectRatio } from './types';
import { Button } from './components/Button';
import { 
  Send, Image as ImageIcon, Smartphone, Monitor, Download, 
  Trash2, Wand2, RefreshCw, X, Edit, Grid, Square, Palette, Sparkles, ExternalLink 
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
  
  // ברירת מחדל: 9:16 (מתאים לטלפון)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  
  const [uploadedImage, setUploadedImage] = useState<string | undefined>(undefined);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  // מצב עבודה: Creative (רגיל) או Styles (ארבעת הסגנונות)
  const [appMode, setAppMode] = useState<'creative' | 'styles'>('creative');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // הודעת פתיחה משתנה
  useEffect(() => {
    const text = appMode === 'creative' 
      ? "שלום! אני המנהל האמנותי שלך. תאר לי מה ליצור (אפשר בעברית!)"
      : "מצב סגנונות מופעל. אצור עבורך 4 גרסאות שונות: ריאליסטי, אנימה, סייברפאנק וצבעי מים.";
      
    setMessages([{
      id: '1',
      role: 'assistant',
      content: text,
      timestamp: Date.now()
    }]);
  }, [appMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() && !uploadedImage) return;

    // 1. הצגת הודעת המשתמש
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
      // 2. קביעת כמות התמונות לפי המצב
      const count = appMode === 'styles' ? 4 : 1;
      
      // 3. שליחה למוח (Gemini)
      const result = await generateWallpaper({
        prompt: userMessage.content,
        baseImageBase64: userMessage.image,
        aspectRatio,
        count: count,
        mode: appMode
      });

      // 4. הצגת התשובה
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
        content: "נתקלתי בשגיאה ביצירת התמונה. נסה שוב.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- התיקון החשוב להורדה ---
  // פתיחה בטאב חדש (בטוח יותר בטלפונים)
  const handleDownload = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
      {/* כותרת עליונה */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between" dir="ltr">
            {/* בורר יחס תמונה (שמאל) */}
            <div className="flex bg-slate-800 rounded-lg p-1">
                <button 
                  onClick={() => setAspectRatio('9:16')}
                  className={`p-2 rounded-md ${aspectRatio === '9:16' ? 'bg-blue-600' : 'text-slate-400'}`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setAspectRatio('16:9')}
                  className={`p-2 rounded-md ${aspectRatio === '16:9' ? 'bg-blue-600' : 'text-slate-400'}`}
                >
                  <Monitor className="w-4 h-4" />
                </button>
            </div>

            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              Ultimate Gen <Sparkles className="w-5 h-5 text-blue-400" />
            </h1>
          </div>
          
          {/* בורר מצבים */}
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg" dir="ltr">
            <button
              onClick={() => setAppMode('creative')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                appMode === 'creative' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span className="text-sm">Creative</span>
            </button>
            <button
              onClick={() => setAppMode('styles')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                appMode === 'styles' ? 'bg-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span className="text-sm">Pro Styles</span>
            </button>
          </div>
        </div>
      </header>

      {/* אזור הצ'אט */}
      <main className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-slate-800/80 border border-slate-700 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap text-right" dir="auto">{msg.content}</p>
                </div>
                
                {msg.relatedImages && (
                  <div className={`grid gap-2 mt-2 w-full ${msg.relatedImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {msg.relatedImages.map((img, idx) => (
                      <div 
                        key={idx} 
                        className="relative group cursor-pointer overflow-hidden"
                        style={MUSEUM_FRAME_STYLE}
                        onClick={() => setFullScreenImage(img)}
                      >
                        <img 
                          src={img} 
                          alt="Generated" 
                          className="w-full h-auto object-cover"
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

      {/* אזור ההקלדה */}
      <footer className="bg-slate-900/80 backdrop-blur-md border-t border-slate-800 p-4">
        <div className="max-w-3xl mx-auto flex gap-2" dir="ltr">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="תאר את התמונה (עברית עובד מצוין!)..."
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-right"
            dir="auto"
          />
          <Button onClick={handleSend} disabled={isLoading} variant="primary" className="rounded-xl px-4">
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </footer>

      {/* מסך מלא (הורדה) */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" dir="ltr">
          <button 
            onClick={() => setFullScreenImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
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
            
            {/* כפתור פתיחה לשמירה */}
            <Button 
              onClick={() => handleDownload(fullScreenImage)}
              variant="primary"
              className="mt-4 flex items-center gap-2 shadow-xl"
            >
              <ExternalLink className="w-4 h-4" /> לחץ כאן לשמירה
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
