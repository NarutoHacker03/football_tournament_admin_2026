import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-tournament-finance',
    standalone: true,
    // FormsModule kept for the prize-distribution array (ngModel); ReactiveForms for the validated income card.
    imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule],
    templateUrl: './tournament-finance.component.html'
})
export class TournamentFinanceComponent implements OnInit, OnChanges {
    @Input() data!: any;
    /** Base entry fee set in the Participation step — the single source of truth for the registration fee. */
    @Input() baseEntryFee?: number;
    @Output() formReady = new EventEmitter<FormGroup>();

    private fb = inject(FormBuilder);
    form!: FormGroup;

    ngOnInit() {
        if (!this.data.prizeDistribution) {
            this.data.prizeDistribution = [0, 0, 0];
        }
        this.buildForm();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['data'] && this.data) {
            if (!this.data.prizeDistribution) this.data.prizeDistribution = [0, 0, 0];
            this.buildForm();
        } else if (changes['baseEntryFee'] && this.form) {
            // Keep the (read-only) registration fee mirroring the Base Entry Fee.
            this.form.patchValue({ regFee: this.baseEntryFee ?? 0 });
        }
    }

    private buildForm() {
        if (!this.data) return;
        // The registration fee is sourced from the Base Entry Fee (Participation step); it is
        // displayed read-only here so it can't diverge from the single source of truth.
        const regFee = this.baseEntryFee ?? this.data.regFee ?? 0;
        this.form = this.fb.group({
            regFee: [regFee, [Validators.required, Validators.min(0)]],
            paymentMethod: [this.data.paymentMethod || 'bank'],
            paymentInfo: [this.data.paymentInfo || '', [Validators.maxLength(1000)]]
        });
        this.form.valueChanges.subscribe(val => Object.assign(this.data, val));
        this.formReady.emit(this.form);
    }
    
    getTotalDistribution(): number {
        if (!this.data.prizeDistribution) return 0;
        return this.data.prizeDistribution.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
    }

    /**
     * Budget left over after the per-place distribution. Allowed to go negative
     * so the template can flag an over-allocated pool (amber) instead of silently
     * capping — the prize fields stay freely editable.
     */
    getRemaining(): number {
        const total = Number(this.data.prizeMoney) || 0;
        return total - this.getTotalDistribution();
    }
}
