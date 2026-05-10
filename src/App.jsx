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
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollRef = useRef(null);

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
      return; 
    }
    
    const q = query(collection(db, "tasks"), where("uid", "==", user.uid));
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribeData();
  }, [user]);

  const handleLogin = () => signInWithPopup(auth, googleProvider).catch(err => console.error(err));
  const handleLogout = () => signOut(auth);

  // ================= DATABASE ACTIONS =================
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


  // ================= DATA FILTERING & TIME LOGIC =================
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
      onClick={() => setActiveTab(label)}
      className={`flex justify-between items-center px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
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
  const indianDateString = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', calendar: 'indian', month: 'long', day: 'numeric', year: 'numeric' }).format(currentTime);

  // ================= LOGIN SCREEN =================
  if (!user) {
    return (
      <div className="h-screen w-full bg-[#c8d1c9] flex items-center justify-center p-6 font-sans">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-md w-full">
          <h1 className="text-4xl font-black text-[#222222] mb-2">Target Master</h1>
          <p className="text-stone-500 mb-10 font-medium text-sm">Mechanical Engineering Command Center</p>
          <button onClick={handleLogin} className="w-full bg-[#222222] text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-colors flex items-center justify-center gap-3 shadow-lg">
            Login with Google
          </button>
        </motion.div>
      </div>
    );
  }

  // ================= MAIN APP =================
  return (
    <div className="flex h-screen bg-[#c8d1c9] p-4 lg:p-8 font-sans text-[#333333] antialiased selection:bg-rose-200">
      <div className="flex w-full max-w-7xl mx-auto bg-[#fdfcfb] rounded-[2rem] shadow-2xl overflow-hidden border border-white/50">

        {/* SIDEBAR */}
        <div className="w-72 bg-[#fcfbf9] p-6 hidden md:flex flex-col border-r border-stone-100 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold tracking-tight">Menu</h2>
            <span className="text-xl cursor-pointer text-stone-400 hover:text-stone-800 transition-colors">≡</span>
          </div>

          <div className="flex-1 space-y-8">
            <div>
              <h3 className="text-[10px] font-bold text-stone-400 mb-2 tracking-widest uppercase px-3">Tasks</h3>
              <ul className="space-y-1 text-sm">
                {renderSidebarItem("»", "Upcoming", upcomingTasks.length, activeTab === "Upcoming")}
                {renderSidebarItem("≡", "Today", todayTasks.length, activeTab === "Today")}
                {renderSidebarItem("🎯", "Target", null, activeTab === "Target")}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-stone-400 mb-2 tracking-widest uppercase px-3">Analytics & Notes</h3>
              <ul className="space-y-1 text-sm">
                {renderSidebarItem("📊", "Progress", null, activeTab === "Progress")}
                {renderSidebarItem("📝", "Sticky Notes", null, activeTab === "Sticky Notes")}
              </ul>
            </div>
          </div>
          
          <div className="mt-auto border-t border-stone-100 pt-4">
             <div className="flex items-center gap-3 px-3 py-2 mb-2">
               <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex-shrink-0">
                  {user.photoURL ? <img src={user.photoURL} alt="profile" /> : <div className="w-full h-full bg-stone-300"></div>}
               </div>
               <div className="overflow-hidden">
                 <p className="text-sm font-bold text-stone-800 truncate">{user.displayName}</p>
               </div>
             </div>
             <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm font-bold text-stone-400 hover:text-rose-500 transition-colors">
               ↪ Sign Out
             </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 p-8 lg:p-12 flex flex-col bg-[#faf9f6] overflow-hidden">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 shrink-0">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-[#222222]">{activeTab}</h1>
              <p className="text-stone-500 font-medium mt-1">Saka Samvat: {indianDateString}</p>
            </div>
            <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-3">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
               </span>
               <span className="font-mono font-bold text-stone-700 tracking-wider">{timeString} IST</span>
            </div>
          </div>

          {activeTab === "Target" ? (
             <div className="flex flex-col h-full overflow-hidden">
             <div ref={scrollRef} className="flex overflow-x-auto gap-3 pb-4 mb-6 pt-2 shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
               {calendarDates.map((d, i) => {
                 const isSelected = d.toDateString() === selectedDate.toDateString();
                 const isToday = d.toDateString() === new Date().toDateString();
                 return (
                   <motion.div 
                     key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSelectedDate(d)}
                     className={`flex flex-col items-center justify-center min-w-[4.5rem] p-3 rounded-2xl cursor-pointer transition-all border ${
                       isSelected ? "bg-[#222222] text-white border-[#222222] shadow-md" : isToday ? "bg-[#dcf0f5] text-stone-800 border-[#b3e0dc]" : "bg-white text-stone-500 border-stone-100"
                     }`}
                   >
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                     <span className={`text-xl font-black mt-1 ${isSelected ? 'text-white' : 'text-stone-800'}`}>{d.getDate()}</span>
                     <span className="text-[10px] font-medium opacity-80 mt-0.5">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                   </motion.div>
                 )
               })}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pb-10 pr-2 max-w-4xl">
               <div className="bg-[#fff4c2] p-6 rounded-2xl shadow-sm h-fit">
                 <h3 className="text-lg font-bold mb-4 text-stone-800">Add Target</h3>
                 <div className="flex flex-col gap-3">
                   <input 
                     className="bg-white/50 p-3 rounded-xl border-none focus:ring-2 focus:ring-yellow-400/50 outline-none text-stone-700 text-sm font-medium"
                     value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTask()} placeholder="What needs to be done?"
                   />
                   <button onClick={addTask} className="bg-[#222222] text-white py-3 rounded-xl font-bold hover:bg-stone-700 transition-colors text-sm shadow-sm">Pin to Timeline</button>
                 </div>
               </div>

               <div className="bg-[#dcf0f5] p-6 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
                 <h3 className="text-lg font-bold mb-4 text-stone-800 flex justify-between items-center">
                   Targets for {selectedDate.toDateString() === new Date().toDateString() ? "Today" : selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                 </h3>
                 <div className="flex-1 space-y-3 overflow-y-auto">
                   <AnimatePresence>
                     {visibleTasks.map(t => {
                       const isFuture = isFutureDate(t.date);
                       return (
                         <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-start gap-3 bg-white/40 p-3 rounded-xl border border-white/50 group">
                           {isFuture ? (
                             <button onClick={() => deleteTask(t.id)} className="mt-0.5 text-rose-400 hover:text-rose-600 font-bold px-1 transition-colors">✕</button>
                           ) : (
                             <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)} className="mt-1 w-4 h-4 rounded border-stone-400 cursor-pointer accent-[#222222]" />
                           )}
                           <span className={`text-sm leading-relaxed transition-all flex-1 ${t.completed && !isFuture ? "line-through text-stone-400" : "text-stone-700 font-medium"}`}>{t.text}</span>
                           {!isFuture && (
                             <button onClick={() => deleteTask(t.id)} className="text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                           )}
                         </motion.div>
                       );
                     })}
                     {visibleTasks.length === 0 && <div className="text-stone-500 text-sm italic mt-4 text-center">No targets pinned for this date.</div>}
                   </AnimatePresence>
                 </div>
               </div>
             </div>
           </div>
          ) 

          : activeTab === "Today" ? (
            <div className="max-w-2xl w-full bg-[#dcf0f5] p-8 rounded-3xl shadow-sm border border-white flex flex-col h-[75vh]">
                 <div className="mb-8 bg-white/40 p-5 rounded-2xl border border-white">
                    <div className="flex justify-between items-end mb-2">
                      <h3 className="text-stone-800 font-bold">Today's Focus Level</h3>
                      <span className="text-3xl font-black text-[#222222]">{todayEfficiency}%</span>
                    </div>
                    <div className="w-full bg-stone-200 h-3 rounded-full overflow-hidden">
                       <motion.div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${todayEfficiency}%` }} />
                    </div>
                 </div>

                 <h2 className="text-xl font-bold mb-4 text-stone-800 flex justify-between items-center">
                   Action Items
                   <span className="text-xs font-bold bg-white/60 text-stone-600 px-3 py-1 rounded-lg shadow-sm">
                     {todayCompleted} / {todayTotal} Completed
                   </span>
                 </h2>
                 <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                   <AnimatePresence>
                      {todayTasks.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-stone-500 italic text-center px-4">No targets set for today. Plan ahead in the Target tab.</div>
                      ) : (
                        todayTasks.map(t => (
                          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4 bg-white/60 p-4 rounded-xl border border-white shadow-sm group">
                            <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)} className="mt-1 w-5 h-5 rounded border-stone-400 cursor-pointer accent-[#222222]" />
                            <span className={`text-lg transition-all flex-1 ${t.completed ? "line-through text-stone-400" : "text-stone-800 font-medium"}`}>{t.text}</span>
                            <button onClick={() => deleteTask(t.id)} className="text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity text-xl">✕</button>
                          </motion.div>
                        ))
                      )}
                   </AnimatePresence>
                 </div>
            </div>
          )

          : activeTab === "Upcoming" ? (
            <div className="max-w-3xl w-full overflow-y-auto pr-4 pb-10 space-y-8">
              {sortedUpcomingDates.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-stone-100 text-center text-stone-500 italic">No upcoming targets on the calendar.</div>
              ) : (
                sortedUpcomingDates.map(dateKey => (
                  <div key={dateKey} className="bg-[#fff4c2] p-6 rounded-3xl shadow-sm border border-white">
                    <h3 className="text-xl font-bold mb-4 text-stone-800 border-b border-yellow-200/50 pb-2">
                      {new Date(dateKey).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    <div className="space-y-3">
                      {upcomingTasksByDate[dateKey].map(t => (
                        <div key={t.id} className="flex items-start gap-3 bg-white/50 p-3 rounded-xl border border-white/50 group">
                          <button onClick={() => deleteTask(t.id)} className="mt-1 text-rose-400 hover:text-rose-600 font-bold px-1">✕</button>
                          <span className="text-base text-stone-700 font-medium flex-1">{t.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )

          : activeTab === "Progress" ? (
            <div className="max-w-2xl w-full bg-white p-10 rounded-3xl shadow-sm border border-stone-100 flex flex-col h-[75vh] overflow-y-auto">
               <h2 className="text-3xl font-bold mb-2 text-stone-800">Consistency Matrix</h2>
               <p className="text-stone-500 text-base mb-10 border-b border-stone-100 pb-4">Historical distribution of your daily task completion rates.</p>

               {totalDaysWithTasks === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-stone-400 italic bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 text-center px-4">
                    Data will generate once you complete tasks today or log historical tasks.
                  </div>
               ) : (
                  <div className="space-y-8 mt-4">
                    <div>
                      <div className="flex justify-between text-base mb-2">
                        <span className="font-bold text-emerald-600">Elite Days (90-100%)</span>
                        <span className="font-bold text-stone-700">{consistencyBrackets["90-100%"]} days</span>
                      </div>
                      <div className="w-full bg-stone-100 h-5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["90-100%"] / totalDaysWithTasks) * 100}%` }} className="bg-emerald-400 h-full rounded-full"/>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-base mb-2">
                        <span className="font-bold text-blue-600">Solid Days (70-89%)</span>
                        <span className="font-bold text-stone-700">{consistencyBrackets["70-89%"]} days</span>
                      </div>
                      <div className="w-full bg-stone-100 h-5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["70-89%"] / totalDaysWithTasks) * 100}%` }} className="bg-blue-400 h-full rounded-full"/>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-base mb-2">
                        <span className="font-bold text-yellow-600">Average Days (50-69%)</span>
                        <span className="font-bold text-stone-700">{consistencyBrackets["50-69%"]} days</span>
                      </div>
                      <div className="w-full bg-stone-100 h-5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["50-69%"] / totalDaysWithTasks) * 100}%` }} className="bg-yellow-400 h-full rounded-full"/>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-base mb-2">
                        <span className="font-bold text-rose-600">Poor Days (&lt;50%)</span>
                        <span className="font-bold text-stone-700">{consistencyBrackets["Below 50%"]} days</span>
                      </div>
                      <div className="w-full bg-stone-100 h-5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(consistencyBrackets["Below 50%"] / totalDaysWithTasks) * 100}%` }} className="bg-rose-400 h-full rounded-full"/>
                      </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-stone-100 text-center">
                      <span className="text-5xl font-black text-stone-800">{totalDaysWithTasks}</span>
                      <p className="text-stone-500 font-bold text-sm mt-2 tracking-widest uppercase">Total Days Tracked</p>
                    </div>
                  </div>
               )}
            </div>
          )

          : activeTab === "Sticky Notes" ? (
            <div className="max-w-4xl w-full bg-[#fce5e8] p-10 rounded-3xl shadow-sm border border-white flex flex-col h-[75vh]">
              <h2 className="text-2xl font-bold mb-6 text-stone-800">Global Scratchpad</h2>
              <textarea 
                className="flex-1 bg-transparent border-none outline-none resize-none text-stone-700 text-lg leading-relaxed placeholder-stone-400/70 custom-scrollbar"
                placeholder="Jot down important points, project ideas, or quick thoughts here..."
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                spellCheck="false"
              />
            </div>
          )
          
          : (
            <div className="flex flex-1 items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
              <p>Under construction...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;