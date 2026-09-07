import { TourProvider } from "@/components/byte/tour/TourProvider"
import { ChatProvider } from "@/contexts/chat-context"
import { FloatingChatWidget } from "@/components/byte/chat/FloatingChatWidget"

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <TourProvider role="admin">
        {children}
        <FloatingChatWidget />
      </TourProvider>
    </ChatProvider>
  )
}
