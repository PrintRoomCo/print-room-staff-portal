'use client'

import Link from 'next/link'
import { useStaff } from '@/contexts/StaffContext'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Image,
  ClipboardList,
  BarChart3,
  Bot,
  Presentation,
} from 'lucide-react'
import type { StaffPermission } from '@/types/staff'

interface ToolCard {
  id: StaffPermission
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  status: 'active' | 'coming-soon'
}

const TOOLS: ToolCard[] = [
  {
    id: 'image-generator',
    title: 'Image Generator',
    description: 'AI-powered product image generation for design views, ecommerce, and tech packs.',
    href: '/image-generator',
    icon: Image,
    status: 'active',
  },
  {
    id: 'job-tracker',
    title: 'Job Tracker',
    description: 'Track production jobs and manage order statuses.',
    href: '/job-tracker',
    icon: ClipboardList,
    status: 'coming-soon',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Business intelligence, sales reports, and pre-order tracking.',
    href: '/reports',
    icon: BarChart3,
    status: 'coming-soon',
  },
  {
    id: 'chatbot-admin',
    title: 'Chatbot Admin',
    description: 'Manage the AI chatbot, view conversations, and configure responses.',
    href: '/chatbot-admin',
    icon: Bot,
    status: 'coming-soon',
  },
  {
    id: 'presentations',
    title: 'Presentations',
    description: 'Build structured client proposals with reusable product, pricing, and packaging sections.',
    href: '/presentations',
    icon: Presentation,
    status: 'active',
  },
]

export default function DashboardPage() {
  const { staff, hasPermission } = useStaff()

  const visibleTools = TOOLS.filter(tool => hasPermission(tool.id))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back{staff?.display_name ? `, ${staff.display_name}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your internal tools, all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleTools.map((tool) => (
          <Link key={tool.id} href={tool.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer relative">
              {tool.status === 'coming-soon' && (
                <div className="absolute top-3 right-3 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
                  Coming Soon
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-pr-blue/10 flex items-center justify-center">
                    <tool.icon className="w-5 h-5 text-pr-blue" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
