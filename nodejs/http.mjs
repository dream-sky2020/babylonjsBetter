export const json = (body, status = 200) => ({ body, status })
export const text = (body, status) => ({ body, status, raw: true, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
export const failure = (message, status, extra) => json({ success: false, message, ...extra }, status)

export class RequestError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function readBody(request, limit) {
  if (Number(request.headers['content-length']) > limit) {
    request.resume()
    throw new RequestError('request body is too large', 413)
  }
  const chunks = []
  let size = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > limit) {
      request.resume()
      throw new RequestError('request body is too large', 413)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

export async function readRequestJson(request, limit = 64 * 1024 * 1024) {
  if (!/^application\/(?:json|[^; ]+\+json)(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) return null
  const body = await readBody(request, limit)
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    return null
  }
}

