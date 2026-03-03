import { Observable, firstValueFrom } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

export interface ApiError {
  error?: any;
  status?: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class BaseApiService {
  protected http = inject(HttpClient);

  // convert an object to FormData, handling files and nested objects
  protected toFormData(payload: Record<string, any>): FormData {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'image_url' && (value instanceof File || typeof value === 'string')) {
          formData.append(key, value instanceof File ? value : value);
        } else if (key === 'file' && value instanceof File) {
          formData.append('file', value);
        } else if (value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'object' && !(value instanceof Date)) {
          // stringify objects (like settings, socials)
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return formData;
  }

  // extract error message from HTTP error response
  protected handleError(error: unknown): never {
    if (error instanceof HttpErrorResponse) {
      const apiError: ApiError = {
        error: error.error,
        status: error.status,
        message: error.error?.message || error.message || 'An error occurred'
      };

      console.error(`API Error [${error.status}]:`, apiError.message, apiError.error);
      throw apiError;
    }

    const apiError: ApiError = {
      error: error,
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    };

    console.error('API Error:', apiError.message, apiError.error);
    throw apiError;
  }

  // GET request
  protected async get<T>(url: string, options?: { params?: HttpParams; responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' }): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.get<T>(url, {
          ...(options || {}),
          responseType: (options?.responseType ?? 'json') as any
        })
      );
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected async post<T>(
    url: string,
    body?: unknown,
    options?: { params?: HttpParams; headers?: HttpHeaders | Record<string, string | string[]>; context?: HttpContext }
  ): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(url, body, options));
    } catch (error) {
      return this.handleError(error);
    }
  }

  // POST request with FormData
  protected async postFormData<T>(url: string, payload: Record<string, any>): Promise<T> {
    try {
      const formData = this.toFormData(payload);
      return await firstValueFrom(this.http.post<T>(url, formData));
    } catch (error) {
      return this.handleError(error);
    }
  }

  // PUT request with JSON body
  protected async put<T>(url: string, body?: any): Promise<T> {
    try {
      return await firstValueFrom(this.http.put<T>(url, body));
    } catch (error) {
      return this.handleError(error);
    }
  }

  // PUT request with FormData
  protected async putFormData<T>(url: string, payload: Record<string, any>): Promise<T> {
    try {
      const formData = this.toFormData(payload);
      return await firstValueFrom(this.http.put<T>(url, formData));
    } catch (error) {
      return this.handleError(error);
    }
  }

  // DELETE request
  protected async delete<T>(url: string): Promise<T> {
    try {
      return await firstValueFrom(this.http.delete<T>(url));
    } catch (error) {
      return this.handleError(error);
    }
  }

  // PATCH request with JSON body
  protected async patch<T>(url: string, body?: any): Promise<T> {
    try {
      return await firstValueFrom(this.http.patch<T>(url, body));
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Observable GET request (for RxJS streams)
  protected getObservable<T>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }

  // Observable POST request (for RxJS streams)
  protected postObservable<T>(url: string, body?: any): Observable<T> {
    return this.http.post<T>(url, body);
  }

  // extract error message from error object (for use in components)
  static getErrorMessage(error: unknown, defaultMessage: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as ApiError).message || defaultMessage;
    }
    return error instanceof Error ? error.message : defaultMessage;
  }
}
