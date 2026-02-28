/* ═══════════════════════════════════════════════════════════════
   LinkedIn Post Generator — app.js
   Supports: OpenAI (GPT-4o + DALL-E 3) | Anthropic (Claude 3.5)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Default Style Post ────────────────────────────────────────────
const DEFAULT_STYLE_POST = `For years, organizations treated modernization as a finish line: migrate the data center, upgrade the platform, rewrite the application, declare victory. But technology, markets, and customer expectations now evolve faster than any one-time transformation can keep up with.

The real shift is toward continuous modernization — where architecture, processes, and culture are designed to adapt by default.

AI automation is becoming a major accelerator here. Not because it replaces people, but because it removes the repetitive work that keeps teams stuck in maintenance mode: manual testing, ticket triage, incident response, environment provisioning, documentation, and more. When those burdens shrink, teams can focus on resilience, scalability, security, and innovation.

But tools alone don't create speed. Alignment to business outcomes does. The organizations moving fastest aren't the ones with the newest technology — they're the ones with clear priorities, empowered teams, strong governance, and leadership willing to fund long-term capability instead of short-term fixes.

Modernization succeeds when it becomes part of how the organization operates every day — not something that gets scheduled every five years.

Curious how others are embedding continuous modernization and AI automation into their operating model rather than treating it as another transformation program.`;

// ── State ────────────────────────────────────────────────────────
const state = {
    urlCount: 1,
    maxUrls: 2,
    generatedPost: '',
    generatedImageUrl: '',
    drafts: [],
    lastPrompts: { postSystem: '', postUser: '', image: '' },
    settings: {
        provider: 'openai',
        openaiKey: '',
        anthropicKey: '',
        tone: 'conversational',
        length: 2,
        useEmoji: true,
        useHashtags: true,
        showPrompts: false,
        stylePost: DEFAULT_STYLE_POST,
        roleContext: '',
    },
};

// ── DOM Refs ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
    tabs: document.querySelectorAll('.tab'),
    panels: document.querySelectorAll('.tab-content'),
    urlList: $('urlList'),
    addUrlBtn: $('addUrlBtn'),
    topic: $('topic'),
    roleContext: $('roleContext'),
    chkWebResearch: $('chkWebResearch'),
    chkInfographic: $('chkInfographic'),
    chkDraft: $('chkDraft'),
    infographicOpts: $('infographicOptions'),
    infographicTitle: $('infographicTitle'),
    generateBtn: $('generateBtn'),
    outputPanel: $('outputPanel'),
    postOutput: $('postOutput'),
    charCount: $('charCount'),
    copyBtn: $('copyBtn'),
    regenerateBtn: $('regenerateBtn'),
    infographicCard: $('infographicCard'),
    infographicCanvas: $('infographicCanvas'),
    downloadBtn: $('downloadBtn'),
    rethemeBtn: $('rethemeBtn'),
    regenerateInfographicBtn: $('regenerateInfographicBtn'),
    chkShowPrompts: $('chkShowPrompts'),
    promptsCard: $('promptsCard'),
    promptPostSystem: $('promptPostSystem'),
    promptPostUser: $('promptPostUser'),
    promptImage: $('promptImage'),
    draftBox: $('draftBox'),
    draftList: $('draftList'),
    // analyze
    analyzeBtn: $('analyzeBtn'),
    analyzeInput: $('analyzeInput'),
    analyzeResult: $('analyzeResult'),
    analyzeOutput: $('analyzeOutput'),
    // settings
    aiProvider: $('aiProvider'),
    openaiKeyGroup: $('openaiKeyGroup'),
    anthropicKeyGroup: $('anthropicKeyGroup'),
    openaiKey: $('openaiKey'),
    anthropicKey: $('anthropicKey'),
    toggleOpenaiKey: $('toggleOpenaiKey'),
    toggleAnthropicKey: $('toggleAnthropicKey'),
    writingTone: $('writingTone'),
    postLength: $('postLength'),
    postLengthLabel: $('postLengthLabel'),
    chkEmoji: $('chkEmoji'),
    chkHashtags: $('chkHashtags'),
    saveSettingsBtn: $('saveSettingsBtn'),
    saveFeedback: $('saveFeedback'),
    postTitle: $('postTitle'),
    stylePost: $('stylePost'),
    resetStylePostBtn: $('resetStylePostBtn'),
    // loading
    loadingOverlay: $('loadingOverlay'),
    loadingText: $('loadingText'),
    loadingSub: $('loadingSub'),
    toast: $('toast'),
};

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    bindEvents();
    renderDrafts();
    updateCharCount();
});

// ── Tab Navigation ────────────────────────────────────────────────
function bindEvents() {
    // Tabs
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // URL management
    els.addUrlBtn.addEventListener('click', addUrlRow);

    // Infographic checkbox toggle
    els.chkInfographic.addEventListener('change', () => {
        els.infographicOpts.style.display = els.chkInfographic.checked ? 'flex' : 'none';
    });

    // Generate Post
    els.generateBtn.addEventListener('click', handleGenerate);
    els.regenerateBtn.addEventListener('click', () => handleGenerate({ postOnly: true }));

    // Copy
    els.copyBtn.addEventListener('click', copyPost);

    // Download infographic
    els.downloadBtn.addEventListener('click', downloadInfographic);

    // Regenerate infographic only (keep current post)
    els.regenerateInfographicBtn.addEventListener('click', () => {
        if (state.generatedPost) regenerateInfographic();
    });

    // Retheme infographic — cycle through all themes
    els.rethemeBtn.addEventListener('click', () => {
        const current = document.querySelector('input[name="infoTheme"]:checked').value;
        const cycle = { shock: 'dark', dark: 'light', light: 'tech', tech: 'sign', sign: 'cylinder', cylinder: 'neon', neon: 'shock' };
        const next = cycle[current] || 'shock';
        document.querySelector(`input[name="infoTheme"][value="${next}"]`).checked = true;
        setActiveThemePill(next);
        if (state.generatedPost) regenerateInfographic();
    });

    // Theme pill clicks — use data-theme to avoid DOM traversal and label double-activation
    document.querySelectorAll('.theme-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = pill.dataset.theme;
            if (theme) {
                const radio = document.querySelector(`input[name="infoTheme"][value="${theme}"]`);
                if (radio) radio.checked = true;
                setActiveThemePill(theme);
                if (state.generatedPost) regenerateInfographic();
            }
        });
    });
    const defaultTheme = document.querySelector('input[name="infoTheme"]:checked');
    if (defaultTheme) setActiveThemePill(defaultTheme.value);

    // Auto-save role context on blur
    els.roleContext.addEventListener('blur', () => {
        state.settings.roleContext = els.roleContext.value.trim();
        localStorage.setItem('li_settings', JSON.stringify(state.settings));
    });

    // Post output char count
    els.postOutput.addEventListener('input', updateCharCount);

    // Analyze
    els.analyzeBtn.addEventListener('click', handleAnalyze);

    // Settings
    els.aiProvider.addEventListener('change', onProviderChange);
    els.toggleOpenaiKey.addEventListener('click', () => togglePasswordVisibility(els.openaiKey));
    els.toggleAnthropicKey.addEventListener('click', () => togglePasswordVisibility(els.anthropicKey));
    els.postLength.addEventListener('input', updateLengthLabel);
    els.saveSettingsBtn.addEventListener('click', saveSettings);
    els.resetStylePostBtn.addEventListener('click', () => {
        els.stylePost.value = DEFAULT_STYLE_POST;
    });
}

function setActiveThemePill(value) {
    document.querySelectorAll('.theme-pill').forEach(p => p.classList.remove('active'));
    const pill = document.querySelector(`.theme-pill[data-theme="${value}"]`);
    if (pill) pill.classList.add('active');
}

function switchTab(name) {
    els.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    els.panels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));
}

// ── URL Row Management ────────────────────────────────────────────
function addUrlRow() {
    if (state.urlCount >= state.maxUrls) {
        showToast('Maximum 2 article URLs allowed', 'error');
        return;
    }
    state.urlCount++;
    const row = document.createElement('div');
    row.className = 'url-row';
    row.id = `urlRow${state.urlCount - 1}`;
    row.innerHTML = `
    <input type="url" class="field-input url-input" placeholder="https://example.com/article" />
    <button class="btn-icon remove-url" title="Remove URL">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
    </button>`;
    row.querySelector('.remove-url').addEventListener('click', () => removeUrlRow(row));
    els.urlList.appendChild(row);

    if (state.urlCount >= state.maxUrls) els.addUrlBtn.style.opacity = '0.4';
}

function removeUrlRow(row) {
    row.remove();
    state.urlCount--;
    els.addUrlBtn.style.opacity = '1';
}

function getUrls() {
    return Array.from(els.urlList.querySelectorAll('.url-input'))
        .map(i => i.value.trim())
        .filter(Boolean);
}

// ── Article Fetching ──────────────────────────────────────────────
async function fetchArticleText(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        const data = await res.json();
        const html = data.contents || '';
        // Strip HTML tags, collapse whitespace, get first ~3000 chars
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000);
        return text || null;
    } catch {
        return null;
    }
}

// ── Post Generation ───────────────────────────────────────────────
async function handleGenerate({ postOnly = false } = {}) {
    const topic = els.topic.value.trim();
    const postTitle = els.postTitle.value.trim();
    const role = els.roleContext.value.trim();
    const urls = getUrls();

    if (!topic && urls.length === 0) {
        showToast('Please enter a topic or at least one article URL', 'error');
        return;
    }

    const key = getActiveApiKey();
    if (!key) {
        showToast('Please add your API key in the Settings tab', 'error');
        switchTab('settings');
        return;
    }

    showLoading('Generating your LinkedIn post…', 'Fetching articles and crafting content');

    try {
        // 1. Fetch articles
        let articleContext = '';
        if (urls.length > 0) {
            setLoadingSub('Fetching article content…');
            const texts = await Promise.all(urls.map(fetchArticleText));
            texts.forEach((text, i) => {
                if (text) articleContext += `\n\n--- Article ${i + 1} (${urls[i]}) ---\n${text}`;
                else articleContext += `\n\n--- Article ${i + 1} (${urls[i]}) ---\n[Could not fetch content — use topic/context only]`;
            });
        }

        // 2. Build prompt
        const lengthMap = { 1: '300–500', 2: '700–1000', 3: '1200–1500' };
        const charTarget = lengthMap[state.settings.length] || '700–1000';
        const toneMap = {
            professional: 'professional and authoritative',
            conversational: 'conversational and engaging',
            inspirational: 'inspirational and motivational',
            analytical: 'analytical and data-driven',
            storytelling: 'storytelling and personal',
        };
        const toneLabel = toneMap[state.settings.tone] || 'conversational and engaging';
        const emojiNote = state.settings.useEmoji ? 'Include relevant emojis to boost engagement.' : 'Do not use emojis.';
        const hashtagNote = state.settings.useHashtags ? 'End the post with 5–8 relevant hashtags on a new line.' : 'Do not include hashtags.';

        const styleExample = state.settings.stylePost || DEFAULT_STYLE_POST;

        const systemPrompt = `You are a skilled LinkedIn ghostwriter. Write posts that feel like they were written by a real practitioner, not generated by AI.

Rules:
- Output plain text only — no markdown symbols (no **, *, #, _, or similar)
- Open with a direct, curiosity-driving hook (1–2 lines max)
- Use short paragraphs (1–3 lines) with plenty of white space
- Follow a clear narrative arc: hook → insight → takeaway
- Target length: ${charTarget} characters
- Tone: ${toneLabel}
- ${emojiNote}
- ${hashtagNote}
- Do not use bullet lists unless they genuinely add value
- Write like a practitioner talking to a peer — direct, specific, opinionated. Use contractions. Trust the reader.
- Prefer concrete details over vague generalities. Say what actually happened or what you actually think.
- NEVER use: "game-changer", "revolutionary", "paradigm", "leverage", "utilize", "robust", "seamless", "cutting-edge", "innovative", "synergy", "ecosystem", "deep dive", "unpack", "needle", "moving forward", "at the end of the day", "the bottom line", "it's important to note", "in conclusion", "to summarize", "in today's", "fast-paced", "I wanted to share", "I'm excited", "I'm thrilled", "excited to announce", "delighted to share"

WRITING STYLE — study and closely replicate the voice, sentence rhythm, paragraph length, use of contrast, and structural patterns of this example post:
"""
${styleExample}
"""`;

        const userPrompt = `
${role ? `AUTHOR CONTEXT:\n${role}\n` : ''}
${postTitle ? `POST TITLE: Open the post with exactly this as the bold headline: "${toUnicodeBold(postTitle)}"\n` : ''}
${topic ? `TOPIC: ${topic}\n` : ''}
${articleContext ? `SOURCE ARTICLES:${articleContext}` : ''}

Write a compelling LinkedIn post based on the above. Output ONLY the post text—no preamble, no explanation.`.trim();

        state.lastPrompts.postSystem = systemPrompt;
        state.lastPrompts.postUser = userPrompt;

        // 3. Call AI
        setLoadingSub('Calling AI to write your post…');
        const postText = await callAI(systemPrompt, userPrompt);
        state.generatedPost = postText;

        // 4. Display
        els.postOutput.textContent = postText;
        updateCharCount();
        els.outputPanel.style.display = 'block';
        els.outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // 5. Save draft if checked
        if (els.chkDraft.checked) saveDraft(topic || 'Untitled', postText);

        // 6. Generate infographic if checked (skip when regenerating post only)
        if (!postOnly) {
            if (els.chkInfographic.checked) {
                const theme = document.querySelector('input[name="infoTheme"]:checked').value;
                await generateInfographic(postText, topic, role, theme);
            } else {
                els.infographicCard.style.display = 'none';
            }
        }

        refreshPromptsCard();
        showToast('Post generated successfully! ✨', 'success');

    } catch (err) {
        console.error(err);
        showToast(err.message || 'Generation failed. Check your API key.', 'error');
    } finally {
        hideLoading();
    }
}

// ── AI API Calls ──────────────────────────────────────────────────
function getActiveApiKey() {
    return state.settings.provider === 'openai'
        ? state.settings.openaiKey
        : state.settings.anthropicKey;
}

async function callAI(system, user) {
    if (state.settings.provider === 'openai') {
        return callOpenAI(system, user);
    } else {
        return callAnthropic(system, user);
    }
}

async function callOpenAI(system, user) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.settings.openaiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature: 0.78,
            max_tokens: 1000,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`OpenAI error: ${err?.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.choices[0].message.content.trim();
}

async function callAnthropic(system, user) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': state.settings.anthropicKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system,
            messages: [{ role: 'user', content: user }],
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Anthropic error: ${err?.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.content[0].text.trim();
}

// ── Infographic Generation (DALL-E 3) ─────────────────────────────
async function generateInfographic(postText, topic, role, theme) {
    // Require OpenAI key for image gen
    if (!state.settings.openaiKey) {
        showToast('An OpenAI API key is required to generate infographics (gpt-image-1)', 'error');
        els.infographicCard.style.display = 'none';
        return;
    }

    showLoading('Creating your infographic…', 'Using gpt-image-1 to design your visual');
    els.infographicCard.style.display = 'block';

    try {
        // First, extract 3 key takeaways from the post using OpenAI (infographic pipeline is OpenAI-only)
        const takeawaysRaw = await callOpenAI(
            'You extract exactly 3 short, punchy key takeaways from LinkedIn posts. Each takeaway must be under 12 words. Output ONLY a numbered list 1. 2. 3. — nothing else.',
            `Extract 3 key takeaways from this LinkedIn post:\n\n${postText}`
        );

        const takeaways = takeawaysRaw
            .split('\n')
            .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter(Boolean)
            .slice(0, 3);

        const customTitle = els.infographicTitle.value.trim();
        const postTitle = els.postTitle.value.trim();
        const headline = customTitle || postTitle || topic || takeaways[0] || 'Key Insights';
        const roleShort = role ? role.split('\n')[0].split('.')[0].trim().slice(0, 60) : '';
        const t1 = takeaways[0] || '';
        const t2 = takeaways[1] || '';
        const t3 = takeaways[2] || '';

        // Build the DALL-E prompt
        let imagePrompt;
        if (theme === 'shock') {
            imagePrompt = `A bold, dramatic, high-impact editorial infographic in portrait format styled after viral tech news media covers. Very dark near-black background (#0a0e1a) with a futuristic server room or technology environment subtly glowing in the backdrop — cinematic, atmospheric depth.

EXACT LAYOUT (top to bottom):
1. TOP HEADER: Full-width thin fiery orange accent bar, then large bold ALL-CAPS white headline: "${headline}" — with one or two key words rendered in a dramatic orange-to-red gradient (#FF4500 to #FF8C00) for shocking visual impact
2. HERO SECTION: The most visually dominant element on the page — a bold insight or key phrase from "${t1}" displayed in massive heavy typography, bright orange-to-gold gradient (#FF6B00 to #FFD700) with a dramatic glow radiating beneath it, centered, commanding ~25% of the vertical space
3. CHALLENGE TEXT: Bold white provocative question or challenge statement that makes the viewer question their current approach
4. VISUAL ELEMENT: A dramatic silhouetted business figure (seen from behind, no face) alongside an abstract futuristic AI or tech visual element, both glowing with orange-blue atmospheric light
5. THREE PANELS: Three equal-width info panels side by side, each with a glowing orange top border. Each panel has: a small glowing icon, bold white uppercase label, brief light-grey description. LEFT: "${t1}" | CENTER: "${t2}" | RIGHT: "${t3}"
6. CTA BANNER: Full-width bold banner with strong orange gradient (#CC3700 to #FF6B00), white bold ALL-CAPS call-to-action urging immediate action
7. FOOTER STRIP: Narrow dark footer with a white closing question

STYLE: High-energy, fire orange (#FF6B00) and gold (#FFD700) accents on very dark near-black background, dramatic neon-like glow effects, cinematic high-contrast lighting, bold aggressive typography hierarchy, no brand logos, no watermarks, no identifiable faces, print-ready`;
        } else if (theme === 'dark') {
            imagePrompt = `A dramatic, editorial-style infographic in portrait format. Dark, textured near-black background with subtle grunge and distressed texture — no flat color fills.

Layout from top to bottom:
- Large bold white display title at the very top: "${headline}" — followed by a thin gold or red horizontal accent line beneath it
- Atmospheric thematic illustration in the upper-middle section: cinematic, dramatic scene visually related to the topic, dark moody lighting, no human faces
- Three insight rows below the illustration, each row containing: a small relevant icon, a bold uppercase white label, and lighter-weight description text — content: "${t1}" / "${t2}" / "${t3}"
- A bold closing statement at the bottom with key words highlighted in gold (#D4A017)

Style: cinematic editorial magazine quality, gold (#D4A017) and white typography, mix of bold display and regular sans-serif weight, dramatic high-contrast lighting, no brand logos, no watermarks, no people, print-ready`;
        } else if (theme === 'sign') {
            imagePrompt = `A photorealistic minimalist typographic sign in portrait orientation, displayed in a clean modern interior. The sign is a large white rectangular panel with a thin white frame/border, mounted flat on a light warm-grey concrete or plaster wall. A subtle warm LED strip light glows softly from directly beneath the bottom edge of the sign.

The sign surface is pure clean white. Typography is the ONLY content — no icons, no images, no decorative elements except one horizontal rule:

TYPOGRAPHY LAYOUT (top to bottom):
- UPPER BLOCK: Large bold ALL-CAPS black sans-serif text, left-aligned with generous left margin, occupying roughly the top 65% of the sign interior. The text is the title/headline of the post, written in full and wrapping naturally across multiple lines at very large type size. Text reads: "${headline}"
- HORIZONTAL RULE: A single thin solid black horizontal line spanning ~85% of the sign width
- LOWER BLOCK: Same large bold ALL-CAPS black sans-serif style, left-aligned, a short punchy memorable closer derived from: "${t1}" — distilled to its most impactful 3–6 words

TYPOGRAPHY STYLE: Bold condensed or regular geometric sans-serif (Futura Bold / Helvetica Neue Bold / Montserrat ExtraBold style), pure black (#111111) on pure white (#FFFFFF), very large point size, generous line-height, slightly loose tracking.

PHOTO STYLE: Photorealistic interior photograph, very slight 3/4 perspective angle, soft natural light from the left, warm LED underglow at the sign base, clean minimal background wall. No people, no brand logos, no watermarks.`;
        } else if (theme === 'roadsign') {
            imagePrompt = `A photorealistic urban photograph shot from street level looking straight ahead down a wide multi-lane city road. An overpass or bridge spans the road in the middle distance. Mounted on the underside of the overpass, centered across all lanes, is a large rectangular LED highway message board — the kind used for traffic advisories. The sign has a thick black metal housing and border. The LED matrix display glows with bright amber/orange dot-matrix text on a pure black background.

SIGN TEXT: The sign displays exactly this message in large LED dot-matrix ALL-CAPS lettering, centered and word-wrapped naturally across 2–3 lines to fill the panel: "${headline}"

LED TEXT STYLE: Classic amber/orange dot-matrix LED characters, each letter formed by a grid of glowing dots, very bright against the black panel, slight glow/bloom effect around the letters. No other text, no icons.

SCENE: Urban city environment — multiple lanes of traffic (cars seen from behind, driving away from camera), city buildings flanking both sides of the road, overcast or dusk sky. Slight wide-angle perspective. Photorealistic, cinematic, no watermarks, no logos, no people's faces visible.`;
        } else if (theme === 'cylinder') {
            imagePrompt = `A photorealistic photograph of a large freestanding cylindrical column or advertising pillar in an open urban plaza or corporate courtyard. The cylinder is approximately 2 metres tall and wide, with a smooth white or off-white surface and polished chrome or brushed steel rims at the top and bottom edge. The column stands on a clean stone-paved plaza floor; glass office buildings or a modern corporate facade are softly visible in the background.

SIGN TEXT: The curved white face of the cylinder displays ONLY the following text, printed in very large bold ALL-CAPS black sans-serif typeface, centered both vertically and horizontally on the cylinder face: "${headline}"

TYPOGRAPHY: Extremely large, heavy black sans-serif (similar to Impact, Helvetica Neue Black, or Gotham Ultra). Text wraps naturally across multiple lines to fill the cylinder face. Characters are crisp black on pure white. No icons, no decorations, no secondary text — only the headline.

PHOTO STYLE: Photorealistic, slight low-angle shot looking up slightly at the column, soft overcast daylight, subtle ambient shadow on the paved ground. No people, no brand logos, no watermarks.`;
        } else if (theme === 'neon') {
            imagePrompt = `A photorealistic photograph of a square acrylic or clear glass sign panel hanging by a thin cord or rope from above, positioned in front of a large window at dusk or evening. Outside the window, blurred trees and street lights are softly visible. The panel is mounted with small chrome screws at each corner.

SIGN TEXT: The panel displays ONLY the following text as bright red neon tube lettering, bold ALL-CAPS, left-aligned with a generous left margin, wrapping naturally across multiple lines to fill the panel face: "${headline}"

NEON STYLE: Red neon glass tubes formed into each letter, glowing intensely with a warm red-pink light. Strong neon glow and bloom effect radiating from each letter onto the surrounding acrylic surface. The neon color is vivid red (#FF2244) with a soft pink halo. No other colors, no icons, no secondary text.

ATMOSPHERE: The neon text reflects and mirrors faintly on the window glass behind the panel. The room behind the camera is dark, making the neon the primary light source. Bokeh city/nature background through the window. Photorealistic, moody, cinematic. No people, no brand logos, no watermarks.`;
        } else if (theme === 'tech') {
            imagePrompt = `A high-tech futuristic infographic in portrait format. Deep midnight navy-black background (#050a15) layered with subtle glowing circuit board traces, hexagonal grid patterns, and faint scan-line overlays — like a holographic heads-up display projected in a dark operations center.

EXACT LAYOUT (top to bottom):
1. HEADER: A glowing electric-blue horizontal accent line, then the bold headline in large clean white sans-serif with electric blue (#00d4ff) highlights on key words: "${headline}"
2. VISUAL ELEMENT: A dramatic central graphic — a glowing data sphere or holographic ring structure radiating electric blue and cyan light, floating on the dark background, conveying scale and advanced technology
3. THREE PANELS: Three equal cards with glowing electric blue (#00d4ff) borders and very dark semi-transparent fills. Each card has a small glowing tech icon, bold white label, and concise grey description. LEFT: "${t1}" | CENTER: "${t2}" | RIGHT: "${t3}"
4. DATA STRIP: A full-width band with subtle digital texture, showing a key insight or metric in large bold white type
5. FOOTER: A thin glowing cyan line, then a closing statement in white

STYLE: Futuristic sci-fi editorial, electric blue (#00d4ff) and cyan (#00ffee) accents on near-black (#050a15), neon glow effects on panel borders and text highlights, crisp geometric sans-serif typography, circuit traces and hexagonal grid as background texture. No brand logos, no watermarks, no human faces, print-ready portrait format.`;
        } else {
            imagePrompt = `A clean, editorial-style infographic in portrait format. Light grey or off-white background with subtle paper or linen texture — professional editorial layout.

Layout from top to bottom:
- Large bold dark display title at the very top: "${headline}" — followed by a thin blue (#0077B5) horizontal accent line beneath it
- Clean thematic illustration in the upper-middle section: modern, professional graphic visually related to the topic, soft color treatment, no human faces
- Three insight rows below the illustration, each row containing: a small relevant icon, a bold uppercase dark label, and lighter-weight description text — content: "${t1}" / "${t2}" / "${t3}"
- A bold closing statement at the bottom with key words highlighted in blue (#0077B5)

Style: modern editorial magazine quality, blue (#0077B5) and dark grey typography on light textured background, clean sans-serif, subtle drop shadows, high readability, no brand logos, no watermarks, no people, print-ready`;
        }

        state.lastPrompts.image = imagePrompt;

        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.settings.openaiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: imagePrompt,
                n: 1,
                size: '1024x1536',
                quality: 'high',
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`DALL-E error: ${err?.error?.message || res.statusText}`);
        }

        const data = await res.json();
        const b64 = data.data[0].b64_json;
        const imageUrl = `data:image/png;base64,${b64}`;
        state.generatedImageUrl = imageUrl;

        // Render on canvas for display and download
        await renderImageOnCanvas(imageUrl);
        els.infographicCard.style.display = 'block';

        // Update infographic wrapper background to match theme
        const wrapper = els.infographicCard.querySelector('.infographic-wrapper');
        const bgMap = { shock: '#0a0e1a', dark: '#0d1b2a', light: '#f0f4f8', sign: '#e8e8e8', roadsign: '#2a1a1a', cylinder: '#d0d0d0', neon: '#0d0005', tech: '#050a15' };
        wrapper.style.background = bgMap[theme] || '#0d1b2a';
        refreshPromptsCard();

    } catch (err) {
        console.error('Infographic error:', err);
        showToast(`Infographic: ${err.message}`, 'error');
        els.infographicCard.style.display = 'none';
    } finally {
        hideLoading();
    }
}

async function renderImageOnCanvas(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = els.infographicCanvas;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve();
        };
        img.onerror = () => {
            // Fallback: just show img tag if canvas CORS fails
            const wrapper = els.infographicCard.querySelector('.infographic-wrapper');
            wrapper.innerHTML = `<img src="${url}" style="max-width:100%;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);" alt="Generated infographic" id="infographicFallbackImg" />`;
            resolve();
        };
        img.src = url;
    });
}

async function regenerateInfographic() {
    if (!state.generatedPost) return;
    const theme = document.querySelector('input[name="infoTheme"]:checked').value;
    const topic = els.topic.value.trim();
    const role = els.roleContext.value.trim();
    await generateInfographic(state.generatedPost, topic, role, theme);
}

function downloadInfographic() {
    const canvas = els.infographicCanvas;
    // Check if fallback img is shown
    const fallback = document.getElementById('infographicFallbackImg');
    if (fallback) {
        window.open(fallback.src, '_blank');
        return;
    }
    if (!canvas.width) {
        if (state.generatedImageUrl) window.open(state.generatedImageUrl, '_blank');
        return;
    }
    const link = document.createElement('a');
    link.download = `linkedin-infographic-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ── Analyze Writing ───────────────────────────────────────────────
async function handleAnalyze() {
    const post = els.analyzeInput.value.trim();
    if (!post) { showToast('Please paste a post to analyze', 'error'); return; }

    const key = getActiveApiKey();
    if (!key) { showToast('Please add your API key in Settings', 'error'); switchTab('settings'); return; }

    showLoading('Analyzing your post…', 'Evaluating engagement potential');

    try {
        const system = `You are a LinkedIn content strategist. You analyze posts and give structured, actionable feedback.`;
        const user = `Analyze this LinkedIn post and respond in the following exact format:

ENGAGEMENT SCORE: [number 1-100]/100
HOOK STRENGTH: [Weak/Moderate/Strong/Excellent]
READABILITY: [Poor/Fair/Good/Excellent]

WHAT'S WORKING:
- [point 1]
- [point 2]
- [point 3]

IMPROVEMENTS:
- [specific change 1]
- [specific change 2]
- [specific change 3]

REVISED HOOK:
[Write a better opening line for this post]

---
Post to analyze:
"""
${post}
"""`;

        const result = await callAI(system, user);
        renderAnalysis(result);
        els.analyzeResult.style.display = 'block';
        showToast('Analysis complete!', 'success');

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderAnalysis(text) {
    // Parse score for the bar
    const scoreMatch = text.match(/ENGAGEMENT SCORE:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    let html = '';

    if (score !== null) {
        const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
        html += `
      <h3>📊 Engagement Score: ${score}/100</h3>
      <div class="score-bar-container">
        <div class="score-bar" style="width:${score}%;background:${color}"></div>
      </div>`;
    }

    // Format remaining lines
    const remaining = text
        .replace(/ENGAGEMENT SCORE:.*\n?/i, '')
        .replace(/HOOK STRENGTH:(.*)/i, '<h3>🎣 Hook Strength:$1</h3>')
        .replace(/READABILITY:(.*)/i, '<h3>📖 Readability:$1</h3>')
        .replace(/WHAT'S WORKING:/i, '<h3>✅ What\'s Working</h3><ul class="analysis-list">')
        .replace(/IMPROVEMENTS:/i, '</ul><h3>🎯 Improvements</h3><ul class="analysis-list">')
        .replace(/REVISED HOOK:/i, '</ul><h3>✏️ Revised Hook</h3><blockquote class="revised-hook">')
        .replace(/^- (.+)/gm, '<li>$1</li>')
        .replace(/---[\s\S]*/, '') // remove post quote section
        + '</blockquote>';

    els.analyzeOutput.innerHTML = html + remaining;
}

// ── Unicode Bold ──────────────────────────────────────────────────
function toUnicodeBold(str) {
    return str.replace(/[A-Za-z0-9]/g, ch => {
        const code = ch.charCodeAt(0);
        if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D400 + code - 65); // A–Z
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + code - 97); // a–z
        if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7CE + code - 48); // 0–9
        return ch;
    });
}

// ── Copy Post ─────────────────────────────────────────────────────
function copyPost() {
    const text = els.postOutput.innerText || els.postOutput.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
        els.copyBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Copied!`;
        setTimeout(() => {
            els.copyBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg> Copy`;
        }, 2000);
    });
}

function updateCharCount() {
    const len = (els.postOutput.innerText || '').length;
    els.charCount.textContent = `${len.toLocaleString()} characters`;
    els.charCount.style.color = len > 3000 ? '#ef4444' : '#5a7080';
}

// ── Drafts ────────────────────────────────────────────────────────
function saveDraft(topic, text) {
    const draft = { id: Date.now(), topic, text, date: new Date().toLocaleDateString() };
    state.drafts.unshift(draft);
    if (state.drafts.length > 10) state.drafts.pop();
    localStorage.setItem('li_drafts', JSON.stringify(state.drafts));
    renderDrafts();
}

function renderDrafts() {
    state.drafts = JSON.parse(localStorage.getItem('li_drafts') || '[]');
    if (state.drafts.length === 0) { els.draftBox.style.display = 'none'; return; }
    els.draftBox.style.display = 'block';
    els.draftList.innerHTML = state.drafts.map(d => `
    <div class="draft-item" data-id="${d.id}">
      <div class="draft-meta">${d.date} · ${d.topic}</div>
      ${d.text.slice(0, 100)}…
    </div>`).join('');
    els.draftList.querySelectorAll('.draft-item').forEach(item => {
        item.addEventListener('click', () => {
            const draft = state.drafts.find(d => d.id === +item.dataset.id);
            if (!draft) return;
            els.postOutput.textContent = draft.text;
            state.generatedPost = draft.text;
            els.outputPanel.style.display = 'block';
            updateCharCount();
            switchTab('generate');
            showToast('Draft loaded!');
        });
    });
}

// ── Settings ──────────────────────────────────────────────────────
function loadSettings() {
    const saved = JSON.parse(localStorage.getItem('li_settings') || '{}');
    state.settings = { ...state.settings, ...saved };

    els.aiProvider.value = state.settings.provider;
    els.openaiKey.value = state.settings.openaiKey;
    els.anthropicKey.value = state.settings.anthropicKey;
    els.writingTone.value = state.settings.tone;
    els.postLength.value = state.settings.length;
    els.chkEmoji.checked = state.settings.useEmoji;
    els.chkHashtags.checked = state.settings.useHashtags;
    els.chkShowPrompts.checked = state.settings.showPrompts;
    els.stylePost.value = state.settings.stylePost || DEFAULT_STYLE_POST;
    els.roleContext.value = state.settings.roleContext || '';

    onProviderChange();
    updateLengthLabel();

    // Set range gradient
    updateRangeGradient(els.postLength);
}

function saveSettings() {
    state.settings.provider = els.aiProvider.value;
    state.settings.openaiKey = els.openaiKey.value.trim();
    state.settings.anthropicKey = els.anthropicKey.value.trim();
    state.settings.tone = els.writingTone.value;
    state.settings.length = +els.postLength.value;
    state.settings.useEmoji = els.chkEmoji.checked;
    state.settings.useHashtags = els.chkHashtags.checked;
    state.settings.showPrompts = els.chkShowPrompts.checked;
    state.settings.stylePost = els.stylePost.value.trim() || DEFAULT_STYLE_POST;
    state.settings.roleContext = els.roleContext.value.trim();

    localStorage.setItem('li_settings', JSON.stringify(state.settings));

    els.saveFeedback.style.display = 'block';
    setTimeout(() => els.saveFeedback.style.display = 'none', 2500);
    showToast('Settings saved!', 'success');
}

function onProviderChange() {
    const val = els.aiProvider.value;
    const isAnthropic = val === 'anthropic';

    // Anthropic: show both fields (Anthropic for text, OpenAI for images)
    // OpenAI: show only OpenAI
    els.anthropicKeyGroup.style.display = isAnthropic ? 'flex' : 'none';
    els.openaiKeyGroup.style.display = 'flex';

    const openaiLabel = els.openaiKeyGroup.querySelector('.field-label');
    if (isAnthropic) {
        openaiLabel.innerHTML = 'OpenAI API Key <span class="label-hint">(required for infographics)</span>';
    } else {
        openaiLabel.textContent = 'OpenAI API Key';
    }
}

function updateLengthLabel() {
    const labels = { 1: 'Short (300–500 chars)', 2: 'Medium (700–1000 chars)', 3: 'Long (1200–1500 chars)' };
    els.postLengthLabel.textContent = labels[els.postLength.value] || labels[2];
    updateRangeGradient(els.postLength);
}

function updateRangeGradient(input) {
    const min = +input.min, max = +input.max, val = +input.value;
    const pct = ((val - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, var(--li-blue) 0%, var(--li-blue) ${pct}%, var(--border) ${pct}%)`;
}

function togglePasswordVisibility(input) {
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ── Prompts Card ──────────────────────────────────────────────────
function refreshPromptsCard() {
    if (!els.chkShowPrompts.checked) {
        els.promptsCard.style.display = 'none';
        return;
    }
    els.promptPostSystem.value = state.lastPrompts.postSystem;
    els.promptPostUser.value = state.lastPrompts.postUser;
    els.promptImage.value = state.lastPrompts.image;
    els.promptsCard.style.display = 'block';
}

// ── Loading ───────────────────────────────────────────────────────
function showLoading(text, sub) {
    els.loadingText.textContent = text || 'Working…';
    els.loadingSub.textContent = sub || '';
    els.loadingOverlay.style.display = 'flex';
    els.generateBtn.disabled = true;
}

function setLoadingSub(sub) {
    els.loadingSub.textContent = sub;
}

function hideLoading() {
    els.loadingOverlay.style.display = 'none';
    els.generateBtn.disabled = false;
}

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    els.toast.textContent = msg;
    els.toast.className = `toast show${type ? ' ' + type : ''}`;
    toastTimer = setTimeout(() => els.toast.className = 'toast', 3500);
}
