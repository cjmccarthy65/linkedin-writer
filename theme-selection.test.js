/**
 * Theme selection tests for infographic theme pills.
 *
 * These tests mirror the logic in app.js exactly:
 *   - setActiveThemePill()          (app.js:179)
 *   - pill click handler            (app.js:148)
 *   - retheme button click handler  (app.js:138)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Themes ────────────────────────────────────────────────────
const ALL_THEMES = ['shock', 'dark', 'light', 'sign', 'roadsign', 'cylinder', 'neon'];

// Cycle used by the retheme button (mirrors app.js:140)
const CYCLE = { shock: 'dark', dark: 'light', light: 'sign', sign: 'cylinder', cylinder: 'neon', neon: 'shock' };

// ── DOM fixture ───────────────────────────────────────────────
function buildDOM() {
    document.body.innerHTML = `
        <div class="theme-toggle">
            ${ALL_THEMES.map((t, i) => `
                <label class="theme-option ${t}-option">
                    <input type="radio" name="infoTheme" value="${t}" ${i === 0 ? 'checked' : ''} />
                    <span class="theme-pill" data-theme="${t}">${t}</span>
                </label>
            `).join('')}
        </div>
        <button id="rethemeBtn">Switch Theme</button>
    `;
}

// ── Logic mirrored from app.js ────────────────────────────────

function setActiveThemePill(value) {
    document.querySelectorAll('.theme-pill').forEach(p => p.classList.remove('active'));
    const pill = document.querySelector(`.theme-pill[data-theme="${value}"]`);
    if (pill) pill.classList.add('active');
}

function bindPillClicks(state, regenerateFn) {
    document.querySelectorAll('.theme-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = pill.dataset.theme;
            if (theme) {
                const radio = document.querySelector(`input[name="infoTheme"][value="${theme}"]`);
                if (radio) radio.checked = true;
                setActiveThemePill(theme);
                if (state.generatedPost) regenerateFn();
            }
        });
    });
}

function bindRethemeButton(state, regenerateFn) {
    document.getElementById('rethemeBtn').addEventListener('click', () => {
        const current = document.querySelector('input[name="infoTheme"]:checked').value;
        const next = CYCLE[current] || 'shock';
        document.querySelector(`input[name="infoTheme"][value="${next}"]`).checked = true;
        setActiveThemePill(next);
        if (state.generatedPost) regenerateFn();
    });
}

// ── Tests ─────────────────────────────────────────────────────

describe('setActiveThemePill', () => {
    beforeEach(buildDOM);

    it('adds .active to the correct pill', () => {
        setActiveThemePill('dark');
        expect(document.querySelector('.theme-pill[data-theme="dark"]').classList.contains('active')).toBe(true);
    });

    it('removes .active from all other pills', () => {
        setActiveThemePill('shock'); // set first
        setActiveThemePill('neon');  // switch

        const otherActive = ALL_THEMES.filter(t => t !== 'neon').filter(t =>
            document.querySelector(`.theme-pill[data-theme="${t}"]`).classList.contains('active')
        );
        expect(otherActive).toHaveLength(0);
    });

    it('removes all active classes when given an unknown value', () => {
        setActiveThemePill('shock');
        setActiveThemePill('does-not-exist');
        const anyActive = ALL_THEMES.filter(t =>
            document.querySelector(`.theme-pill[data-theme="${t}"]`).classList.contains('active')
        );
        expect(anyActive).toHaveLength(0);
    });
});

describe('Pill click handler', () => {
    beforeEach(buildDOM);

    it('checks the radio for the clicked pill', () => {
        const state = { generatedPost: '' };
        bindPillClicks(state, vi.fn());

        document.querySelector('.theme-pill[data-theme="cylinder"]').click();
        expect(document.querySelector('input[name="infoTheme"][value="cylinder"]').checked).toBe(true);
    });

    it('adds .active to the clicked pill', () => {
        const state = { generatedPost: '' };
        bindPillClicks(state, vi.fn());

        document.querySelector('.theme-pill[data-theme="neon"]').click();
        expect(document.querySelector('.theme-pill[data-theme="neon"]').classList.contains('active')).toBe(true);
    });

    it('calls regenerate when state.generatedPost is set', () => {
        const state = { generatedPost: 'some post content' };
        const regenerate = vi.fn();
        bindPillClicks(state, regenerate);

        document.querySelector('.theme-pill[data-theme="sign"]').click();
        expect(regenerate).toHaveBeenCalledOnce();
    });

    it('does NOT call regenerate when state.generatedPost is empty', () => {
        const state = { generatedPost: '' };
        const regenerate = vi.fn();
        bindPillClicks(state, regenerate);

        document.querySelector('.theme-pill[data-theme="sign"]').click();
        expect(regenerate).not.toHaveBeenCalled();
    });
});

describe('Retheme button cycle', () => {
    beforeEach(buildDOM);

    it('cycles through all 6 themes in order and wraps back to shock', () => {
        const state = { generatedPost: '' };
        bindRethemeButton(state, vi.fn());

        const btn = document.getElementById('rethemeBtn');
        const expected = ['dark', 'light', 'sign', 'cylinder', 'neon', 'shock'];

        for (const theme of expected) {
            btn.click();
            const checked = document.querySelector('input[name="infoTheme"]:checked').value;
            expect(checked).toBe(theme);
        }
    });

    it('calls regenerate on cycle when state.generatedPost is set', () => {
        const state = { generatedPost: 'post' };
        const regenerate = vi.fn();
        bindRethemeButton(state, regenerate);

        document.getElementById('rethemeBtn').click();
        expect(regenerate).toHaveBeenCalledOnce();
    });

    it('does NOT call regenerate on cycle when state.generatedPost is empty', () => {
        const state = { generatedPost: '' };
        const regenerate = vi.fn();
        bindRethemeButton(state, regenerate);

        document.getElementById('rethemeBtn').click();
        expect(regenerate).not.toHaveBeenCalled();
    });
});

describe('DOM completeness', () => {
    beforeEach(buildDOM);

    it('has a pill for every theme', () => {
        ALL_THEMES.forEach(t => {
            expect(document.querySelector(`.theme-pill[data-theme="${t}"]`)).not.toBeNull();
        });
    });

    it('has a radio input for every theme', () => {
        ALL_THEMES.forEach(t => {
            expect(document.querySelector(`input[name="infoTheme"][value="${t}"]`)).not.toBeNull();
        });
    });
});
