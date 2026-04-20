export type StaffRole = 'staff' | 'admin' | 'super_admin'

export type StaffPermission =
  | 'image-generator'
  | 'job-tracker'
  | 'reports'
  | 'chatbot-admin'
  | 'presentations'
  | 'settings'
  | 'quote-tool'
  | 'products'
  | 'inventory'
  | 'inventory:write'

export interface StaffUser {
  id: string
  user_id: string
  email: string
  display_name: string
  role: StaffRole
  permissions: StaffPermission[]
  is_active: boolean
  created_at: string
  updated_at: string
}
