import { NextRequest } from 'next/server'
import { proxyRequest } from '@/lib/api-proxy'

const TARGET_BASE_URL = process.env.IMAGE_GENERATOR_API_URL!

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, TARGET_BASE_URL, path.join('/'), 'image-generator')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, TARGET_BASE_URL, path.join('/'), 'image-generator')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, TARGET_BASE_URL, path.join('/'), 'image-generator')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, TARGET_BASE_URL, path.join('/'), 'image-generator')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, TARGET_BASE_URL, path.join('/'), 'image-generator')
}
