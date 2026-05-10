import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("Target"); 
  const [globalNotes, setGlobalNotes] = useState(""); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Flashcard State
  const [decks, setDecks] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [cardInputs, setCardInputs] = useState({}); 
  const [cardStatus, setCardStatus] = useState({}); 
  const [showPopup, setShowPopup] = useState(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [newCardQ, setNewCardQ] = useState("");
  const [newCardA, setNewCardA] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const calendarDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 + i);
    return d;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setDecks([]);
      return;
    }
    const qT = query(collection(db, "tasks"), where("uid", "==", user.uid));
    const unsubT = onSnapshot(qT, (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qD = query(collection(db, "decks"), where("uid", "==", user.uid));
    const unsubD = onSnapshot(qD, (s) => setDecks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubT(); unsubD(); };
  }, [user]);

  const handleLogin = () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  // --- TASK ACTIONS ---
  const addTask = async () => {
    if (!input.trim() || !user) return;
    await addDoc(collection(db, "tasks"), {
      text: input, completed: false, date: selectedDate.toDateString(), uid: user.uid, createdAt: serverTimestamp()
    });
    setInput("");
  };

  // --- FLASHCARD ACTIONS ---
  const addDeck = async () => {
    if (!newDeckName.trim() || !user) return;
    await addDoc(collection(db, "decks"), { name: newDeckName, uid: user.uid, cards: [], createdAt: serverTimestamp() });
    setNewDeckName("");
  };

  const addCardToDeck = async () => {
    if (!newCardQ.trim() || !newCardA.trim() || !activeDeckId) return;
    const deck = decks.find(d => d.id === activeDeckId);
    const updated = [...(deck.cards || []), { id: Date.now().toString(), q: newCardQ, a: newCardA }];
    await updateDoc(doc(db, "decks", activeDeckId), { cards: updated });
    setNewCardQ(""); setNewCardA("");
  };

  const checkAnswer = (cardId, correctAnswer) => {
    const userVal = (cardInputs[cardId] || "").toLowerCase().trim();
    if (userVal === correctAnswer.toLowerCase().trim()) {
      setCardStatus(p => ({ ...p, [cardId]: 'correct' }));
      setShowPopup(cardId);
      setTimeout(() => { 
        setShowPopup(null); 
        setFlippedCards(p => ({ ...p, [cardId]: true })); 
      }, 800);
    } else { 
      setCardStatus(p => ({ ...p, [cardId]: 'wrong' })); 
    }
  };

  const shuffleDeck = async () => {
    const deck = decks.find(d => d.id === activeDeckId);
    const shuffled = [...deck.cards].sort(() => Math.random() - 0.5);
    await updateDoc(doc(db, "decks", activeDeckId), { cards: shuffled });
    setFlippedCards({}); setCardStatus({}); setCardInputs({});
  };

  // --- DATA PROCESSING & LOGIC ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tasksByDate = tasks.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = { total: 0, completed: 0 };
    acc[t.date].total++; 
    if (t.completed) acc[t.date].completed++;
    return acc;
  }, {});

  const upcomingTasks = tasks.filter(t => {
    const taskDate = new Date(t.date);
    return taskDate > today;
  });

  const consistency = { elite: 0, solid: 0, avg: 0, poor: 0 };
  Object.values(tasksByDate).forEach(s => {
    const p = (s.completed / s.total) * 100;
    if (p >= 90) consistency.elite++; 
    else if (p >= 70) consistency.solid++;
    else if (p >= 50) consistency.avg++; 
    else consistency.poor++;
  });

  const streakData = Array.from({ length: 105 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 104 + i);
    const s = tasksByDate[d.toDateString()];
    let color = "bg-stone-100";
    if (s) {
      const p = (s.completed / s.total) * 100;
      if (p >= 90) color = "bg-emerald-500";
      else if (p >= 70) color = "bg-blue-500";
      else if (p >= 50) color = "bg-yellow-400";
      else color = "bg-rose-400";
    }
    return { date: d, color };
  });

  return (
    <div className="flex h-[100dvh] w-screen bg-[#faf9f6] font-sans text-[#333333] antialiased overflow-hidden relative">

      {/* MOBILE MENU OVERLAY */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="fixed inset-0 bg-stone-900/40 z-40 md:hidden backdrop-blur-sm" 
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-80 bg-[#fcfbf9] p-6 lg:p-8 flex flex-col border-r border-stone-200 transition-transform md:static md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-bold">Target Master</h2>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-2xl text-stone-400">✕</button>
        </div>
        <ul className="flex-1 space-y-1">
          <li 
            onClick={() => { setActiveTab('Upcoming'); setIsMobileMenuOpen(false); }} 
            className={`px-4 py-3 rounded-xl cursor-pointer flex justify-between items-center transition-all ${activeTab === 'Upcoming' ? "bg-stone-100 font-bold" : "text-stone-500 hover:text-stone-800"}`}
          >
            <span>Upcoming</span>
            {upcomingTasks.length > 0 && <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded text-xs font-bold">{upcomingTasks.length}</span>}
          </li>
          {['Today', 'Target', 'Progress', 'Flashcards', 'Sticky Notes'].map(t => (
            <li 
              key={t} 
              onClick={() => { setActiveTab(t); setIsMobileMenuOpen(false); }} 
              className={`px-4 py-3 rounded-xl cursor-pointer transition-all ${activeTab === t ? "bg-stone-100 font-bold text-stone-900" : "text-stone-500 hover:text-stone-800"}`}
            >
              {t}
            </li>
          ))}
        </ul>
        {user ? (
          <div className="mt-auto border-t border-stone-200 pt-6">
             <div className="px-4 py-2 text-sm font-bold text-stone-800 truncate mb-1">{user.displayName}</div>
             <button onClick={handleLogout} className="w-full text-rose-500 font-bold p-3 text-left hover:bg-rose-50 rounded-xl transition-all">↪ Sign Out</button>
          </div>
        ) : (
          <button onClick={handleLogin} className="mt-auto bg-black text-white p-4 rounded-xl font-bold hover:bg-stone-800 transition-all">Sign In with Google</button>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-6 md:p-8 lg:p-12 flex flex-col bg-[#faf9f6] overflow-hidden w-full">
        <header className="flex justify-between items-center mb-10 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-2xl bg-white w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-stone-200 text-stone-600">☰</button>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{activeTab}</h1>
          </div>
          <div className="bg-white px-5 py-2.5 rounded-xl shadow-sm border border-stone-200 font-mono font-bold text-sm hidden md:block tracking-wider">
            {currentTime.toLocaleTimeString('en-IN')}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 md:pr-4">
          {!user ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-stone-50/50 rounded-[3rem] border-2 border-dashed border-stone-200">
              <div className="text-6xl md:text-7xl mb-6">🎯</div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-stone-800">Welcome to Target Master</h2>
              <p className="text-stone-500 text-lg max-w-lg">Please sign in to access your secure timeline, flashcards, and progress analytics.</p>
              <button onClick={handleLogin} className="md:hidden mt-8 bg-black text-white px-8 py-3 rounded-xl font-bold">Sign In</button>
            </div>
          ) : (
            <>
              {/* ---------------- TARGET TAB ---------------- */}
              {activeTab === "Target" && (
                <div className="flex flex-col h-full">
                  <div className="flex gap-3 overflow-x-auto pb-6 mb-6 scrollbar-hide shrink-0">
                    {calendarDates.map((d, i) => (
                      <div key={i} onClick={() => setSelectedDate(d)} className={`min-w-[70px] p-4 rounded-3xl cursor-pointer text-center border transition-all ${d.toDateString() === selectedDate.toDateString() ? "bg-black text-white shadow-lg border-black" : "bg-white text-stone-500 hover:bg-stone-50 border-stone-200"}`}>
                        <div className="text-[11px] font-bold uppercase tracking-widest">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                        <div className="text-2xl font-black mt-1.5">{d.getDate()}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-[#fff4c2] p-8 rounded-[2.5rem] border border-yellow-100 shadow-sm">
                      <h3 className="font-bold text-xl mb-6 text-stone-800">Add Target</h3>
                      <input 
                        className="w-full bg-white/60 focus:bg-white p-5 rounded-2xl outline-none mb-4 text-base font-medium transition-colors border border-transparent focus:border-yellow-300" 
                        value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && addTask()} placeholder="What needs to be done?" 
                      />
                      <button onClick={addTask} className="w-full bg-black text-white p-5 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-sm">Pin Target</button>
                    </div>
                    <div className="bg-[#dcf0f5] p-8 rounded-[2.5rem] border border-cyan-100 shadow-sm min-h-[350px] flex flex-col gap-4">
                      <h3 className="font-bold text-xl mb-2 text-stone-800">Pinned Items</h3>
                      <div className="flex-1 overflow-y-auto space-y-4">
                        {tasks.filter(t => t.date === selectedDate.toDateString()).map(t => (
                          <div key={t.id} className="flex bg-white/70 p-5 rounded-2xl justify-between items-start shadow-sm border border-white">
                            <div className="flex items-start gap-4">
                              <input type="checkbox" checked={t.completed} onChange={async () => await updateDoc(doc(db, "tasks", t.id), { completed: !t.completed })} className="accent-black w-5 h-5 mt-1 cursor-pointer shrink-0" />
                              <span className={`text-base leading-relaxed ${t.completed ? "line-through text-stone-400 font-medium" : "font-bold text-stone-800"}`}>{t.text}</span>
                            </div>
                            <button onClick={async () => await deleteDoc(doc(db, "tasks", t.id))} className="text-stone-300 hover:text-rose-500 text-xl transition-colors mt-0.5 ml-2">✕</button>
                          </div>
                        ))}
                        {tasks.filter(t => t.date === selectedDate.toDateString()).length === 0 && <p className="text-stone-500 italic text-base mt-2">No tasks pinned for this date.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- UPCOMING TAB ---------------- */}
              {activeTab === "Upcoming" && (
                <div className="max-w-4xl w-full flex flex-col gap-6">
                  <h2 className="text-3xl font-bold mb-4 text-stone-800">Future Targets</h2>
                  {upcomingTasks.length > 0 ? (
                    upcomingTasks.map(t => (
                      <div key={t.id} className="flex bg-white p-6 rounded-[2rem] justify-between items-center border border-stone-100 shadow-sm transition-all hover:shadow-md">
                        <div>
                          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric'})}</span>
                          <p className="font-bold text-stone-800 text-xl mt-2">{t.text}</p>
                        </div>
                        <button onClick={async () => await deleteDoc(doc(db, "tasks", t.id))} className="bg-stone-50 w-12 h-12 flex items-center justify-center rounded-full text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-all font-bold text-lg ml-4">✕</button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-stone-200">
                      <p className="text-stone-500 italic text-lg font-medium">No upcoming targets. Use the "Target" tab to plan ahead!</p>
                    </div>
                  )}
                </div>
              )}

              {/* ---------------- PROGRESS TAB ---------------- */}
              {activeTab === "Progress" && (
                <div className="flex flex-col lg:flex-row gap-8 items-stretch min-h-[500px]">
                  
                  {/* Consistency Matrix */}
                  <div className="flex-1 bg-white p-8 md:p-12 rounded-[3rem] border border-stone-200 flex flex-col justify-between shadow-sm">
                    <div>
                      <h2 className="text-3xl font-bold mb-8 text-stone-800">Consistency</h2>
                      <div className="space-y-8">
                        {[{l:'Elite',k:'elite',c:'bg-emerald-500'},{l:'Solid',k:'solid',c:'bg-blue-500'},{l:'Average',k:'avg',c:'bg-yellow-400'},{l:'Poor',k:'poor',c:'bg-rose-400'}].map(i => (
                          <div key={i.l}>
                            <div className="flex justify-between text-xs font-bold uppercase text-stone-400 mb-3 tracking-widest">
                              <span>{i.l}</span><span>{consistency[i.k]} Days</span>
                            </div>
                            <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                              <motion.div initial={{width:0}} animate={{width: `${(consistency[i.k]/Math.max(1, Object.keys(tasksByDate).length))*100}%`}} className={`${i.c} h-full transition-all duration-700`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-8 border-t border-stone-100 mt-10 text-center">
                      <div className="text-5xl font-black text-stone-800">{Object.keys(tasksByDate).length}</div>
                      <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">Days Tracked</div>
                    </div>
                  </div>

                  {/* Target Heatmap */}
                  <div className="lg:w-2/3 bg-white p-8 md:p-12 rounded-[3rem] border border-stone-200 shadow-sm flex flex-col">
                    <h2 className="text-3xl font-bold mb-8 text-stone-800">Target Heatmap</h2>
                    
                    <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 cursor-grab active:cursor-grabbing">
                      <div className="min-w-[650px] px-2">
                        
                        {/* Month Labels aligned to grid */}
                        <div className="flex text-xs font-bold text-stone-300 mb-3 ml-7">
                          {Array.from({length:15}).map((_,i) => {
                            const d = new Date(); d.setDate(d.getDate() - (14-i)*7);
                            return (i===0 || d.getDate()<=7) ? <div key={i} className="w-[39px] shrink-0">{d.toLocaleDateString('en-IN',{month:'short'})}</div> : <div key={i} className="w-[39px] shrink-0"></div>;
                          })}
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="flex flex-col justify-between text-[10px] font-bold text-stone-300 py-1 uppercase shrink-0">
                            <span>M</span><span>W</span><span>F</span><span>S</span>
                          </div>
                          
                          {/* Strict 7-row Grid */}
                          <div className="grid grid-flow-col grid-rows-7 gap-1.5 md:gap-2">
                            {streakData.map((d, idx) => (
                              <motion.div 
                                key={idx} 
                                whileHover={{scale:1.2, zIndex: 10}} 
                                className={`w-[30px] h-[30px] md:w-[30px] md:h-[30px] rounded-[4px] ${d.color} border border-black/5 shrink-0 transition-all cursor-help`} 
                                title={d.date.toDateString()} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-end gap-3 mt-6 text-[11px] font-bold text-stone-400">
                      <span>Low Focus</span>
                      <div className="flex gap-1.5">
                        <div className="w-3.5 h-3.5 rounded-[3px] bg-stone-100 border border-stone-200"></div>
                        <div className="w-3.5 h-3.5 rounded-[3px] bg-rose-400"></div>
                        <div className="w-3.5 h-3.5 rounded-[3px] bg-yellow-400"></div>
                        <div className="w-3.5 h-3.5 rounded-[3px] bg-blue-500"></div>
                        <div className="w-3.5 h-3.5 rounded-[3px] bg-emerald-500"></div>
                      </div>
                      <span>High Focus</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- TODAY TAB ---------------- */}
              {activeTab === "Today" && (
                <div className="max-w-4xl w-full bg-[#dcf0f5] p-8 md:p-14 rounded-[3.5rem] flex flex-col shadow-sm border border-white h-fit min-h-[75vh]">
                   <div className="mb-10 bg-white/50 p-8 md:p-10 rounded-[3rem] border border-white shadow-sm">
                      <div className="flex justify-between items-end mb-6">
                        <h3 className="font-bold text-2xl text-stone-800">Daily Focus</h3>
                        <span className="text-6xl font-black text-stone-900">{tasksByDate[new Date().toDateString()] ? Math.round((tasksByDate[new Date().toDateString()].completed / tasksByDate[new Date().toDateString()].total) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-stone-200 h-5 rounded-full overflow-hidden shadow-inner">
                        <motion.div className="bg-cyan-500 h-full" initial={{width:0}} animate={{ width: `${tasksByDate[new Date().toDateString()] ? Math.round((tasksByDate[new Date().toDateString()].completed / tasksByDate[new Date().toDateString()].total) * 100) : 0}%` }} transition={{duration: 1}} />
                      </div>
                   </div>
                   <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                     {tasks.filter(t => t.date === new Date().toDateString()).map(t => (
                        <div key={t.id} className="flex items-center gap-5 bg-white/70 p-6 rounded-[2rem] shadow-sm border border-white">
                          <input type="checkbox" checked={t.completed} onChange={async () => await updateDoc(doc(db, "tasks", t.id), { completed: !t.completed })} className="w-7 h-7 accent-black cursor-pointer shrink-0" />
                          <span className={`text-xl transition-colors ${t.completed ? "line-through text-stone-400" : "font-bold text-stone-800"}`}>{t.text}</span>
                        </div>
                     ))}
                     {tasks.filter(t => t.date === new Date().toDateString()).length === 0 && <p className="text-center text-stone-500 italic py-10 text-lg font-medium">No targets set for today.</p>}
                   </div>
                </div>
              )}

              {/* ---------------- FLASHCARDS TAB ---------------- */}
              {activeTab === "Flashcards" && (
                <div className="flex flex-col h-full">
                  {!activeDeckId ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                      {decks.map(d => (
                        <div key={d.id} onClick={() => setActiveDeckId(d.id)} className="bg-[#fff4c2] aspect-square rounded-[2.5rem] p-8 relative cursor-pointer border border-yellow-200 shadow-sm transition-all hover:scale-105 group flex flex-col justify-between">
                          <h3 className="text-2xl font-bold line-clamp-3 text-stone-800">{d.name}</h3>
                          <p className="text-xs bg-white/50 px-4 py-2 rounded-xl w-fit font-bold text-stone-600 shadow-sm">{d.cards?.length || 0} Cards</p>
                          <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "decks", d.id)); }} className="absolute top-5 right-5 text-stone-400 opacity-0 group-hover:opacity-100 bg-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-sm hover:text-rose-500 transition-all text-lg">✕</button>
                        </div>
                      ))}
                      <div className="border-2 border-dashed border-stone-200 rounded-[2.5rem] p-8 flex flex-col justify-center items-center bg-white/30">
                        <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} onKeyPress={e => e.key === 'Enter' && addDeck()} placeholder="New Deck Name..." className="w-full text-center bg-transparent outline-none mb-6 font-bold text-stone-800 text-xl" />
                        <button onClick={addDeck} className="w-full bg-black text-white px-8 py-4 rounded-2xl font-bold transition-all hover:bg-stone-800 shadow-md">Create Deck</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8 h-full">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 shrink-0">
                         <div className="flex items-center gap-4">
                           <button onClick={() => setActiveDeckId(null)} className="text-stone-500 font-bold uppercase text-[11px] tracking-widest hover:text-stone-800 transition-all bg-white px-4 py-2.5 rounded-xl shadow-sm border border-stone-200">← Back</button>
                           <h3 className="font-bold text-3xl text-stone-800 truncate px-2">{decks.find(d => d.id === activeDeckId)?.name}</h3>
                         </div>
                         <button onClick={shuffleDeck} className="bg-stone-200 px-8 py-3 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-300 shadow-sm transition-colors w-full md:w-auto">🔀 Shuffle Cards</button>
                      </div>
                      
                      <div className="bg-white p-5 rounded-[2rem] border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 shrink-0">
                        <input value={newCardQ} onChange={e => setNewCardQ(e.target.value)} onKeyPress={e => e.key === 'Enter' && addCardToDeck()} placeholder="Front (Question)" className="flex-1 p-4 bg-stone-50 rounded-2xl outline-none text-base font-medium focus:bg-stone-100 border border-transparent focus:border-stone-200 transition-colors" />
                        <input value={newCardA} onChange={e => setNewCardA(e.target.value)} onKeyPress={e => e.key === 'Enter' && addCardToDeck()} placeholder="Back (Answer)" className="flex-1 p-4 bg-stone-50 rounded-2xl outline-none text-base font-medium focus:bg-stone-100 border border-transparent focus:border-stone-200 transition-colors" />
                        <button onClick={addCardToDeck} className="bg-black text-white px-10 py-4 rounded-2xl font-bold hover:bg-stone-800 shadow-md transition-all text-lg">Add</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-10 overflow-y-auto">
                        {decks.find(d => d.id === activeDeckId)?.cards.map(card => {
                          const isFlipped = flippedCards[card.id];
                          const status = cardStatus[card.id];
                          return (
                            <div key={card.id} className="relative h-80 group" style={{ perspective: '1200px' }}>
                              <button onClick={() => { const d = decks.find(dk => dk.id === activeDeckId); updateDoc(doc(db, "decks", activeDeckId), { cards: d.cards.filter(c => c.id !== card.id) }); }} className="absolute -top-3 -right-3 z-20 bg-white shadow-md rounded-full w-10 h-10 text-rose-500 font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-stone-100 text-lg">✕</button>
                              
                              <motion.div className="w-full h-full relative" animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: 'spring', damping: 20 }} style={{ transformStyle: 'preserve-3d' }}>
                                
                                {/* FRONT OF FLASHCARD */}
                                <div className={`absolute inset-0 p-8 rounded-[2.5rem] border-2 shadow-sm flex flex-col justify-between transition-colors duration-300 ${status === 'wrong' ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-100'}`} style={{ backfaceVisibility: 'hidden' }}>
                                  <div className="overflow-y-auto custom-scrollbar pr-2"><p className="text-xl font-bold text-stone-800 leading-snug">{card.q}</p></div>
                                  <div className="space-y-4 mt-4 shrink-0">
                                    <input 
                                      className="w-full p-4 rounded-xl border border-stone-200 outline-none text-sm font-medium bg-stone-50 focus:bg-white focus:border-stone-400 transition-colors" 
                                      placeholder="Type answer..." 
                                      value={cardInputs[card.id] || ""} 
                                      onChange={(e) => setCardInputs(p => ({ ...p, [card.id]: e.target.value }))} 
                                      disabled={isFlipped} 
                                      onKeyPress={e => e.key === 'Enter' && checkAnswer(card.id, card.a)} 
                                    />
                                    <div className="flex gap-3">
                                      <button onClick={() => checkAnswer(card.id, card.a)} className="flex-1 bg-black text-white py-3 rounded-xl text-sm font-bold shadow-md hover:bg-stone-800 transition-colors">Check</button>
                                      {status === 'wrong' && <button onClick={() => setFlippedCards(p => ({ ...p, [card.id]: true }))} className="px-5 bg-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-300 transition-colors">Show</button>}
                                    </div>
                                  </div>
                                  <AnimatePresence>
                                    {showPopup === card.id && (
                                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-white font-black text-2xl z-10 shadow-lg tracking-widest">
                                        CORRECT!
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* BACK OF FLASHCARD */}
                                <div className="absolute inset-0 p-8 rounded-[2.5rem] bg-[#222222] border-2 border-[#222222] text-white flex flex-col items-center justify-center text-center shadow-lg" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                                  <p className="text-[11px] font-bold uppercase mb-4 opacity-50 tracking-widest text-emerald-400">Answer</p>
                                  <div className="overflow-y-auto custom-scrollbar w-full px-2"><p className="text-2xl font-bold leading-relaxed">{card.a}</p></div>
                                  <button onClick={() => { setFlippedCards(p => ({ ...p, [card.id]: false })); setCardStatus(p => ({ ...p, [card.id]: null })); setCardInputs(p => ({ ...p, [card.id]: "" })); }} className="mt-8 bg-white/10 px-8 py-3 rounded-full text-sm font-bold hover:bg-white/20 transition-colors">Try Again</button>
                                </div>

                              </motion.div>
                            </div>
                          );
                        })}
                        {decks.find(d => d.id === activeDeckId)?.cards.length === 0 && <div className="col-span-full text-center py-20 bg-white/50 border-2 border-dashed border-stone-200 rounded-[3rem] text-stone-400 italic font-medium text-lg">This deck is empty. Add your first card above!</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---------------- STICKY NOTES TAB ---------------- */}
              {activeTab === "Sticky Notes" && (
                <div className="h-full bg-[#fce5e8] p-10 md:p-14 rounded-[3.5rem] border border-white shadow-sm flex flex-col">
                  <h2 className="text-3xl font-bold mb-8 text-rose-900/50">Global Scratchpad</h2>
                  <textarea 
                    className="flex-1 bg-transparent border-none outline-none resize-none text-2xl leading-relaxed text-rose-900 custom-scrollbar" 
                    placeholder="Jot down quick project ideas, formulas, or reminders..." 
                    value={globalNotes} 
                    onChange={e => setGlobalNotes(e.target.value)} 
                    spellCheck="false" 
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;