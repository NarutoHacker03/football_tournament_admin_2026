import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [FormsModule, RouterLink],
    template: `
    <div class="min-h-screen bg-[#0B0B0B] flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-10">
          <a routerLink="/" class="inline-flex items-center gap-3">
            <img src="/images/logo-gold.png" onerror="this.src='/assets/images/logo-gold.png'" alt="ATB" class="h-12 mix-blend-screen">
            <span class="text-2xl font-black tracking-widest text-[#D4AF37]">ATB SPORTS</span>
          </a>
        </div>

        <div class="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-10">
          @if (step() === 'email') {
            <div class="mb-8">
              <h1 class="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
              <p class="text-zinc-400 text-sm">Enter your email address and we'll send you a code to reset your password.</p>
            </div>

            @if (error()) {
              <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {{ error() }}
              </div>
            }

            <form (ngSubmit)="submitEmail()">
              <div class="mb-6">
                <label class="block text-sm font-medium text-zinc-400 mb-2 required-mark">Email Address</label>
                <input type="email" [(ngModel)]="email" name="email" required
                       placeholder="you@example.com"
                       class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#D4AF37]/5 transition-all">
              </div>

              <button type="submit" [disabled]="loading()"
                      class="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl hover:shadow-lg hover:shadow-[#D4AF37]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {{ loading() ? 'Sending...' : 'Send Reset Code' }}
              </button>
            </form>
          } @else {
            <div class="mb-8">
              <h1 class="text-2xl font-bold text-white mb-2">Enter Reset Code</h1>
              <p class="text-zinc-400 text-sm">
                We've sent a 6-digit code to <span class="text-[#D4AF37]">{{ email }}</span>. Enter it below to continue.
              </p>
            </div>

            @if (error()) {
              <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {{ error() }}
              </div>
            }

            <form (ngSubmit)="submitOtp()">
              <div class="mb-6">
                <label class="block text-sm font-medium text-zinc-400 mb-2 required-mark">Verification Code</label>
                <input type="text" inputmode="numeric" [(ngModel)]="otp" name="otp" required
                       maxlength="6" pattern="\\d{6}" placeholder="000000"
                       class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 tracking-[0.5em] text-center text-xl focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#D4AF37]/5 transition-all">
              </div>

              <button type="submit" [disabled]="loading()"
                      class="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl hover:shadow-lg hover:shadow-[#D4AF37]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {{ loading() ? 'Verifying...' : 'Verify Code' }}
              </button>
            </form>

            <div class="mt-6 text-center">
              <button (click)="resend()" [disabled]="loading()" class="text-sm text-[#D4AF37] hover:underline disabled:opacity-60">
                Didn't get a code? Resend
              </button>
            </div>
          }

          <div class="mt-8 text-center">
            <a routerLink="/login" class="text-sm text-zinc-500 hover:text-[#D4AF37] transition-colors">
              ← Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
    `
})
export class ForgotPasswordComponent {
    email = '';
    otp = '';
    loading = signal(false);
    step = signal<'email' | 'otp'>('email');
    error = signal('');

    constructor(private auth: AuthService, private router: Router) {}

    submitEmail() {
        if (!this.email || this.loading()) return;
        this.loading.set(true);
        this.error.set('');

        this.auth.forgotPassword(this.email).subscribe({
            next: () => {
                this.loading.set(false);
                this.step.set('otp');
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.error || 'Something went wrong. Please try again.');
            }
        });
    }

    submitOtp() {
        if (this.loading()) return;
        this.error.set('');
        if (!/^\d{6}$/.test(this.otp)) {
            this.error.set('Please enter the 6-digit code.');
            return;
        }
        this.loading.set(true);

        this.auth.verifyResetOtp(this.email, this.otp).subscribe({
            next: () => {
                this.loading.set(false);
                // Pass email + otp to the reset page via router state (kept out of the URL).
                this.router.navigate(['/reset-password'], { state: { email: this.email, otp: this.otp } });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.error || 'Invalid or expired code. Please try again.');
            }
        });
    }

    resend() {
        if (this.loading()) return;
        this.loading.set(true);
        this.error.set('');
        this.otp = '';

        this.auth.forgotPassword(this.email).subscribe({
            next: () => this.loading.set(false),
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.error || 'Could not resend the code. Please try again.');
            }
        });
    }
}
