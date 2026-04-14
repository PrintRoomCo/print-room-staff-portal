'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useStaff } from '@/contexts/StaffContext'
import type { StaffPermission } from '@/types/staff'
import {
  LayoutDashboard,
  Image,
  Eye,
  ShoppingBag,
  FileText,
  List,
  ClipboardList,
  BarChart3,
  Bot,
  Presentation,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  id: StaffPermission | 'dashboard' | 'settings'
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
  permission?: StaffPermission
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'image-generator',
    label: 'Image Generator',
    icon: Image,
    permission: 'image-generator',
    items: [
      { label: 'Overview', href: '/image-generator', icon: Image },
      { label: 'Design Tool Views', href: '/image-generator/views', icon: Eye },
      { label: 'Ecommerce Images', href: '/image-generator/ecommerce', icon: ShoppingBag },
      { label: 'Tech Pack Assets', href: '/image-generator/techpacks', icon: FileText },
      { label: 'All Jobs', href: '/image-generator/jobs', icon: List },
    ],
  },
  {
    id: 'job-tracker',
    label: 'Job Tracker',
    icon: ClipboardList,
    permission: 'job-tracker',
    items: [
      { label: 'Job Tracker', href: '/job-tracker', icon: ClipboardList },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    permission: 'reports',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'chatbot-admin',
    label: 'Chatbot Admin',
    icon: Bot,
    permission: 'chatbot-admin',
    items: [
      { label: 'Chatbot Admin', href: '/chatbot-admin', icon: Bot },
    ],
  },
  {
    id: 'presentations',
    label: 'Presentations',
    icon: Presentation,
    permission: 'presentations',
    items: [
      { label: 'Presentations', href: '/presentations', icon: Presentation },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'My Profile', href: '/settings', icon: Settings },
      { label: 'Manage Staff', href: '/settings/staff', icon: Users },
    ],
  },
]

export function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const { hasPermission, isAdmin } = useStaff()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Auto-expand the section that contains the current path
  useEffect(() => {
    const activeSection = NAV_SECTIONS.find(section =>
      section.items.some(item =>
        pathname === item.href || pathname.startsWith(item.href + '/')
      )
    )
    if (activeSection) {
      setExpandedSections(prev => new Set(prev).add(activeSection.id))
    }
  }, [pathname])

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter sections by permissions
  const visibleSections = NAV_SECTIONS.filter(section => {
    if (section.id === 'dashboard') return true
    if (section.id === 'settings') return true
    if (section.permission) return hasPermission(section.permission)
    return true
  }).map(section => {
    // Hide "Manage Staff" for non-admins
    if (section.id === 'settings' && !isAdmin) {
      return {
        ...section,
        items: section.items.filter(item => item.href !== '/settings/staff'),
      }
    }
    return section
  })

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pr-blue flex items-center justify-center text-white text-sm font-bold">
            PR
          </div>
          <div>
            <div className="text-white text-sm font-semibold">The Print Room</div>
            <div className="text-gray-400 text-xs">Staff Portal</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleSections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const hasMultipleItems = section.items.length > 1
          const isSectionActive = section.items.some(
            item => pathname === item.href || pathname.startsWith(item.href + '/')
          )

          // Single-item sections render as a direct link
          if (!hasMultipleItems) {
            const item = section.items[0]
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={section.id}
                href={item.href}
                className={`staff-sidebar-link ${isActive ? 'staff-sidebar-link-active' : ''}`}
              >
                <section.icon className="w-4 h-4 flex-shrink-0" />
                <span>{section.label}</span>
              </Link>
            )
          }

          // Multi-item sections render as collapsible groups
          return (
            <div key={section.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`staff-sidebar-link w-full justify-between ${isSectionActive && !isExpanded ? 'staff-sidebar-link-active' : ''}`}
              >
                <span className="flex items-center gap-3">
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{section.label}</span>
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`staff-sidebar-link text-xs ${isActive ? 'staff-sidebar-link-active' : ''}`}
                      >
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={async () => {
            await signOut()
            router.push('/sign-in')
          }}
          className="staff-sidebar-link w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pr-blue flex items-center justify-center text-white text-xs font-bold">
            PR
          </div>
          <span className="text-sm font-semibold text-foreground">Staff Portal</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-60 staff-sidebar flex flex-col z-50 transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Mobile close */}
        <div className="flex justify-end p-2 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  )
}
