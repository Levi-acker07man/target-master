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
  
  // Mobile Menu State
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

  // ================= FIREBASE AUTHENTICATION =================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // ================= FIREBASE REAL-TIME DATABASE =================
  useEffect(() => {
    if (!user) { 
      setTasks([]); 
      setDecks([]);
      return; 
    }
    
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

  // ================= TASK ACTIONS =================
  const addTask = async () => {
    if (!input.trim() || !user) return;
    await addDoc(collection(db, "tasks"), {
      text: input,
      completed: false,
      date: selectedDate.toDateString(),
      uid: user.uid,
      createdAt: serverTimestamp()
    });
    setInput("");
  };

  const toggleTask = async (id, currentStatus) => {
    await updateDoc(doc(db, "tasks", id), { completed: !currentStatus });
  };

  const deleteTask = async (id) => {
    await deleteDoc(doc(db, "tasks", id));
  };

  // ================= FLASHCARD ACTIONS =================
  const addDeck = async () => {
    if (!newDeckName.trim() || !user) return;
    await addDoc(collection(db, "decks"), {
      name: newDeckName,
      uid: user.uid,
      cards: [],
      createdAt: serverTimestamp()
    });
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
    setNewCardQ("");
    setNewCardA("");
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

  const toggleFlip = (cardId) => {
    setFlippedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const closeDeck = () => {
    setActiveDeckId(null);
    setFlippedCards({});
  };


  // ================= DATA FILTERING =================
  const todayString = new Date().toDateString();
  const isFutureDate = (dateStr) => new Date(dateStr) > new Date(todayString);
  
  const visibleTasks = tasks.filter(t => t.date === selectedDate.toDateString());
  const todayTasks = tasks.filter(t => t.date === todayString);
  const upcomingTasks = tasks.filter(t => isFutureDate(t.date));

  const todayCompleted = todayTasks.filter(t => t.completed).length;
  const todayTotal = todayTasks.length;
  const todayEfficiency = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

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

  const renderSidebarItem = (icon, label, count, isActive) => (
    <li 
      onClick={() => { setActiveTab(label); setIsMobileMenuOpen(false); }}
      className={`flex justify-between items-center px-4 py-3 rounded-xl cursor-pointer transition-colors ${
        isActive ? "bg-stone-100 text-stone-800 font-bold shadow-sm" : "hover:bg-stone-50 text-stone-500 font-medium"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg flex items-center justify-center w-5">{icon}</span>
        <span>{label}</span>
      </div>
      {count > 0 && (
        <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded text-xs font-bold">{count}</span>
      )}
    </li>
  );

  const timeString = currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit', second: '2-digit' });
  const indianDateString = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', calendar: 'indian', month: 'short', day: 'numeric', year: 'numeric' }).format(currentTime);

  // ================= MAIN APP =================
  return (
    // Replaced h-screen with h-[100dvh] for perfect mobile browser fitting
    <div className="flex h-[100dvh] w-screen bg-[#faf9f6] font-sans text-[#333333] antialiased selection:bg-rose-200 overflow-hidden relative">
      
      {/* ================= MOBILE MENU OVERLAY ================= */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="fixed inset-0 bg-stone-900/30 z-40 md:hidden backdrop-blur-sm" 
          />
        )}
      </AnimatePresence>

      {/* ================= SIDEBAR ================= */}
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
        
        {/* AUTHENTICATION */}
        <div className="mt-auto border-t border-stone-200 pt-6">
           {user ? (
             <>
               <div className="flex items-center gap-4 px-4 py-3 mb-2 bg-white rounded-2xl shadow-sm border border-stone-100">
                 <div className="w-10 h-10 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 border border-stone-300">
                    {user.photoURL ? <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-stone-300"></div>}
                 </div>
                 <div className="overflow-hidden">
                   <p className="text-sm font-bold text-stone-800 truncate">{user.displayName}</p>
                   <p className="text-xs text-stone-400 truncate">Engineering</p>
                 </div>
               </div>
               <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm font-bold text-stone-400 hover:text-rose-500 transition-colors">
                 ↪ Sign Out
               </button>
             </>
           ) : (
             <button onClick={handleLogin} className="w-full bg-[#222222] text-white py-4 px-4 rounded-xl font-bold hover:bg-stone-800 transition-colors flex items-center justify-center gap-3 shadow-sm">
               <span className="text-xl">G</span> Sign in with Google
             </button>
           )}
        </div>
      </div>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="flex-1 p-4 md:p-8 lg:p-12 flex flex-col bg-[#faf9f6] overflow-hidden w-full">
        
        {/* HEADER (Now has Hamburger button on Mobile) */}
        <div className="flex flex-row justify-between items-start md:items-end mb-6 md:mb-10 gap-2 shrink-0">
          <div className="flex items-start md:items-center gap-3 md:gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mt-1 text-xl bg-white w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-stone-200 text-stone-600 hover:bg-stone-50">
               ☰
             </button>
             <div>
               <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#222222] mb-1">{activeTab}</h1>
               <p className="text-stone-500 font-medium text-xs md:text-lg">Saka Samvat: {indianDateString}</p>
             </div>
          </div>
          <div className="bg-white px-3 md:px-5 py-2 md:py-3 rounded-xl md:rounded-2xl shadow-sm border border-stone-200 flex items-center gap-2 md:gap-4 self-start md:self-auto mt-1 md:mt-0">
             <span className="relative flex h-2 w-2 md:h-3 md:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-rose-500"></span>
             </span>
             <span className="font-mono font-bold text-stone-700 tracking-wider text-xs md:text-lg">{timeString}</span>
          </div>
        </div>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-stone-200 rounded-3xl md:rounded-[3rem] p-6 md:p-12 bg-stone-50/50">
             <div className="text-6xl md:text-7xl mb-4 md:mb-6">🎯</div>
             <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-3 md:mb-4">Welcome to Target Master</h2>
             <p className="text-stone-500 text-sm md:text-lg max-w-lg mx-auto leading-relaxed px-4">Please sign in using the menu to view your secure tasks, analytics, and timeline.</p>
             <button onClick={() => setIsMobileMenuOpen(true)} className="mt-8 md:hidden bg-[#222222] text-white px-8 py-3 rounded-xl font-bold shadow-md">Open Menu</button>
          </div>
        ) : (
          <>
            {activeTab === "Target" ? (
               <div className="flex flex-col h-full overflow-hidden">
               <div ref={scrollRef} className="flex overflow-x-auto gap-3 md:gap-4 pb-4 md:pb-6 mb-4 md:mb-6 pt-2 shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                 {calendarDates.map((d, i) => {
                   const isSelected = d.toDateString() === selectedDate.toDateString();
                   const isToday = d.toDateString() === new Date().toDateString();
                   return (
                     <motion.div 
                       key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSelectedDate(d)}
                       className={`flex flex-col items-center justify-center min-w-[4.5rem] md:min-w-[5.5rem] p-3 md:p-4 rounded-2xl md:rounded-3xl cursor-pointer transition-all border ${
                         isSelected ? "bg-[#222222] text-white border-[#222222] shadow-lg" : isToday ? "bg-[#dcf0f5] text-stone-800 border-[#b3e0dc]" : "bg-white text-stone-500 border-stone-200"
                       }`}
                     >
                       <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest opacity-80">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                       <span className={`text-xl md:text-2xl font-black mt-1 ${isSelected ? 'text-white' : 'text-stone-800'}`}>{d.getDate()}</span>
                       <span className="text-[10px] md:text-xs font-medium opacity-80 mt-1">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                     </motion.div>
                   )
                 })}
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 overflow-y-auto pb-10 pr-2 md:pr-4 max-w-5xl">
                 <div className="bg-[#fff4c2] p-6 md:p-8 rounded-3xl shadow-sm border border-white h-fit">
                   <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-stone-800">Add Target</h3>
                   <div className="flex flex-col gap-3 md:gap-4">
                     <input 
                       className="bg-white/60 p-4 rounded-xl md:rounded-2xl border-none focus:ring-2 focus:ring-yellow-400/50 outline-none text-stone-700 text-sm md:text-base font-medium"
                       value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTask()} placeholder="What needs to be done?"
                     />
                     <button onClick={addTask} className="bg-[#222222] text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-bold hover:bg-stone-800 transition-colors shadow-sm text-sm md:text-base">Pin to Timeline</button>
                   </div>
                 </div>

                 <div className="bg-[#dcf0f5] p-6 md:p-8 rounded-3xl shadow-sm border border-white flex flex-col min-h-[300px] md:min-h-[400px]">
                   <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-stone-800 flex justify-between items-center">
                     Targets for {selectedDate.toDateString() === new Date().toDateString() ? "Today" : selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                   </h3>
                   <div className="flex-1 space-y-3 md:space-y-4 overflow-y-auto pr-1 md:pr-2">
                     <AnimatePresence>
                       {visibleTasks.map(t => {
                         const isFuture = isFutureDate(t.date);
                         return (
                           <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-start gap-3 md:gap-4 bg-white/60 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white shadow-sm group">
                             {isFuture ? (
                               <button onClick={() => deleteTask(t.id)} className="mt-1 text-rose-400 hover:text-rose-600 font-bold px-1 transition-colors">✕</button>
                             ) : (
                               <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)} className="mt-1 w-5 h-5 rounded border-stone-400 cursor-pointer accent-[#222222] shrink-0" />
                             )}
                             <span className={`text-sm md:text-base leading-relaxed transition-all flex-1 ${t.completed && !isFuture ? "line-through text-stone-400" : "text-stone-700 font-medium"}`}>{t.text}</span>
                             {!isFuture && (
                               <button onClick={() => deleteTask(t.id)} className="text-stone-300 hover:text-rose-500 md:opacity-0 group-hover:opacity-100 transition-opacity text-base md:text-lg">✕</button>
                             )}
                           </motion.div>
                         );
                       })}
                       {visibleTasks.length === 0 && <div className="text-stone-500 text-sm md:text-base italic mt-6 text-center">No targets pinned for this date.</div>}
                     </AnimatePresence>
                   </div>
                 </div>
               </div>
             </div>
            ) 

            : activeTab === "Today" ? (
              <div className="max-w-3xl w-full bg-[#dcf0f5] p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-sm border border-white flex flex-col flex-1 h-0">
                   <div className="mb-6 md:mb-10 bg-white/50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-white shadow-sm">
                      <div className="flex justify-between items-end mb-2 md:mb-3">
                        <h3 className="text-stone-800 font-bold text-base md:text-lg">Today's Focus Level</h3>
                        <span className="text-3xl md:text-4xl font-black text-[#222222]">{todayEfficiency}%</span>
                      </div>
                      <div className="w-full bg-stone-200 h-3 md:h-4 rounded-full overflow-hidden">
                         <motion.div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${todayEfficiency}%` }} />
                      </div>
                   </div>

                   <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-stone-800 flex justify-between items-center">
                     Action Items
                     <span className="text-xs md:text-sm font-bold bg-white/80 text-stone-600 px-3 md:px-4 py-1.5 rounded-lg md:rounded-xl shadow-sm">
                       {todayCompleted} / {todayTotal} Done
                     </span>
                   </h2>
                   <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pr-1 md:pr-2">
                     <AnimatePresence>
                        {todayTasks.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-stone-500 italic text-center px-4 text-sm md:text-base">No targets set for today. Plan ahead in the Target tab.</div>
                        ) : (
                          todayTasks.map(t => (
                            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 md:gap-4 bg-white/70 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white shadow-sm group">
                              <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)} className="mt-1 w-5 h-5 md:w-6 md:h-6 rounded border-stone-400 cursor-pointer accent-[#222222] shrink-0" />
                              <span className={`text-base md:text-lg transition-all flex-1 ${t.completed ? "line-through text-stone-400" : "text-stone-800 font-medium"}`}>{t.text}</span>
                              <button onClick={() => deleteTask(t.id)} className="text-stone-300 hover:text-rose-500 md:opacity-0 group-hover:opacity-100 transition-opacity text-xl md:text-2xl">✕</button>
                            </motion.div>
                          ))
                        )}
                     </AnimatePresence>
                   </div>
              </div>
            )

            : activeTab === "Upcoming" ? (
              <div className="max-w-4xl w-full overflow-y-auto pr-2 md:pr-4 pb-10 space-y-6 md:space-y-8">
                {sortedUpcomingDates.length === 0 ? (
                  <div className="bg-white p-8 md:p-12 rounded-3xl md:rounded-[3rem] border border-stone-200 text-center text-stone-500 italic text-base md:text-lg">No upcoming targets on the calendar.</div>
                ) : (
                  sortedUpcomingDates.map(dateKey => (
                    <div key={dateKey} className="bg-[#fff4c2] p-6 md:p-8 rounded-3xl md:rounded-[2rem] shadow-sm border border-white">
                      <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-stone-800 border-b border-yellow-200/60 pb-2 md:pb-3">
                        {new Date(dateKey).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h3>
                      <div className="space-y-3 md:space-y-4">
                        {upcomingTasksByDate[dateKey].map(t => (
                          <div key={t.id} className="flex items-start gap-3 md:gap-4 bg-white/60 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white shadow-sm group">
                            <button onClick={() => deleteTask(t.id)} className="mt-0.5 text-rose-400 hover:text-rose-600 font-bold px-1 md:px-2 text-base md:text-lg">✕</button>
                            <span className="text-base md:text-lg text-stone-700 font-medium flex-1">{t.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )

            : activeTab === "Progress" ? (
              <div className="max-w-3xl w-full bg-white p-6 md:p-12 rounded-3xl md:rounded-[3rem] shadow-sm border border-stone-200 flex flex-col flex-1 h-0 overflow-y-auto">
                 <h2 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3 text-stone-800">Consistency Matrix</h2>
                 <p className="text-stone-500 text-sm md:text-lg mb-8 md:mb-12 border-b border-stone-100 pb-4 md:pb-6">Historical distribution of your daily task completion rates.</p>

                 {totalDaysWithTasks === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-stone-400 italic bg-stone-50 rounded-2xl md:rounded-3xl border-2 border-dashed border-stone-200 text-center p-6 text-sm md:text-lg">
                      Data will generate once you complete tasks today or log historical tasks.
                    </div>
                 ) : (
                    <div className="space-y-6 md:space-y-10 mt-2 md:mt-4">
                      <div>
                        <div className="flex justify-between text-sm md:text-lg mb-2 md:mb-3">
                          <span className="font-bold text-emerald-600">Elite Days (90-100%)</span>
                          <span className="font-bold text-stone-700">{consistencyBrackets["90-100%"]} days</span>
                        </div>
                        <div className="w-full bg-stone-100 h-4 md:h-6 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["90-100%"] / totalDaysWithTasks) * 100}%` }} className="bg-emerald-400 h-full rounded-full"/>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm md:text-lg mb-2 md:mb-3">
                          <span className="font-bold text-blue-600">Solid Days (70-89%)</span>
                          <span className="font-bold text-stone-700">{consistencyBrackets["70-89%"]} days</span>
                        </div>
                        <div className="w-full bg-stone-100 h-4 md:h-6 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["70-89%"] / totalDaysWithTasks) * 100}%` }} className="bg-blue-400 h-full rounded-full"/>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm md:text-lg mb-2 md:mb-3">
                          <span className="font-bold text-yellow-600">Average Days (50-69%)</span>
                          <span className="font-bold text-stone-700">{consistencyBrackets["50-69%"]} days</span>
                        </div>
                        <div className="w-full bg-stone-100 h-4 md:h-6 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["50-69%"] / totalDaysWithTasks) * 100}%` }} className="bg-yellow-400 h-full rounded-full"/>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm md:text-lg mb-2 md:mb-3">
                          <span className="font-bold text-rose-600">Poor Days (&lt;50%)</span>
                          <span className="font-bold text-stone-700">{consistencyBrackets["Below 50%"]} days</span>
                        </div>
                        <div className="w-full bg-stone-100 h-4 md:h-6 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["Below 50%"] / totalDaysWithTasks) * 100}%` }} className="bg-rose-400 h-full rounded-full"/>
                        </div>
                      </div>
                      <div className="mt-10 md:mt-16 pt-8 md:pt-10 border-t border-stone-100 text-center pb-8">
                        <span className="text-5xl md:text-6xl font-black text-stone-800">{totalDaysWithTasks}</span>
                        <p className="text-stone-500 font-bold mt-2 md:mt-3 tracking-widest uppercase text-xs md:text-sm">Total Days Tracked</p>
                      </div>
                    </div>
                 )}
              </div>
            )

            : activeTab === "Flashcards" ? (
              <div className="flex flex-col flex-1 h-0 overflow-hidden w-full max-w-6xl">
                {!activeDeckId ? (
                   // ================= GRID OF DECKS =================
                   <div className="flex-1 overflow-y-auto pr-2 md:pr-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
                         <h2 className="text-2xl md:text-3xl font-bold text-stone-800 hidden md:block">Your Decks</h2>
                         <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                            <input 
                              value={newDeckName} onChange={e => setNewDeckName(e.target.value)} 
                              placeholder="e.g., C++ Algorithms" 
                              className="flex-1 md:w-72 px-4 py-3 md:px-5 md:py-3 rounded-xl md:rounded-2xl border border-stone-200 outline-none focus:border-[#222222] transition-colors shadow-sm text-sm md:text-base"
                              onKeyPress={(e) => e.key === 'Enter' && addDeck()}
                            />
                            <button onClick={addDeck} className="bg-[#222222] text-white w-12 h-[46px] md:h-12 rounded-xl md:rounded-2xl font-bold text-2xl hover:scale-105 transition-transform flex items-center justify-center shadow-md pb-1 shrink-0">
                              +
                            </button>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-10">
                         <AnimatePresence>
                           {decks.map(deck => (
                             <motion.div 
                               key={deck.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                               onClick={() => setActiveDeckId(deck.id)}
                               className="bg-[#fff4c2] aspect-square rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm border border-yellow-200 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all flex flex-col justify-between group relative"
                             >
                               <button onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }} className="absolute top-2 right-2 md:top-4 md:right-4 bg-white w-6 h-6 md:w-8 md:h-8 rounded-full text-rose-500 md:opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-sm text-xs md:text-base">✕</button>
                               <h3 className="text-lg md:text-2xl font-bold text-stone-800 leading-tight mt-1 md:mt-2 line-clamp-3">{deck.name}</h3>
                               <p className="text-xs md:text-base text-stone-600 font-medium bg-white/50 w-fit px-2 py-1 md:px-3 md:py-1 rounded-md md:rounded-lg mt-2">{deck.cards?.length || 0} Cards</p>
                             </motion.div>
                           ))}
                           {decks.length === 0 && (
                             <div className="col-span-full text-center p-8 md:p-12 text-stone-400 italic text-sm md:text-lg border-2 border-dashed border-stone-200 rounded-2xl md:rounded-[3rem]">
                               Create a new deck using the plus button above.
                             </div>
                           )}
                         </AnimatePresence>
                      </div>
                   </div>
                ) : (
                   // ================= SPREAD VIEW (INSIDE A DECK) =================
                   <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 border-b border-stone-200 pb-4 md:pb-6 shrink-0 gap-4">
                         <div>
                           <button onClick={closeDeck} className="text-stone-400 hover:text-stone-800 font-bold mb-2 md:mb-3 flex items-center gap-2 transition-colors text-xs md:text-sm uppercase tracking-widest">
                             ← Back to Decks
                           </button>
                           <h2 className="text-2xl md:text-4xl font-bold text-stone-800 line-clamp-1">{decks.find(d => d.id === activeDeckId)?.name}</h2>
                         </div>
                         <button onClick={shuffleActiveDeck} className="w-full md:w-auto bg-stone-200 text-stone-700 px-4 py-3 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-bold hover:bg-stone-300 transition-colors flex items-center justify-center gap-2 shadow-sm text-sm md:text-base">
                           🔀 Shuffle Cards
                         </button>
                      </div>

                      {/* Add Card Form */}
                      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-stone-100 mb-6 md:mb-8 shrink-0 flex flex-col md:flex-row gap-3 md:gap-4 items-center">
                         <input value={newCardQ} onChange={e => setNewCardQ(e.target.value)} placeholder="Question" className="w-full md:flex-1 bg-stone-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-stone-100 outline-none focus:border-stone-300 transition-colors text-sm md:text-base" onKeyPress={(e) => e.key === 'Enter' && addCardToDeck()} />
                         <input value={newCardA} onChange={e => setNewCardA(e.target.value)} placeholder="Answer" className="w-full md:flex-1 bg-stone-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-stone-100 outline-none focus:border-stone-300 transition-colors text-sm md:text-base" onKeyPress={(e) => e.key === 'Enter' && addCardToDeck()} />
                         <button onClick={addCardToDeck} className="bg-[#222222] text-white w-full md:w-32 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold hover:bg-stone-800 transition-colors shadow-sm text-sm md:text-base">Add Card</button>
                      </div>

                      {/* Cards Grid */}
                      <div className="flex-1 overflow-y-auto pr-2 md:pr-4 pb-10">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <AnimatePresence>
                              {decks.find(d => d.id === activeDeckId)?.cards?.map(card => {
                                const isFlipped = flippedCards[card.id];
                                return (
                                  <motion.div 
                                    key={card.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={() => toggleFlip(card.id)}
                                    className="relative h-48 md:h-56 w-full cursor-pointer group"
                                    style={{ perspective: "1000px" }}
                                  >
                                     <button onClick={(e) => { e.stopPropagation(); deleteCardFromDeck(card.id); }} className="absolute -top-3 -right-3 z-10 bg-white border border-stone-100 w-8 h-8 md:w-10 md:h-10 rounded-full text-rose-500 md:opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-md flex items-center justify-center text-sm md:text-lg hover:bg-rose-50">✕</button>
                                     <motion.div 
                                       className="w-full h-full relative transition-all duration-500 rounded-3xl md:rounded-[2rem] shadow-sm hover:shadow-md"
                                       animate={{ rotateY: isFlipped ? 180 : 0 }}
                                       style={{ transformStyle: "preserve-3d" }}
                                     >
                                       {/* Front (Question) */}
                                       <div className="absolute inset-0 bg-white border border-stone-200 rounded-3xl md:rounded-[2rem] p-5 md:p-6 flex items-center justify-center text-center overflow-y-auto custom-scrollbar" style={{ backfaceVisibility: "hidden" }}>
                                          <p className="text-lg md:text-xl font-bold text-stone-800">{card.q}</p>
                                       </div>
                                       {/* Back (Answer) */}
                                       <div className="absolute inset-0 bg-[#222222] border border-[#222222] rounded-3xl md:rounded-[2rem] p-5 md:p-6 flex items-center justify-center text-center overflow-y-auto custom-scrollbar" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                                          <p className="text-lg md:text-xl font-bold text-white">{card.a}</p>
                                       </div>
                                     </motion.div>
                                  </motion.div>
                                )
                              })}
                              {(!decks.find(d => d.id === activeDeckId)?.cards || decks.find(d => d.id === activeDeckId)?.cards.length === 0) && (
                                <div className="col-span-full text-center py-10 text-stone-400 italic text-sm md:text-lg">No cards yet. Add one above!</div>
                              )}
                            </AnimatePresence>
                         </div>
                      </div>
                   </div>
                )}
              </div>
            )

            : activeTab === "Sticky Notes" ? (
              <div className="max-w-5xl w-full bg-[#fce5e8] p-8 md:p-12 rounded-3xl md:rounded-[3rem] shadow-sm border border-white flex flex-col flex-1 h-0">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-stone-800">Global Scratchpad</h2>
                <textarea 
                  className="flex-1 bg-transparent border-none outline-none resize-none text-stone-700 text-lg md:text-xl leading-relaxed placeholder-stone-400/70 custom-scrollbar"
                  placeholder="Jot down important points, project ideas, or quick thoughts here..."
                  value={globalNotes}
                  onChange={(e) => setGlobalNotes(e.target.value)}
                  spellCheck="false"
                />
              </div>
            )
            
            : (
              <div className="flex flex-1 items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl md:rounded-[3rem]">
                <p className="text-base md:text-xl">Under construction...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;