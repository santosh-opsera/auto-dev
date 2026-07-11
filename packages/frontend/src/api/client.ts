export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export interface FieldValidationError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields?: FieldValidationError[],
    public readonly errorCode?: string,
    public readonly suggestedAction?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    let fields: FieldValidationError[] | undefined;

    try {
      const body = (await response.json()) as {
        message?: string;
        fields?: FieldValidationError[];
        error?: string;
        suggestedAction?: string;
      };
      if (body.message) {
        message = body.message;
      }
      fields = body.fields;

      throw new ApiError(
        message,
        response.status,
        fields,
        body.error,
        body.suggestedAction,
      );
    } catch (parseError) {
      if (parseError instanceof ApiError) {
        throw parseError;
      }
      throw new ApiError(message, response.status, fields);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
