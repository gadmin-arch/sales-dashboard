import { NextResponse } from 'next/server'
import { ZodError, ZodSchema } from 'zod'

export interface ApiErrorResponse {
  error: string
  details?: any
}

/**
 * A wrapper to handle API route execution, catching standard errors and Zod validation errors.
 */
export async function withErrorHandler(
  handler: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  try {
    return await handler()
  } catch (error: any) {
    console.error('API Error:', error)

    if (error instanceof ZodError) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    if (error.name === 'UnauthorizedError') {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper to validate a request body or search params against a Zod schema.
 */
export async function validateRequest<T>(
  req: Request,
  schema: ZodSchema<T>,
  type: 'body' | 'query' = 'body'
): Promise<T> {
  if (type === 'query') {
    const url = new URL(req.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    return schema.parse(queryParams)
  }

  const body = await req.json()
  return schema.parse(body)
}
