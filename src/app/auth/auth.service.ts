import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

import { API_URL } from '../core/config/app.config';
import { UiService } from '../services/ui.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

    baseUrl = `${API_URL}/auth`;
    private userSignal = signal<any | null>(JSON.parse(localStorage.getItem('user') || 'null'));

    constructor(private http: HttpClient, private router: Router, private ui: UiService) { }

    get user() {
        return this.userSignal();
    }

    get userEmail() {
        return this.userSignal()?.email;
    }

    get userRole(): string {
        const u = this.userSignal();
        return u?.role || u?.userRole?.name || 'user';
    }

    get isAdmin(): boolean {
        const u = this.userSignal();
        return u?.roleId === 1 || u?.role?.toLowerCase() === 'admin';
    }

    get isOrganizer(): boolean {
        return this.userRole?.toLowerCase() === 'organizer';
    }

    register(data: any) {
        return this.http.post(`${this.baseUrl}/register`, data);
    }

    verifyOtp(data: any) {
        return this.http.post(`${this.baseUrl}/verify-otp`, data);
    }

    validateToken(token: string) {
        return this.http.post(`${this.baseUrl}/validate-token`, { token });
    }

    login(data: any) {
        return this.http.post(`${this.baseUrl}/login`, data);
    }

    resendOtp(data: any) {
        return this.http.post(`${this.baseUrl}/resend-otp`, data);
    }

    /** Request a password-reset OTP to be emailed to the user. */
    forgotPassword(email: string) {
        return this.http.post(`${this.baseUrl}/forgot-password`, { email });
    }

    /** Verify the emailed OTP matches (without consuming it) before opening the reset page. */
    verifyResetOtp(email: string, otp: string) {
        return this.http.post(`${this.baseUrl}/verify-reset-otp`, { email, otp });
    }

    /** Set a new password using the verified email + OTP. */
    resetPassword(email: string, otp: string, newPassword: string) {
        return this.http.post(`${this.baseUrl}/reset-password`, { email, otp, newPassword });
    }

    setAuthenticatedUser(user: any, token: string) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        this.userSignal.set(user);
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.userSignal.set(null);
        this.ui.showToast('Logged out successfully', 'success');
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return !!localStorage.getItem('token');
    }

    /**
     * Refreshes the cached user (e.g. with freshly validated permissions) without
     * touching the token. Lets admin permission changes take effect on the next
     * navigation instead of requiring a full re-login.
     */
    refreshUser(user: any) {
        if (!user) return;
        localStorage.setItem('user', JSON.stringify(user));
        this.userSignal.set(user);
    }

    hasPermission(permission: string): boolean {
        const user = this.user;
        if (!user) return false;

        // Admins implicitly have every permission.
        if (this.isAdmin) return true;

        if (!user.permissions) return false;
        const access = user.permissions.module_access || {};
        return !!access[permission];
    }

    /** Whether the current user may access a module (admin bypass + module_access). */
    canAccess(permission: string): boolean {
        return this.isAdmin || this.hasPermission(permission);
    }
}
