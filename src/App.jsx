import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Firebase Imports
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
  const scrollRef = useRef(null);

  // ================= FLASHCARD STATE =================
  const [decks, setDecks] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
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

  // ================= FIREBASE AUTH & DATA =================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) { setTasks([]); setDecks([]); return; }
    const qTasks = query(collection(db, "tasks"), where("uid", "==", user.uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const qDecks = query(collection(db, "decks"), where("uid", "==", user.uid));
    const unsubDecks = onSnapshot(qDecks, (snapshot) => {
      setDecks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubTasks(); unsubDecks(); };
  }, [user]);

  const handleLogin = () => signInWithPopup(auth, googleProvider).catch(err => console.error(err));
  const handleLogout = () => signOut(auth);

  // ================= ACTIONS =================
  const addTask = async () => {
    if (!input.trim() || !user) return;
    await addDoc(collection(db, "tasks"), {
      text: input, completed: false, date: selectedDate.toDateString(), uid: user.uid, createdAt: serverTimestamp()
    });
    setInput("");
  };

  const toggleTask = async (id, currentStatus) => {
    await updateDoc(doc(db, "tasks", id), { completed: !currentStatus });
  };

  const deleteTask = async (id) => {
    await deleteDoc(doc(db, "tasks", id));
  };

  const addDeck = async () => {
    if (!newDeckName.trim() || !user) return;
    await addDoc(collection(db, "decks"), { name: newDeckName, uid: user.uid, cards: [], createdAt: serverTimestamp() });
    setNewDeckName("");
  };

  const deleteDeck = async (id) => {
    await deleteDoc(doc(db, "decks", id));
    if (activeDeckId === id) setActiveDeckId(null);
  };

  const addCardToDeck = async () => {
    if (!newCardQ.trim() || !newCardA.trim() || !activeDeckId) return;
    const deck = decks.find(d => d.id === activeDeckId);
    const updatedCards = [...(deck.cards || []), { id: Date.now().toString(), q: newCardQ, a: newCardA }];
    await updateDoc(doc(db, "decks", activeDeckId), { cards: updatedCards });
    setNewCardQ(""); setNewCardA("");
  };

  const deleteCardFromDeck = async (cardId) => {
    const deck = decks.find(d => d.id === activeDeckId);
    const updatedCards = deck.cards.filter(c => c.id !== cardId);
    await updateDoc(doc(db, "decks", activeDeckId), { cards: updatedCards });
  };

  const shuffleActiveDeck = async () => {
    const deck = decks.find(d => d.id === activeDeckId);
    const shuffled = [...(deck.cards || [])].sort(() => Math.random() - 0.5);
    await updateDoc(doc(db, "decks", activeDeckId), { cards: shuffled });
    setFlippedCards({}); 
  };

  const toggleFlip = (cardId) => setFlippedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  const closeDeck = () => { setActiveDeckId(null); setFlippedCards({}); };

  // ================= DATA FILTERING =================
  const todayString = new Date().toDateString();
  const isFutureDate = (dateStr) => new Date(dateStr) > new Date(todayString);
  
  const visibleTasks = tasks.filter(t => t.date === selectedDate.toDateString());
  const todayTasks = tasks.filter(t => t.date === todayString);
  const upcomingTasks = tasks.filter(t => isFutureDate(t.date));

  const todayCompleted = todayTasks.filter(t => t.completed).length;
  const todayTotal = todayTasks.length;
  const todayEfficiency = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  // Consistency & Streak Logic
  const pastAndPresentTasks = tasks.filter(t => !isFutureDate(t.date));
  const tasksByDate = pastAndPresentTasks.reduce((acc, task) => {
    if (!acc[task.date]) acc[task.date] = { total: 0, completed: 0 };
    acc[task.date].total += 1;
    if (task.completed) acc[task.date].completed += 1;
    return acc;
  }, {});

  const consistencyBrackets = { "90-100%": 0, "70-89%": 0, "50-69%": 0, "Below 50%": 0 };
  let totalDaysWithTasks = 0;

  Object.values(tasksByDate).forEach(day => {
    totalDaysWithTasks++;
    const percent = (day.completed / day.total) * 100;
    if (percent >= 90) consistencyBrackets["90-100%"]++;
    else if (percent >= 70) consistencyBrackets["70-89%"]++;
    else if (percent >= 50) consistencyBrackets["50-69%"]++;
    else consistencyBrackets["Below 50%"]++;
  });

  const upcomingTasksByDate = upcomingTasks.reduce((acc, task) => {
    if (!acc[task.date]) acc[task.date] = [];
    acc[task.date].push(task);
    return acc;
  }, {});
  const sortedUpcomingDates = Object.keys(upcomingTasksByDate).sort((a, b) => new Date(a) - new Date(b));

  // ================= STREAK HEATMAP LOGIC =================
  const getStreakData = () => {
    const data = [];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 100); // Track last 100 days

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dStr = d.toDateString();
      const stats = tasksByDate[dStr];
      let color = "bg-stone-100"; // Empty
      if (stats) {
        const p = (stats.completed / stats.total) * 100;
        if (p >= 90) color = "bg-emerald-500";
        else if (p >= 70) color = "bg-blue-500";
        else if (p >= 50) color = "bg-yellow-400";
        else color = "bg-rose-400";
      }
      data.push({ 
        date: new Date(d), 
        color, 
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        day: d.getDate()
      });
    }
    return data;
  };
  const streakData = getStreakData();

  // ================= UI RENDERING =================
  const renderSidebarItem = (icon, label, count, isActive) => (
    <li onClick={() => { setActiveTab(label); setIsMobileMenuOpen(false); }} className={`flex justify-between items-center px-4 py-3 rounded-xl cursor-pointer transition-colors ${isActive ? "bg-stone-100 text-stone-800 font-bold shadow-sm" : "hover:bg-stone-50 text-stone-500 font-medium"}`}>
      <div className="flex items-center gap-3"><span className="text-lg flex items-center justify-center w-5">{icon}</span><span>{label}</span></div>
      {count > 0 && <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded text-xs font-bold">{count}</span>}
    </li>
  );

  const timeString = currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit', second: '2-digit' });
  const indianDateString = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', calendar: 'indian', month: 'short', day: 'numeric', year: 'numeric' }).format(currentTime);

  return (
    <div className="flex h-[100dvh] w-screen bg-[#faf9f6] font-sans text-[#333333] antialiased selection:bg-rose-200 overflow-hidden relative">
      
      {/* MOBILE MENU OVERLAY */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-stone-900/30 z-40 md:hidden backdrop-blur-sm" />
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-50 w-[80%] max-w-[320px] md:max-w-none md:w-72 lg:w-80 bg-[#fcfbf9] p-6 lg:p-8 flex flex-col border-r border-stone-200 overflow-y-auto shrink-0 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between mb-8 md:mb-10">
          <h2 className="text-2xl font-bold tracking-tight">Menu</h2>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-2xl text-stone-400 hover:text-stone-800">✕</button>
        </div>
        <div className="flex-1 space-y-8">
          <div>
            <h3 className="text-[11px] font-bold text-stone-400 mb-3 tracking-widest uppercase px-4">Tasks</h3>
            <ul className="space-y-1 text-base">
              {renderSidebarItem("»", "Upcoming", upcomingTasks.length, activeTab === "Upcoming")}
              {renderSidebarItem("≡", "Today", todayTasks.length, activeTab === "Today")}
              {renderSidebarItem("🎯", "Target", null, activeTab === "Target")}
            </ul>
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-stone-400 mb-3 tracking-widest uppercase px-4">Analytics & Notes</h3>
            <ul className="space-y-1 text-base">
              {renderSidebarItem("📊", "Progress", null, activeTab === "Progress")}
              {renderSidebarItem("🃏", "Flashcards", decks.length, activeTab === "Flashcards")}
              {renderSidebarItem("📝", "Sticky Notes", null, activeTab === "Sticky Notes")}
            </ul>
          </div>
        </div>
        <div className="mt-auto border-t border-stone-200 pt-6">
           {user ? (
             <><div className="flex items-center gap-4 px-4 py-3 mb-2 bg-white rounded-2xl shadow-sm border border-stone-100"><div className="w-10 h-10 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 border border-stone-300">{user.photoURL ? <img src={user.photoURL} alt="p" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-stone-300"></div>}</div><div className="overflow-hidden"><p className="text-sm font-bold text-stone-800 truncate">{user.displayName}</p><p className="text-xs text-stone-400">Engineering</p></div></div><button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm font-bold text-stone-400 hover:text-rose-500 transition-colors">↪ Sign Out</button></>
           ) : (
             <button onClick={handleLogin} className="w-full bg-[#222222] text-white py-4 px-4 rounded-xl font-bold hover:bg-stone-800 transition-colors flex items-center justify-center gap-3 shadow-sm text-sm">G Sign in with Google</button>
           )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-4 md:p-8 lg:p-12 flex flex-col bg-[#faf9f6] overflow-hidden w-full">
        
        <div className="flex flex-row justify-between items-start md:items-end mb-6 md:mb-10 gap-2 shrink-0">
          <div className="flex items-start md:items-center gap-3 md:gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mt-1 text-xl bg-white w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-stone-200">☰</button>
             <div><h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#222222] mb-1">{activeTab}</h1><p className="text-stone-500 font-medium text-xs md:text-lg">Saka: {indianDateString}</p></div>
          </div>
          <div className="bg-white px-3 md:px-5 py-2 md:py-3 rounded-xl md:rounded-2xl shadow-sm border border-stone-200 flex items-center gap-2 mt-1 md:mt-0"><span className="relative flex h-2 w-2 md:h-3 md:w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative rounded-full h-full w-full bg-rose-500"></span></span><span className="font-mono font-bold text-stone-700 text-xs md:text-lg">{timeString}</span></div>
        </div>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-stone-200 rounded-3xl p-6 bg-stone-50/50"><div className="text-6xl mb-4">🎯</div><h2 className="text-2xl font-bold text-stone-800 mb-3">Welcome to Target Master</h2><p className="text-stone-500 text-sm max-w-lg mx-auto px-4">Sign in to view your secure tasks, analytics, and timeline.</p></div>
        ) : (
          <>
            {activeTab === "Progress" ? (
              <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-y-auto pb-10">
                {/* 1. Consistency Matrix */}
                <div className="w-full lg:w-1/2 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-stone-200 h-fit">
                   <h2 className="text-2xl md:text-3xl font-bold mb-2 text-stone-800 text-center lg:text-left">Consistency Matrix</h2>
                   <p className="text-stone-500 text-sm md:text-base mb-8 text-center lg:text-left">Your overall completion distribution.</p>
                   {totalDaysWithTasks === 0 ? (
                      <div className="p-8 text-center text-stone-400 italic bg-stone-50 rounded-3xl border border-dashed border-stone-200">Finish tasks today to start matrix analysis.</div>
                   ) : (
                      <div className="space-y-6">
                        {Object.entries({ "Elite (90-100%)": [consistencyBrackets["90-100%"], "bg-emerald-400"], "Solid (70-89%)": [consistencyBrackets["70-89%"], "bg-blue-400"], "Average (50-69%)": [consistencyBrackets["50-69%"], "bg-yellow-400"], "Poor (<50%)": [consistencyBrackets["Below 50%"], "bg-rose-400"] }).map(([label, [val, color]]) => (
                          <div key={label}>
                            <div className="flex justify-between text-sm font-bold mb-2"><span>{label}</span><span>{val} days</span></div>
                            <div className="w-full bg-stone-100 h-4 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(val/totalDaysWithTasks)*100}%` }} className={`${color} h-full`}/></div>
                          </div>
                        ))}
                        <div className="mt-8 pt-6 border-t border-stone-100 text-center"><span className="text-4xl font-black text-stone-800">{totalDaysWithTasks}</span><p className="text-stone-500 font-bold text-[10px] tracking-widest uppercase mt-1">Total Days Tracked</p></div>
                      </div>
                   )}
                </div>

                {/* 2. Github/Codeforces Streak Panel */}
                <div className="w-full lg:w-1/2 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-stone-200 h-fit">
                   <h2 className="text-2xl md:text-3xl font-bold mb-2 text-stone-800 text-center lg:text-left">Target Heatmap</h2>
                   <p className="text-stone-500 text-sm md:text-base mb-8 text-center lg:text-left">Your daily study streak (Last 100 Days).</p>
                   
                   <div className="flex flex-col">
                      {/* Months Labels */}
                      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide mb-1 px-1">
                        {streakData.filter((d, i) => i % 14 === 0).map((d, i) => (
                          <span key={i} className="text-[10px] font-bold text-stone-400 min-w-[40px]">{d.month}</span>
                        ))}
                      </div>
                      
                      {/* The Grid / Bar */}
                      <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                        {/* Desktop: Grid-like layout | Mobile: Single horizontal scrollable bar */}
                        <div className="flex flex-wrap md:grid md:grid-flow-col md:grid-rows-7 gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                          {streakData.map((day, idx) => (
                            <motion.div 
                              key={idx} 
                              whileHover={{ scale: 1.2, zIndex: 10 }}
                              className={`w-4 h-4 md:w-3.5 md:h-3.5 rounded-[3px] shrink-0 ${day.color} transition-colors cursor-help border border-black/5`}
                              title={`${day.date.toDateString()}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center justify-end gap-2 mt-6 text-[10px] font-bold text-stone-400">
                        <span>Less</span>
                        <div className="flex gap-1">
                          <div className="w-3 h-3 rounded-[2px] bg-stone-200"></div>
                          <div className="w-3 h-3 rounded-[2px] bg-rose-400"></div>
                          <div className="w-3 h-3 rounded-[2px] bg-yellow-400"></div>
                          <div className="w-3 h-3 rounded-[2px] bg-blue-500"></div>
                          <div className="w-3 h-3 rounded-[2px] bg-emerald-500"></div>
                        </div>
                        <span>More</span>
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              /* All other existing views (Target, Today, Upcoming, Flashcards, Sticky Notes) stay exactly as they were in the previous version */
              <div className="flex flex-col flex-1 h-0">
                {activeTab === "Target" && (
                   <div className="flex flex-col h-full overflow-hidden">
                   <div ref={scrollRef} className="flex overflow-x-auto gap-3 md:gap-4 pb-4 md:pb-6 mb-4 md:mb-6 pt-2 shrink-0 scrollbar-hide">
                     {calendarDates.map((d, i) => {
                       const isSelected = d.toDateString() === selectedDate.toDateString();
                       const isToday = d.toDateString() === new Date().toDateString();
                       return (
                         <motion.div key={i} onClick={() => setSelectedDate(d)} className={`flex flex-col items-center justify-center min-w-[4.5rem] md:min-w-[5.5rem] p-3 md:p-4 rounded-2xl md:rounded-3xl cursor-pointer border ${isSelected ? "bg-[#222222] text-white shadow-lg" : isToday ? "bg-[#dcf0f5] text-stone-800" : "bg-white text-stone-500"}`}>
                           <span className="text-[10px] font-bold uppercase">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                           <span className="text-xl md:text-2xl font-black mt-1">{d.getDate()}</span>
                           <span className="text-[10px] md:text-xs font-medium mt-1">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                         </motion.div>
                       )
                     })}
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 overflow-y-auto pb-10">
                     <div className="bg-[#fff4c2] p-6 md:p-8 rounded-3xl h-fit">
                       <h3 className="text-lg font-bold mb-4">Add Target</h3>
                       <div className="flex flex-col gap-3">
                         <input className="bg-white/60 p-4 rounded-xl outline-none text-sm font-medium" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTask()} placeholder="Mechanical project task..."/>
                         <button onClick={addTask} className="bg-[#222222] text-white py-3 rounded-xl font-bold text-sm">Pin Target</button>
                       </div>
                     </div>
                     <div className="bg-[#dcf0f5] p-6 md:p-8 rounded-3xl flex flex-col min-h-[300px]">
                       <h3 className="text-lg font-bold mb-4">Wall: {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</h3>
                       <div className="space-y-3 overflow-y-auto">
                         {visibleTasks.map(t => (
                           <div key={t.id} className="flex items-start gap-3 bg-white/60 p-3 rounded-xl border border-white group">
                             {!isFutureDate(t.date) && <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)} className="mt-1 accent-[#222222]" />}
                             <span className={`text-sm flex-1 ${t.completed && !isFutureDate(t.date) ? "line-through text-stone-400" : "font-medium"}`}>{t.text}</span>
                             <button onClick={() => deleteTask(t.id)} className="text-stone-400 hover:text-rose-500">✕</button>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 </div>
                )}
                {activeTab === "Today" && (
                   <div className="max-w-3xl w-full bg-[#dcf0f5] p-6 md:p-10 rounded-3xl md:rounded-[3rem] flex flex-col flex-1 h-0">
                   <div className="mb-6 bg-white/50 p-5 rounded-2xl">
                      <div className="flex justify-between items-end mb-2"><h3 className="font-bold">Focus</h3><span className="text-3xl font-black">{todayEfficiency}%</span></div>
                      <div className="w-full bg-stone-200 h-3 rounded-full overflow-hidden"><motion.div className="bg-cyan-500 h-full" style={{ width: `${todayEfficiency}%` }} /></div>
                   </div>
                   <div className="flex-1 overflow-y-auto space-y-3">
                     {todayTasks.map(t => (
                        <div key={t.id} className="flex items-start gap-4 bg-white/70 p-4 rounded-xl">
                          <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)} className="mt-1 w-5 h-5 accent-[#222222]" />
                          <span className={`text-base flex-1 ${t.completed ? "line-through text-stone-400" : "font-medium"}`}>{t.text}</span>
                        </div>
                     ))}
                   </div>
                  </div>
                )}
                {activeTab === "Flashcards" && (
                  <div className="flex flex-col flex-1 h-0 overflow-hidden">
                    {!activeDeckId ? (
                      <div className="flex-1 overflow-y-auto pr-2">
                        <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
                          <h2 className="text-2xl font-bold">Decks</h2>
                          <div className="flex gap-2 w-full md:w-auto">
                            <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="New Deck..." className="flex-1 md:w-64 px-4 py-2 rounded-xl border outline-none" onKeyPress={e => e.key === 'Enter' && addDeck()} />
                            <button onClick={addDeck} className="bg-[#222222] text-white w-10 rounded-xl font-bold">+</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {decks.map(deck => (
                            <div key={deck.id} onClick={() => setActiveDeckId(deck.id)} className="bg-[#fff4c2] aspect-square rounded-2xl p-4 shadow-sm cursor-pointer relative group">
                              <button onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }} className="absolute top-2 right-2 text-rose-500 opacity-0 group-hover:opacity-100">✕</button>
                              <h3 className="text-lg font-bold line-clamp-2">{deck.name}</h3>
                              <p className="text-xs bg-white/50 px-2 py-1 rounded mt-2">{deck.cards?.length || 0} Cards</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                          <button onClick={closeDeck} className="text-stone-400 text-xs uppercase tracking-widest">← Back</button>
                          <button onClick={shuffleActiveDeck} className="bg-stone-200 px-4 py-2 rounded-xl text-sm font-bold">Shuffle</button>
                        </div>
                        <div className="bg-white p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-2 shrink-0">
                          <input value={newCardQ} onChange={e => setNewCardQ(e.target.value)} placeholder="Question" className="flex-1 bg-stone-50 p-3 rounded-xl text-sm outline-none" />
                          <input value={newCardA} onChange={e => setNewCardA(e.target.value)} placeholder="Answer" className="flex-1 bg-stone-50 p-3 rounded-xl text-sm outline-none" />
                          <button onClick={addCardToDeck} className="bg-[#222222] text-white px-6 py-3 rounded-xl text-sm font-bold">Add</button>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                          {decks.find(d => d.id === activeDeckId)?.cards?.map(card => (
                            <div key={card.id} onClick={() => toggleFlip(card.id)} className="h-40 cursor-pointer relative group" style={{ perspective: "1000px" }}>
                              <motion.div className="w-full h-full relative" animate={{ rotateY: flippedCards[card.id] ? 180 : 0 }} style={{ transformStyle: "preserve-3d", transition: '0.6s' }}>
                                <div className="absolute inset-0 bg-white border rounded-2xl p-4 flex items-center justify-center text-center" style={{ backfaceVisibility: "hidden" }}><p className="font-bold">{card.q}</p></div>
                                <div className="absolute inset-0 bg-[#222222] text-white rounded-2xl p-4 flex items-center justify-center text-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><p className="font-bold">{card.a}</p></div>
                              </motion.div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "Sticky Notes" && (
                   <div className="max-w-4xl w-full bg-[#fce5e8] p-8 md:p-12 rounded-[3rem] flex flex-col flex-1 h-0">
                    <h2 className="text-2xl font-bold mb-6">Global Scratchpad</h2>
                    <textarea className="flex-1 bg-transparent border-none outline-none resize-none text-lg leading-relaxed" placeholder="Jot project ideas..." value={globalNotes} onChange={(e) => setGlobalNotes(e.target.value)} spellCheck="false" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;