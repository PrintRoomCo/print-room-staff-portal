'use client'

import { Bot } from 'lucide-react'

export default function ChatbotAdminPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-gray-400" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Chatbot Admin</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-md">
        Chatbot management is coming soon. View conversations, manage responses, and monitor the AI chatbot.
      </p>
    </div>
  )
}
