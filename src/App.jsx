import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  // 1. Core State
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("Sticky Wall"); 
  
  // 2. Calendar & Time State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollRef = useRef(null);

  // Live IST Clock Updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate 30 days of calendar dates (7 days past, 23 days future)
  const calendarDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 + i);
    return d;
  });

  // Filter tasks to ONLY show tasks for the currently selected date
  const visibleTasks = tasks.filter(t => t.date === selectedDate.toDateString());

  const addTask = () => {
    if (!input.trim()) return;
    const newTask = { 
      id: Date.now(), 
      text: input, 
      completed: false, 
      date: selectedDate.toDateString() // Bind task to selected date
    };
    setTasks([...tasks, newTask]);
    setInput("");
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  // Helper for Sidebar
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
      {count !== null && (
        <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded text-xs font-bold">
          {count}
        </span>
      )}
    </li>
  );

  // Formatters for Indian Locale
  const timeString = currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit', second: '2-digit' });
  const indianDateString = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', calendar: 'indian', month: 'long', day: 'numeric', year: 'numeric' }).format(currentTime);

  return (
    <div className="flex h-screen bg-[#c8d1c9] p-4 lg:p-8 font-sans text-[#333333] antialiased selection:bg-rose-200">
      <div className="flex w-full max-w-7xl mx-auto bg-[#fdfcfb] rounded-[2rem] shadow-2xl overflow-hidden border border-white/50">

        {/* ================= LEFT SIDEBAR (Unchanged) ================= */}
        <div className="w-72 bg-[#fcfbf9] p-6 hidden md:flex flex-col border-r border-stone-100 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold tracking-tight">Menu</h2>
            <span className="text-xl cursor-pointer text-stone-400 hover:text-stone-800 transition-colors">≡</span>
          </div>

          <div className="bg-white border border-stone-200 px-3 py-2.5 rounded-xl mb-8 flex items-center text-sm text-stone-400 shadow-sm">
            <span className="mr-2 text-stone-300">🔍</span> Search
          </div>

          <div className="flex-1 space-y-8">
            <div>
              <h3 className="text-[10px] font-bold text-stone-400 mb-2 tracking-widest uppercase px-3">Tasks</h3>
              <ul className="space-y-1 text-sm">
                {renderSidebarItem("»", "Upcoming", tasks.filter(t => new Date(t.date) > new Date()).length, activeTab === "Upcoming")}
                {renderSidebarItem("≡", "Today", tasks.filter(t => t.date === new Date().toDateString()).length, activeTab === "Today")}
                {renderSidebarItem("📝", "Sticky Wall", null, activeTab === "Sticky Wall")}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-stone-400 mb-2 tracking-widest uppercase px-3">Lists</h3>
              <ul className="space-y-1 text-sm">
                {renderSidebarItem(<div className="w-3.5 h-3.5 rounded bg-[#f5cfb3]"></div>, "Personal", null, activeTab === "Personal")}
                {renderSidebarItem(<div className="w-3.5 h-3.5 rounded bg-[#b3e0dc]"></div>, "Work", null, activeTab === "Work")}
                {renderSidebarItem(<div className="w-3.5 h-3.5 rounded bg-[#fce5e8]"></div>, "List 1", null, activeTab === "List 1")}
              </ul>
            </div>
          </div>
        </div>

        {/* ================= MAIN CONTENT ================= */}
        <div className="flex-1 p-8 lg:p-12 flex flex-col bg-[#faf9f6] overflow-hidden">
          
          {/* Header with Live IST Time & Indian Calendar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
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

          {activeTab === "Sticky Wall" ? (
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* ================= HORIZONTAL CALENDAR STRIP ================= */}
              <div 
                ref={scrollRef}
                className="flex overflow-x-auto gap-3 pb-4 mb-6 pt-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hides scrollbar but allows scroll
              >
                {calendarDates.map((d, i) => {
                  const isSelected = d.toDateString() === selectedDate.toDateString();
                  const isToday = d.toDateString() === new Date().toDateString();
                  
                  return (
                    <motion.div 
                      key={i}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedDate(d)}
                      className={`flex flex-col items-center justify-center min-w-[4.5rem] p-3 rounded-2xl cursor-pointer transition-all border ${
                        isSelected 
                          ? "bg-[#222222] text-white border-[#222222] shadow-md" 
                          : isToday 
                            ? "bg-[#dcf0f5] text-stone-800 border-[#b3e0dc]" 
                            : "bg-white text-stone-500 border-stone-100 hover:border-stone-300"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </span>
                      <span className={`text-xl font-black mt-1 ${isSelected ? 'text-white' : 'text-stone-800'}`}>
                        {d.getDate()}
                      </span>
                      <span className="text-[10px] font-medium opacity-80 mt-0.5">
                        {d.toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                    </motion.div>
                  )
                })}
              </div>

              {/* ================= STICKY NOTES GRID ================= */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-10 pr-2">
                
                {/* Note 1: Input (Yellow) */}
                <div className="bg-[#fff4c2] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow h-fit">
                  <h3 className="text-lg font-bold mb-4 text-stone-800 flex justify-between">
                    Add Target
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-lg">
                      {selectedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                  </h3>
                  <div className="flex flex-col gap-3">
                    <input 
                      className="bg-white/50 p-3 rounded-xl border-none focus:ring-2 focus:ring-yellow-400/50 outline-none text-stone-700 placeholder-stone-500 text-sm font-medium"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTask()}
                      placeholder="What needs to be done?"
                    />
                    <button onClick={addTask} className="bg-[#222222] text-white py-3 rounded-xl font-bold hover:bg-stone-700 transition-colors text-sm shadow-sm">
                      Pin to Timeline
                    </button>
                  </div>
                </div>

                {/* Note 2: Tasks (Blue) */}
                <div className="bg-[#dcf0f5] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[350px]">
                  <h3 className="text-lg font-bold mb-4 text-stone-800">
                    Targets for {selectedDate.toDateString() === new Date().toDateString() ? "Today" : selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                  </h3>
                  <div className="flex-1 space-y-3 overflow-y-auto">
                    <AnimatePresence>
                      {visibleTasks.map(t => (
                        <motion.div 
                          key={t.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-start gap-3 group bg-white/40 p-3 rounded-xl border border-white/50"
                        >
                          <input 
                            type="checkbox" 
                            checked={t.completed}
                            onChange={() => toggleTask(t.id)}
                            className="mt-1 w-4 h-4 rounded border-stone-400 text-stone-800 focus:ring-stone-800 cursor-pointer accent-[#222222]" 
                          />
                          <span className={`text-sm leading-relaxed transition-all ${t.completed ? "line-through text-stone-400" : "text-stone-700 font-medium"}`}>
                            {t.text}
                          </span>
                        </motion.div>
                      ))}
                      {visibleTasks.length === 0 && (
                        <div className="text-stone-500 text-sm italic mt-4 text-center">
                          No targets pinned for this date.
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Note 3: Stats (Pink) */}
                <div className="bg-[#fce5e8] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-fit">
                  <h3 className="text-lg font-bold mb-2 text-stone-800">Daily Efficiency</h3>
                  <p className="text-stone-600 text-xs mb-8 leading-relaxed">
                    Completion rate for {selectedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}.
                  </p>
                  <div className="flex-1 flex flex-col items-center justify-center py-4">
                    <motion.div 
                      key={visibleTasks.filter(t => t.completed).length}
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="text-7xl font-black text-[#222222] mb-4"
                    >
                      {visibleTasks.length > 0 ? Math.round((visibleTasks.filter(t => t.completed).length / visibleTasks.length) * 100) : 0}%
                    </motion.div>
                    <div className="w-full bg-white/60 h-2.5 rounded-full overflow-hidden mt-4">
                       <motion.div 
                          className="bg-rose-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${visibleTasks.length > 0 ? (visibleTasks.filter(t => t.completed).length / visibleTasks.length) * 100 : 0}%` }}
                       />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
              <p>The {activeTab} view is currently under construction...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;