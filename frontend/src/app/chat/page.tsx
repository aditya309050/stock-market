import { MainLayout } from "@/components/layout/MainLayout";
import { AICopilot } from "@/components/chat/AICopilot";

export default function ChatPage() {
  return (
    <MainLayout>
      <div className="h-full flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-64 border-r border-zinc-800 bg-zinc-950/50 p-4 hidden md:flex md:flex-col gap-4">
          <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            New Chat
          </button>
          
          <div className="flex-1 overflow-auto mt-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recent Chats</h3>
            <div className="space-y-1">
              <div className="text-sm px-3 py-2 rounded bg-zinc-900/80 text-zinc-300 border border-zinc-800 cursor-pointer">
                Tech Stock Breakouts
              </div>
              <div className="text-sm px-3 py-2 rounded hover:bg-zinc-900 text-zinc-400 cursor-pointer transition-colors">
                RSI Strategy Review
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Chat Area */}
        <div className="flex-1 h-[calc(100vh-4rem)]">
          <AICopilot />
        </div>
      </div>
    </MainLayout>
  );
}
