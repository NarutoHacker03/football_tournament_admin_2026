import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [FormsModule, RouterLink],
    template: `
    <div class="min-h-screen bg-[#0B0B0B] flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-10">
          <a routerLink="/" class="inline-flex items-center gap-3">
            <img src="assets/images/logo-gold.png" alt="ATB" class="h-12 mix-blend-screen">
            <span class="text-2xl font-black tracking-widest text-[#D4AF37]">ATB SPORTS</span>
          </a>
        </div>

        <div class="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-10">
          @if (!email() || !otp()) {
            <div class="text-center py-4">
              <p class="text-red-400 mb-4">Your reset session has expired.</p>
              <a routerLink="/forgot-password" class="text-[#D4AF37] hover:underline text-sm">Request a new code</a>
            </div>
          } @else if (success()) {
            <div class="text-center">
              <div class="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
                <svg class="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-white mb-3">Password Updated!</h2>
              <p class="text-zinc-400 text-sm mb-6">Your password has been reset successfully. You can now log in with your new password.</p>
              <a routerLink="/login"
                 class="inline-block px-8 py-3 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl hover:shadow-lg hover:shadow-[#D4AF37]/30 transition-all">
                Go to Login
              </a>
            </div>
          } @else {
            <div class="mb-8">
              <h1 class="text-2xl font-bold text-white mb-2">Set New Password</h1>
              <p class="text-zinc-400 text-sm">Choose a strong password of at least 8 characters.</p>
            </div>

            @if (error()) {
              <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {{ error() }}
              </div>
            }

            <form (ngSubmit)="submit()">
              <div class="mb-5">
                <label class="block text-sm font-medium text-zinc-400 mb-2 required-mark">New Password</label>
                <div class="relative">
                  <input [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="newPassword" name="newPassword" required minlength="8"
                         placeholder="Minimum 8 characters"
                         class="w-full px-5 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#D4AF37]/5 transition-all">
                  <button type="button" (click)="showPassword.set(!showPassword())"
                          [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                          class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#D4AF37] transition-colors focus:outline-none">
                    @if (!showPassword()) {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.153 0 2.253.197 3.275.558M16.516 16.516l3.484 3.484M4.221 4.221l15.558 15.558" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  </button>
                </div>
              </div>
              <div class="mb-8">
                <label class="block text-sm font-medium text-zinc-400 mb-2 required-mark">Confirm Password</label>
                <div class="relative">
                  <input [type]="showConfirmPassword() ? 'text' : 'password'" [(ngModel)]="confirmPassword" name="confirmPassword" required
                         placeholder="Repeat your new password"
                         class="w-full px-5 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#D4AF37]/5 transition-all">
                  <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())"
                          [attr.aria-label]="showConfirmPassword() ? 'Hide password' : 'Show password'"
                          class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#D4AF37] transition-colors focus:outline-none">
                    @if (!showConfirmPassword()) {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.153 0 2.253.197 3.275.558M16.516 16.516l3.484 3.484M4.221 4.221l15.558 15.558" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" [disabled]="loading()"
                      class="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl hover:shadow-lg hover:shadow-[#D4AF37]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {{ loading() ? 'Updating...' : 'Reset Password' }}
              </button>
            </form>
          }
        </div>
      </div>
    </div>
    `
})
export class ResetPasswordComponent implements OnInit {
    email = signal('');
    otp = signal('');
    newPassword = '';
    confirmPassword = '';
    loading = signal(false);
    success = signal(false);
    error = signal('');
    showPassword = signal(false);
    showConfirmPassword = signal(false);

    constructor(private auth: AuthService) {}

    ngOnInit() {
        // The forgot-password page navigates here with { email, otp } in router state.
        const state = history.state || {};
        this.email.set(state.email || '');
        this.otp.set(state.otp || '');
    }

    submit() {
        this.error.set('');
        if (this.newPassword.length < 8) {
            this.error.set('Password must be at least 8 characters.');
            return;
        }
        if (this.newPassword !== this.confirmPassword) {
            this.error.set('Passwords do not match.');
            return;
        }
        if (this.loading()) return;

        this.loading.set(true);
        this.auth.resetPassword(this.email(), this.otp(), this.newPassword).subscribe({
            next: () => {
                this.loading.set(false);
                this.success.set(true);
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.error || 'Reset failed. The code may have expired.');
            }
        });
    }
}
