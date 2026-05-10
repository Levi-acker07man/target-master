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
  const [cardInputs, setCardInputs] = useState({}); // Tracks what user types
  const [cardStatus, setCardStatus] = useState({}); // 'correct', 'wrong', or null
  const [showPopup, setShowPopup] = useState(null); // To show "Correct!" briefly

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
    if (!user) return;
    const qT = query(collection(db, "tasks"), where("uid", "==", user.uid));
    const unsubT = onSnapshot(qT, (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qD = query(collection(db, "decks"), where("uid", "==", user.uid));
    const unsubD = onSnapshot(qD, (s) => setDecks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubT(); unsubD(); };
  }, [user]);

  const handleLogin = () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  // Task Actions
  const addTask = async () => {
    if (!input.trim() || !user) return;
    await addDoc(collection(db, "tasks"), {
      text: input, completed: false, date: selectedDate.toDateString(), uid: user.uid, createdAt: serverTimestamp()
    });
    setInput("");
  };

  // Flashcard Logic
  const addDeck = async () => {
    if (!newDeckName.trim()) return;
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

  const deleteCardFromDeck = async (cardId) => {
    const deck = decks.find(d => d.id === activeDeckId);
    const updated = deck.cards.filter(c => c.id !== cardId);
    await updateDoc(doc(db, "decks", activeDeckId), { cards: updated });
  };

  const checkAnswer = (cardId, correctAnswer) => {
    const userInput = cardInputs[cardId] || "";
    if (userInput.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
      setCardStatus(prev => ({ ...prev, [cardId]: 'correct' }));
      setFlippedCards(prev => ({ ...prev, [cardId]: true }));
      setShowPopup(cardId);
      setTimeout(() => setShowPopup(null), 900);
    } else {
      setCardStatus(prev => ({ ...prev, [cardId]: 'wrong' }));
    }
  };

  // Data Filtering
  const todayString = new Date().toDateString();
  const tasksByDate = tasks.reduce((acc, task) => {
    if (!acc[task.date]) acc[task.date] = { total: 0, completed: 0 };
    acc[task.date].total += 1;
    if (task.completed) acc[task.date].completed += 1;
    return acc;
  }, {});

  const streakData = Array.from({ length: 105 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 104 + i);
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

  const timeString = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', second: '2-digit' });

  return (
    <div className="flex h-[100dvh] w-screen bg-[#faf9f6] font-sans text-[#333333] overflow-hidden relative">
      
      {/* Mobile Sidebar Logic */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-stone-900/30 z-40 md:hidden backdrop-blur-sm" />
        )}
      </AnimatePresence>

      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#fcfbf9] p-6 flex flex-col border-r transition-transform md:static md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <h2 className="text-2xl font-bold mb-10">Menu</h2>
        <ul className="flex-1 space-y-2">
          {['Target', 'Today', 'Progress', 'Flashcards', 'Sticky Notes'].map(tab => (
            <li key={tab} onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`p-3 rounded-xl cursor-pointer ${activeTab === tab ? "bg-stone-100 font-bold" : "text-stone-500"}`}>{tab}</li>
          ))}
        </ul>
        {user ? (
          <button onClick={handleLogout} className="mt-auto text-rose-500 font-bold">↪ Sign Out</button>
        ) : (
          <button onClick={handleLogin} className="mt-auto bg-black text-white p-3 rounded-xl">Sign In</button>
        )}
      </div>

      <div className="flex-1 p-4 md:p-12 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-2xl">☰</button>
            <h1 className="text-3xl md:text-5xl font-bold">{activeTab}</h1>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border font-mono font-bold">{timeString}</div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {activeTab === "Target" && (
            <div className="flex flex-col h-full">
              {/* Responsive Calendar */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
                {calendarDates.map((d, i) => (
                  <div key={i} onClick={() => setSelectedDate(d)} className={`min-w-[60px] p-4 rounded-2xl cursor-pointer text-center border ${d.toDateString() === selectedDate.toDateString() ? "bg-black text-white" : "bg-white"}`}>
                    <div className="text-[10px] uppercase">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                    <div className="text-xl font-black">{d.getDate()}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#fff4c2] p-6 rounded-3xl h-fit">
                  <input className="w-full bg-white/60 p-4 rounded-2xl outline-none mb-4" value={input} onChange={e => setInput(e.target.value)} placeholder="Add new target..." />
                  <button onClick={addTask} className="w-full bg-black text-white p-4 rounded-2xl font-bold">Pin Target</button>
                </div>
                <div className="bg-[#dcf0f5] p-6 rounded-3xl min-h-[300px]">
                  {tasks.filter(t => t.date === selectedDate.toDateString()).map(t => (
                    <div key={t.id} className="flex bg-white/60 p-4 rounded-2xl mb-2 justify-between">
                      <span>{t.text}</span>
                      <button onClick={async () => await deleteDoc(doc(db, "tasks", t.id))}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Progress" && (
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
              {/* Consistency Board - Height matched to Heatmap using flex-1 */}
              <div className="flex-1 bg-white p-8 rounded-[2.5rem] border flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-6">Consistency</h2>
                  <div className="space-y-6">
                    {['Elite', 'Solid', 'Average', 'Poor'].map(l => (
                      <div key={l}>
                        <div className="flex justify-between text-xs font-bold mb-2 uppercase text-stone-400"><span>{l}</span></div>
                        <div className="w-full bg-stone-100 h-3 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-6 border-t mt-auto text-center">
                  <div className="text-4xl font-black">105</div>
                  <div className="text-xs font-bold text-stone-400 uppercase">Total Days</div>
                </div>
              </div>

              {/* Heatmap */}
              <div className="lg:w-2/3 bg-white p-8 rounded-[2.5rem] border overflow-hidden">
                <h2 className="text-2xl font-bold mb-6 text-center lg:text-left">Target Heatmap</h2>
                <div className="overflow-x-auto pb-4">
                  <div className="min-w-[600px] grid grid-flow-col grid-rows-7 gap-1.5">
                    {streakData.map((day, idx) => (
                      <div key={idx} className={`w-[30px] h-[30px] rounded-md ${day.color} border border-black/5`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Flashcards" && (
            <div className="flex flex-col h-full">
              {!activeDeckId ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {decks.map(d => (
                    <div key={d.id} onClick={() => setActiveDeckId(d.id)} className="bg-[#fff4c2] aspect-square rounded-3xl p-6 relative cursor-pointer">
                      <h3 className="text-xl font-bold">{d.name}</h3>
                    </div>
                  ))}
                  <div className="border-2 border-dashed rounded-3xl p-6">
                    <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="Deck Name" className="w-full mb-2 bg-transparent outline-none" />
                    <button onClick={addDeck} className="w-full bg-black text-white rounded-xl p-2">+</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex justify-between mb-6">
                    <button onClick={() => setActiveDeckId(null)}>← Back</button>
                    <h2 className="text-2xl font-bold">{decks.find(d => d.id === activeDeckId)?.name}</h2>
                  </div>
                  
                  {/* Add Card */}
                  <div className="flex gap-2 mb-8 bg-white p-4 rounded-2xl border">
                    <input value={newCardQ} onChange={e => setNewCardQ(e.target.value)} placeholder="Question" className="flex-1 outline-none" />
                    <input value={newCardA} onChange={e => setNewCardA(e.target.value)} placeholder="Answer" className="flex-1 outline-none" />
                    <button onClick={addCardToDeck} className="bg-black text-white px-4 rounded-xl">Add</button>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {decks.find(d => d.id === activeDeckId)?.cards.map(card => (
                      <div key={card.id} className="relative h-64 group" style={{ perspective: '1000px' }}>
                        
                        {/* Cross Button */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteCardFromDeck(card.id); }}
                          className="absolute -top-2 -right-2 z-20 bg-white shadow-md rounded-full w-8 h-8 text-rose-500 hover:scale-110 transition-transform"
                        >✕</button>

                        <motion.div 
                          className="w-full h-full relative" 
                          animate={{ rotateY: flippedCards[card.id] ? 180 : 0 }} 
                          transition={{ duration: 0.6, type: 'spring', damping: 20 }}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          {/* Front Side */}
                          <div 
                            className={`absolute inset-0 p-6 rounded-[2rem] border-2 shadow-sm flex flex-col justify-between backface-hidden transition-colors ${cardStatus[card.id] === 'wrong' ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-100'}`}
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            <p className="text-lg font-bold">{card.q}</p>
                            
                            <div className="space-y-2">
                              <input 
                                className="w-full p-3 rounded-xl border outline-none text-sm"
                                placeholder="Type answer here..."
                                value={cardInputs[card.id] || ""}
                                onChange={(e) => setCardInputs(prev => ({ ...prev, [card.id]: e.target.value }))}
                                disabled={flippedCards[card.id]}
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => checkAnswer(card.id, card.a)}
                                  className="flex-1 bg-black text-white p-2 rounded-xl text-xs font-bold"
                                >Check</button>
                                {cardStatus[card.id] === 'wrong' && (
                                  <button 
                                    onClick={() => setFlippedCards(prev => ({ ...prev, [card.id]: true }))}
                                    className="px-3 bg-stone-200 rounded-xl text-[10px] font-bold"
                                  >Show</button>
                                )}
                              </div>
                            </div>

                            {/* Correct Popup Overlay */}
                            <AnimatePresence>
                              {showPopup === card.id && (
                                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-emerald-500 rounded-[2rem] flex items-center justify-center z-10">
                                  <span className="text-white font-black text-xl">CORRECT!</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Back Side */}
                          <div 
                            className="absolute inset-0 p-6 rounded-[2rem] bg-emerald-500 text-white flex flex-col items-center justify-center text-center"
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <p className="text-xs font-bold mb-2 uppercase opacity-70">Correct Answer</p>
                            <p className="text-xl font-bold">{card.a}</p>
                            <button 
                              onClick={() => {
                                setFlippedCards(prev => ({ ...prev, [card.id]: false }));
                                setCardStatus(prev => ({ ...prev, [card.id]: null }));
                                setCardInputs(prev => ({ ...prev, [card.id]: "" }));
                              }}
                              className="mt-6 bg-white/20 px-4 py-2 rounded-full text-xs font-bold"
                            >Try Again</button>
                          </div>
                        </motion.div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Sticky Notes" && (
            <div className="h-full bg-[#fce5e8] p-8 rounded-[3rem] border border-white shadow-sm">
              <textarea className="w-full h-full bg-transparent border-none outline-none resize-none text-xl" placeholder="Jot down notes..." value={globalNotes} onChange={e => setGlobalNotes(e.target.value)} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;