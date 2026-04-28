'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useStaff } from '@/contexts/StaffContext'
import type { StaffPermission } from '@/types/staff'
import {
  LayoutDashboard,
  Image as ImageIcon,
  Eye,
  ShoppingBag,
  FileText,
  FilePlus,
  List,
  Library,
  BookOpen,
  ClipboardList,
  BarChart3,
  Bot,
  Presentation,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Package,
  Boxes,
  ShoppingCart,
  FileCheck,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  id: StaffPermission | 'dashboard' | 'settings' | 'quote-tool'
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
    icon: ImageIcon,
    permission: 'image-generator',
    items: [
      { label: 'Overview', href: '/image-generator', icon: ImageIcon },
      { label: 'Design Tool Views', href: '/image-generator/views', icon: Eye },
      { label: 'Proposal & Web Assets', href: '/image-generator/ecommerce', icon: ShoppingBag },
      { label: 'Tech Pack Assets', href: '/image-generator/techpacks', icon: FileText },
      { label: 'Asset Library', href: '/image-generator/library', icon: Library },
      { label: 'All Jobs', href: '/image-generator/jobs', icon: List },
    ],
  },
  {
    id: 'quote-tool',
    label: 'Quote Tool',
    icon: FileText,
    permission: 'quote-tool',
    items: [
      { label: 'Quote Dashboard', href: '/quote-tool', icon: FileText },
      { label: 'New Quote', href: '/quote-tool/new', icon: FilePlus },
      { label: 'Saved Quotes', href: '/quote-tool/quotes', icon: List },
      { label: 'Design Tool', href: '/quote-tool/design-tool', icon: Pencil },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    permission: 'orders',
    items: [
      { label: 'All Orders', href: '/orders', icon: ShoppingCart },
      { label: 'New Order', href: '/orders/new', icon: FilePlus },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    permission: 'products',
    items: [
      { label: 'All Products', href: '/products', icon: Package },
      { label: 'Workwear', href: '/products?channel=workwear', icon: Package },
      { label: 'Pre-order', href: '/products?channel=preorder', icon: Package },
      { label: 'B2B', href: '/products?channel=b2b', icon: Package },
    ],
  },
  {
    id: 'catalogues',
    label: 'Catalogues',
    icon: BookOpen,
    permission: 'catalogues',
    items: [
      { label: 'Catalogues', href: '/catalogues', icon: BookOpen },
      { label: 'Design Proofs', href: '/proofs', icon: FileCheck },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    permission: 'inventory',
    items: [
      { label: 'Overview', href: '/inventory', icon: Boxes },
      { label: 'Audit Log', href: '/inventory/events', icon: List },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Hydrate sidebar collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('staff-sidebar-collapsed')
    if (stored === 'true') setSidebarCollapsed(true)
  }, [])

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('staff-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

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

  // Close drawer on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    if (drawerOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [drawerOpen])

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

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile Floating Header */}
      <nav aria-label="Mobile header" className="md:hidden">
        <div className="header-floating-wrapper">
          <div className="header-floating-inner">
            <Link href="/dashboard" prefetch={false} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                <Image
                  src="/print-room-logo.png"
                  alt="Print Room Logo"
                  width={24}
                  height={24}
                  className="h-auto w-auto object-contain"
                />
              </div>
              <span className="text-white text-sm font-semibold">Staff Portal</span>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="p-2 rounded-full hover:bg-white/10 transition-colors duration-300 ease-spring"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </nav>

      {/* Drawer Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 ${sidebarCollapsed ? 'w-[80px]' : 'w-64'} glass-sidebar flex flex-col z-50 transition-all duration-300 ease-spring ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 overflow-hidden`}
      >
        {/* Top bar: mobile close + desktop collapse toggle */}
        <div className="flex items-center justify-end p-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="p-2 rounded-full hover:bg-white/10 transition-colors duration-300 ease-spring md:hidden"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-2 rounded-full hover:bg-white/10 transition-colors duration-300 ease-spring hidden md:block"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-white/70" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-white/70" />
            )}
          </button>
        </div>

        {/* Logo */}
        <div
          className={`${sidebarCollapsed ? 'px-2 py-4 flex justify-center' : 'p-6'} hidden md:block transition-all duration-300`}
        >
          <Link
            href="/dashboard"
            prefetch={false}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} group`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden transition-all duration-300 ease-spring group-hover:shadow-md flex-shrink-0">
              <Image
                src="/print-room-logo.png"
                alt="Print Room Logo"
                width={40}
                height={40}
                className="h-auto w-auto object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <div className="text-white text-sm font-semibold whitespace-nowrap">The Print Room</div>
                  <div className="text-white/60 text-xs">Staff Portal</div>
                </div>
              </>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-3'} py-4 space-y-1 overflow-y-auto sidebar-scroll transition-all duration-300`}>
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
                  prefetch={false}
                  className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''} ${sidebarCollapsed ? 'justify-center !px-2' : ''}`}
                  title={sidebarCollapsed ? section.label : undefined}
                >
                  <section.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{section.label}</span>}
                </Link>
              )
            }

            // Multi-item sections: when collapsed, link to first item
            if (sidebarCollapsed) {
              const firstItem = section.items[0]
              return (
                <Link
                  key={section.id}
                  href={firstItem.href}
                  prefetch={false}
                  className={`sidebar-link justify-center !px-2 ${isSectionActive ? 'sidebar-link-active' : ''}`}
                  title={section.label}
                >
                  <section.icon className="w-5 h-5 flex-shrink-0" />
                </Link>
              )
            }

            // Multi-item sections: expanded sidebar — collapsible groups
            return (
              <div key={section.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`sidebar-link w-full justify-between ${isSectionActive && !isExpanded ? 'sidebar-link-active' : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <section.icon className="w-5 h-5 flex-shrink-0" />
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
                          prefetch={false}
                          className={`sidebar-link text-xs ${isActive ? 'sidebar-link-active' : ''}`}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
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
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-3'} transition-all duration-300`}>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              router.push('/sign-in')
            }}
            className={`sidebar-link w-full ${sidebarCollapsed ? 'justify-center !px-2' : ''}`}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 ${sidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-64'} pt-16 md:pt-0 transition-[margin] duration-300 ease-spring`}
      >
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
