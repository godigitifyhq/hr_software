import apiClient from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface RegisterInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roles: string[];
    };
}

export interface ForgotPasswordInput {
    email: string;
}

export interface ResetPasswordInput {
    token: string;
    password: string;
}

export class AuthService {
    static async register(input: RegisterInput): Promise<LoginResponse> {
        const { data } = await apiClient.post<LoginResponse>('/auth/register', input);
        return data;
    }

    static async login(input: LoginInput): Promise<LoginResponse> {
        const { data } = await apiClient.post<LoginResponse>('/auth/login', input);
        return data;
    }

    static async logout(): Promise<void> {
        await apiClient.post('/auth/logout');
    }

    static async refreshToken(): Promise<LoginResponse> {
        const { data } = await apiClient.post<LoginResponse>('/auth/refresh');
        return data;
    }

    static async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
        const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', input);
        return data;
    }

    static async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
        const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', input);
        return data;
    }

    static getErrorMessage(error: unknown): string {
        if (error instanceof AxiosError) {
            if (error.response?.status === 429) {
                return 'Too many attempts. Please try again later.';
            }
            if (error.response?.data?.message) {
                return error.response.data.message;
            }
            if (error.message) {
                return error.message;
            }
        }
        return 'An error occurred. Please try again.';
    }
}
