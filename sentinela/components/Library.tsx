
import React, { useState } from 'react';
import { BookOpen, Search, Loader2, X } from 'lucide-react';
import { generateArticleContentAI } from '../services/geminiService';

const Library: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const [readingArticle, setReadingArticle] = useState<{title: string, content?: string} | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const categories = ["Todos", "Nutrição", "Receitas", "Ciência", "Dicas"];
  const articles = [
    { id: 1, category: "Nutrição", title: "Os benefícios do Jejum Intermitente", readTime: "5 min", image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=400&q=80" },
    { id: 2, category: "Receitas", title: "5 Smoothies Detox para começar o dia", readTime: "3 min", image: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=400&q=80" },
    { id: 3, category: "Ciência", title: "Como o açúcar afeta seu cérebro", readTime: "8 min", image: "https://images.unsplash.com/photo-1621939514649-28b12e816751?auto=format&fit=crop&w=400&q=80" },
    { id: 4, category: "Dicas", title: "Guia prático para ler rótulos", readTime: "6 min", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80" }
  ];

  const filtered = articles.filter(a => (activeTab === 'Todos' || a.category === activeTab) && a.title.toLowerCase().includes(search.toLowerCase()));

  const handleRead = async (article: typeof articles[0]) => {
      setReadingArticle({ title: article.title });
      setIsLoadingContent(true);
      const content = await generateArticleContentAI(article.title);
      setReadingArticle({ title: article.title, content });
      setIsLoadingContent(false);
  };

  return (
    <div className="p-6 pb-28 min-h-screen max-w-3xl mx-auto animate-in slide-in-from-bottom duration-500">
      {readingArticle && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
              <div className="p-6 max-w-3xl mx-auto">
                  <button onClick={() => setReadingArticle(null)} className="mb-4 p-2 bg-gray-100 rounded-full"><X /></button>
                  <h1 className="font-serif text-3xl md:text-4xl text-[#1A4D2E] mb-6">{readingArticle.title}</h1>
                  {isLoadingContent ? (
                      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#1A4D2E]" size={40} /></div>
                  ) : (
                      <div className="prose prose-green max-w-none whitespace-pre-wrap text-lg text-[#4F6F52] leading-relaxed">{readingArticle.content}</div>
                  )}
              </div>
          </div>
      )}

      <div className="mb-6"><h2 className="text-3xl font-serif font-bold text-[#1A4D2E] flex items-center gap-2"><BookOpen className="text-[#4F6F52]" /> Biblioteca</h2><p className="text-[#4F6F52]">Aprenda mais sobre nutrição consciente.</p></div>
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-[#1A4D2E]/5 mb-6 flex items-center gap-3"><Search className="text-[#1A4D2E]" size={20} /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar artigos..." className="flex-1 outline-none text-[#1A4D2E] placeholder:text-[#1A4D2E]/40" /></div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar mb-8 pb-2">{categories.map(cat => <button key={cat} onClick={() => setActiveTab(cat)} className={`px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${activeTab === cat ? 'bg-[#1A4D2E] text-white' : 'bg-white text-[#4F6F52] hover:bg-[#1A4D2E]/10'}`}>{cat}</button>)}</div>
      <div className="grid gap-6">
         {filtered.map(article => (
            <div key={article.id} onClick={() => handleRead(article)} className="bg-white rounded-[2.5rem] p-4 flex gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer group">
               <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0"><img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div>
               <div className="flex-1 py-1"><div className="flex items-center gap-2 mb-2"><span className="bg-[#F5F1E8] text-[#1A4D2E] px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">{article.category}</span><span className="text-xs text-gray-400">• {article.readTime} de leitura</span></div><h3 className="font-serif text-lg text-[#1A4D2E] leading-tight group-hover:text-[#4F6F52] transition-colors">{article.title}</h3></div>
            </div>
         ))}
      </div>
    </div>
  );
};
export default Library;
