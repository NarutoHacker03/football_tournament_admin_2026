import {
  Component,
  Input,
  forwardRef,
  signal,
  computed,
  inject,
  ElementRef,
  ViewChild,
  HostListener,
  HostBinding,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DayCell {
  day: number;
  iso: string;
  disabled: boolean;
  today: boolean;
  selected: boolean;
}

/**
 * App-wide date field that ALWAYS shows dd/mm/yyyy, regardless of the browser
 * locale (native `<input type="date">` follows the OS/browser locale and can't be
 * forced). It is a drop-in replacement for those inputs:
 *
 *   - Model value is a `yyyy-MM-dd` string (or '' when empty) — same contract as
 *     the native date input, so existing form validators, cross-field date
 *     comparisons and submit payloads keep working unchanged.
 *   - Works with both `[(ngModel)]` and `formControlName`.
 *   - `min` / `max` are `yyyy-MM-dd` strings (out-of-range days are disabled).
 *   - Accepts typing (dd/mm/yyyy, auto-masked) and a calendar popup.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true },
  ],
  template: `
    <div class="relative">
      <input #input type="text" inputmode="numeric" autocomplete="off"
        [value]="text()"
        [placeholder]="placeholder"
        [disabled]="disabled()"
        [class]="fieldClass"
        [class.pr-10]="showIcon"
        [ngClass]="invalid
          ? 'border-red-500 ring-1 ring-red-500/50'
          : 'border-black-border focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50'"
        (input)="onTextInput($any($event.target).value)"
        (click)="openPicker()"
        (blur)="onTextBlur()" />

      @if (showIcon) {
        <button type="button" tabindex="-1" [disabled]="disabled()" (click)="toggle()"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-gold-400 transition-colors disabled:opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      }

      @if (open()) {
        <div class="absolute z-50 left-0 w-72 bg-black-card border border-black-border rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-3 [color-scheme:dark]"
          [ngClass]="dropUp() ? 'bottom-full mb-2' : 'top-full mt-2'"
          (click)="$event.stopPropagation()">
          <!-- Header: month / year navigation -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <button type="button" (click)="prevMonth()"
              class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div class="flex items-center gap-1.5">
              <select (change)="viewMonth.set(+$any($event.target).value)"
                class="bg-black-main border border-black-border rounded-md px-2 py-1 text-xs text-white focus:border-gold-400 focus:outline-none">
                @for (m of months; track m.value) {
                  <option [value]="m.value" [selected]="m.value === viewMonth()">{{ m.label }}</option>
                }
              </select>
              <select (change)="viewYear.set(+$any($event.target).value)"
                class="bg-black-main border border-black-border rounded-md px-2 py-1 text-xs text-white focus:border-gold-400 focus:outline-none">
                @for (y of years; track y) {
                  <option [value]="y" [selected]="y === viewYear()">{{ y }}</option>
                }
              </select>
            </div>

            <button type="button" (click)="nextMonth()"
              class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Weekday labels -->
          <div class="grid grid-cols-7 gap-1 mb-1">
            @for (w of weekdays; track w) {
              <div class="text-center text-[10px] font-bold uppercase text-zinc-600">{{ w }}</div>
            }
          </div>

          <!-- Day grid -->
          <div class="grid grid-cols-7 gap-1">
            @for (cell of cells(); track $index) {
              @if (cell) {
                <button type="button" [disabled]="cell.disabled" (click)="selectDay(cell)"
                  class="h-8 w-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed"
                  [class.bg-gold-400]="cell.selected"
                  [class.text-black-main]="cell.selected"
                  [class.font-bold]="cell.selected"
                  [class.text-zinc-300]="!cell.selected"
                  [class.hover:bg-white/10]="!cell.selected && !cell.disabled"
                  [class.ring-1]="cell.today && !cell.selected"
                  [class.ring-gold-400/60]="cell.today && !cell.selected">
                  {{ cell.day }}
                </button>
              } @else {
                <div class="h-8 w-8"></div>
              }
            }
          </div>

          <!-- Footer actions -->
          <div class="flex items-center justify-between mt-3 pt-2 border-t border-black-border">
            <button type="button" (click)="clear()"
              class="text-xs font-bold text-zinc-400 hover:text-white transition-colors">Clear</button>
            <button type="button" (click)="selectToday()"
              class="text-xs font-bold text-gold-400 hover:text-gold-300 transition-colors">Today</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DatePickerComponent implements ControlValueAccessor {
  /** Earliest selectable date, as `yyyy-MM-dd`. */
  @Input() min?: string;
  /** Latest selectable date, as `yyyy-MM-dd`. */
  @Input() max?: string;
  @Input() placeholder = 'dd/mm/yyyy';
  /** Marks the field invalid (red border) — pass the control's invalid+touched state. */
  @Input() invalid = false;
  /** Show the built-in calendar icon button (hide it when the host already has one). */
  @Input() showIcon = true;
  /**
   * Tailwind classes for the text field layout/typography; override to fit a
   * specific layout. Border colour + focus/invalid ring are applied separately
   * (driven by `invalid`), so don't set a border colour here.
   */
  @Input() fieldClass =
    'w-full bg-white/5 border rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none transition-all [color-scheme:dark]';

  // Make the host focusable so form.util's focusFirstInvalid() can reach the field.
  @HostBinding('attr.tabindex') tabindex = '-1';
  @ViewChild('input') inputEl?: ElementRef<HTMLInputElement>;

  private elRef = inject(ElementRef);

  value = signal<string>(''); // canonical yyyy-MM-dd ('' = empty)
  text = signal<string>(''); // what the field shows / the user types
  open = signal(false);
  disabled = signal(false);
  /** Open the calendar above the field when there isn't room below (e.g. near the bottom of a scrollable modal). */
  dropUp = signal(false);

  private now = new Date();
  viewYear = signal<number>(this.now.getFullYear());
  viewMonth = signal<number>(this.now.getMonth()); // 0-11

  readonly weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ].map((label, value) => ({ label, value }));
  readonly years = Array.from({ length: this.now.getFullYear() + 10 - 1940 + 1 }, (_, i) => 1940 + i);

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ── ControlValueAccessor ────────────────────────────────────────────────
  writeValue(v: string): void {
    const iso = this.normalizeIso(v);
    this.value.set(iso);
    this.text.set(iso ? this.formatDisplay(iso) : '');
    if (iso) this.syncViewTo(iso);
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  // ── Calendar grid ───────────────────────────────────────────────────────
  cells = computed<(DayCell | null)[]>(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const startDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayIso = this.todayIso();
    const selected = this.value();

    const out: (DayCell | null)[] = [];
    for (let i = 0; i < startDow; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = this.toIso(y, m + 1, d);
      out.push({
        day: d,
        iso,
        disabled: this.isOutOfRange(iso),
        today: iso === todayIso,
        selected: iso === selected,
      });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  });

  // ── Field interactions ──────────────────────────────────────────────────
  openPicker(): void {
    if (this.disabled()) return;
    if (!this.open()) {
      this.syncViewTo(this.value() || this.todayIso());
      this.updateDropDirection();
      this.open.set(true);
    }
  }

  toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.open.set(false);
    } else {
      this.syncViewTo(this.value() || this.todayIso());
      this.updateDropDirection();
      this.open.set(true);
    }
    this.inputEl?.nativeElement.focus();
  }

  /** Decide whether the popup opens downward or flips up, based on viewport room. */
  private updateDropDirection(): void {
    const el = this.inputEl?.nativeElement;
    if (!el) { this.dropUp.set(false); return; }
    const rect = el.getBoundingClientRect();
    const POPUP_HEIGHT = 360; // approx. calendar height incl. padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Flip up only when there isn't enough room below but there is more above.
    this.dropUp.set(spaceBelow < POPUP_HEIGHT && spaceAbove > spaceBelow);
  }

  onTextInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, 8); // ddmmyyyy
    let masked = digits;
    if (digits.length >= 5) masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length >= 3) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    this.text.set(masked);

    const iso = this.parseDisplay(masked);
    if (iso && !this.isOutOfRange(iso)) {
      this.value.set(iso);
      this.onChange(iso);
      this.syncViewTo(iso);
    } else if (!masked) {
      this.value.set('');
      this.onChange('');
    }
  }

  onTextBlur(): void {
    this.onTouched();
    const raw = this.text().trim();
    if (!raw) {
      this.value.set('');
      this.onChange('');
      return;
    }
    const iso = this.parseDisplay(raw);
    if (iso && !this.isOutOfRange(iso)) {
      this.value.set(iso);
      this.text.set(this.formatDisplay(iso));
      this.onChange(iso);
    } else {
      // Invalid / out-of-range typing → revert to the last good value.
      this.text.set(this.value() ? this.formatDisplay(this.value()) : '');
    }
  }

  selectDay(cell: DayCell): void {
    if (cell.disabled) return;
    this.commit(cell.iso);
    this.open.set(false);
  }

  selectToday(): void {
    const iso = this.todayIso();
    if (this.isOutOfRange(iso)) return;
    this.commit(iso);
    this.open.set(false);
  }

  clear(): void {
    this.value.set('');
    this.text.set('');
    this.onChange('');
    this.onTouched();
    this.open.set(false);
  }

  prevMonth(): void {
    let m = this.viewMonth() - 1;
    let y = this.viewYear();
    if (m < 0) { m = 11; y--; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
  }

  nextMonth(): void {
    let m = this.viewMonth() + 1;
    let y = this.viewYear();
    if (m > 11) { m = 0; y++; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
  }

  // ── Host events ─────────────────────────────────────────────────────────
  @HostListener('focus')
  onHostFocus(): void {
    this.inputEl?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elRef.nativeElement.contains(event.target)) {
      this.open.set(false);
      this.onTouched();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private commit(iso: string): void {
    this.value.set(iso);
    this.text.set(this.formatDisplay(iso));
    this.onChange(iso);
    this.onTouched();
  }

  private syncViewTo(iso: string): void {
    const [y, m] = iso.split('-').map(Number);
    if (y && m) {
      this.viewYear.set(y);
      this.viewMonth.set(m - 1);
    }
  }

  private isOutOfRange(iso: string): boolean {
    if (this.min && iso < this.min) return true;
    if (this.max && iso > this.max) return true;
    return false;
  }

  private todayIso(): string {
    return this.toIso(this.now.getFullYear(), this.now.getMonth() + 1, this.now.getDate());
  }

  private toIso(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  private formatDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Parse a 'dd/mm/yyyy' (or 'd/m/yyyy') string → 'yyyy-MM-dd', or null if invalid. */
  private parseDisplay(str: string): string | null {
    const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const day = +m[1], month = +m[2], year = +m[3];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
    return this.toIso(year, month, day);
  }

  /** Accept 'yyyy-MM-dd' or any ISO/parseable date and normalize to 'yyyy-MM-dd'. */
  private normalizeIso(v: any): string {
    if (!v) return '';
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return this.toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
}
