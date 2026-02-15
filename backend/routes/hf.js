const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');

// ===============================
// CONFIG (Updated for Better Quality/Speed)
// ===============================
const HF_API_KEY = process.env.HF_API_KEY || "";

// TEXT MODELS (Instruction Tuned)
// Zephyr is very fast and conversational. Mistral is the robust fallback.
const TEXT_MODELS = [
    "HuggingFaceH4/zephyr-7b-beta",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "openai/gpt-oss-120b"
];

// IMAGE MODELS
// FLUX.1 for ultra-realistic quality, SDXL as fallback
const IMAGE_MODELS = [
    // Router-compatible, widely available text-to-image models
    "black-forest-labs/FLUX.1-dev",     // Best realism and quality
    "black-forest-labs/FLUX.1-schnell",  // Faster FLUX variant
    "stabilityai/stable-diffusion-xl-base-1.0"
];

// ===============================
// HUGGINGFACE WRAPPER
// ===============================
async function hfRequest(url, payload, opts = {}) {
    if (!HF_API_KEY) throw new Error("HF_API_KEY missing");

    const config = {
        headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            Accept: opts.accept || "application/json",
        },
        responseType: opts.responseType || "json",
        timeout: opts.timeout || 45000 // 45s timeout
    };

    try {
        return await axios.post(url, payload, config);
    } catch (err) {
        // Extract useful error message
        const status = err?.response?.status;
        const data = err?.response?.data;
        
        // If image request fails, data might be a Buffer, try to parse JSON error
        let msg = err.message;
        if (Buffer.isBuffer(data)) {
            try { msg = JSON.parse(data.toString()).error; } catch(e){}
        } else if (data?.error) {
            msg = data.error;
        }

        const e = new Error(`HF Error ${status}: ${msg}`);
        e.status = status;
        throw e;
    }
}

// ===============================
// TEXT GENERATION
// ===============================
router.post('/text', auth, async (req, res) => {
    let prompt = (req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ message: "Prompt required" });

    // Fallback when key is missing: return a simple, safe reply
    if (!HF_API_KEY) {
        try {
            const reply = basicTextReply(prompt);
            return res.json({ text: reply, model: 'fallback/local' });
        } catch (e) {
            return res.status(503).json({ message: 'AI disabled (no HF_API_KEY)', error: e.message });
        }
    }

    // Format prompt for instruction models to get better results
    // Only wrap if it doesn't look like it's already wrapped
    if (!prompt.includes("[INST]")) {
        prompt = `<|system|>\nYou are a helpful assistant.<|end|>\n<|user|>\n${prompt}<|end|>\n<|assistant|>`;
    }

    const maxTokens = Math.min(parseInt(req.body.maxTokens || 256), 1024);
    const temperature = parseFloat(req.body.temperature || 0.7);

    let lastError = null;

    // Loop through defined models (OpenAI-compatible Chat Completions on Router)
    for (const model of TEXT_MODELS) {
        try {
            console.log(`Trying text model: ${model}...`);
            const url = `https://router.huggingface.co/v1/chat/completions`;

            const response = await hfRequest(url, {
                model,
                messages: [ { role: 'user', content: prompt } ],
                max_tokens: maxTokens,
                temperature
            });

            const choice = (response.data?.choices || [])[0];
            const text = choice?.message?.content || choice?.text || '';
            if (text && text.trim()) {
                return res.json({ text: text.trim(), model });
            }
        } catch (err) {
            console.warn(`Failed ${model}: ${err.message}`);
            lastError = err;
            // Continue to next model
        }
    }

    // If loop finishes with no success
    return res.status(503).json({
        message: "All text models failed or are loading.",
        error: lastError ? lastError.message : "Unknown error"
    });
});

// ===============================
// IMAGE GENERATION
// ===============================
router.post('/image', auth, async (req, res) => {
    const prompt = (req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ message: "Prompt required" });

    console.log('Image generation request:', { prompt: prompt.substring(0, 100), hasKey: !!HF_API_KEY });

    // Always try Pollinations first - it's more reliable and free
    try {
        const sizeParam = req.body.size || '1024x680';
        const [width, height] = sizeParam.split('x').map(n => parseInt(n) || 1024);
        const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true`;
        console.log('Pollinations URL:', pollUrl);
        
        const r = await axios.get(pollUrl, { 
            responseType: 'arraybuffer', 
            timeout: 90000,
            headers: {
                'User-Agent': 'SocioSphere/1.0'
            }
        });
        
        const mime = r.headers['content-type'] || 'image/jpeg';
        const base64 = Buffer.from(r.data).toString('base64');
        console.log('Pollinations success, size:', r.data.length, 'bytes');
        return res.json({ image: `data:${mime};base64,${base64}`, model: 'pollinations-flux' });
    } catch (pollErr) {
        console.error('Pollinations failed:', pollErr.message);
    }

    // Fallback to HuggingFace if API key available
    if (!HF_API_KEY) {
        console.error('No HF_API_KEY and Pollinations failed');
        return res.status(503).json({ message: "Image generation unavailable", error: "Service temporarily down" });
    }

    let lastError = null;

    for (const model of IMAGE_MODELS) {
        try {
            console.log(`Trying image model: ${model}...`);
            const url = `https://router.huggingface.co/v1/images/generations`;

            const response = await hfRequest(url, {
                model,
                prompt,
                size: req.body.size || '1024x680',
                quality: req.body.quality || 'hd',
                steps: 50
            });

            const dataArr = response.data?.data || [];
            const b64 = dataArr[0]?.b64_json || null;
            if (b64) {
                console.log('HuggingFace success with model:', model);
                return res.json({ image: `data:image/png;base64,${b64}`, model });
            }
        } catch (err) {
            console.warn(`Failed ${model}: ${err.message}`);
            lastError = err;
        }
    }

    console.error('All image generation methods failed');
    return res.status(503).json({
        message: "All image models failed or are loading.",
        error: lastError ? lastError.message : "Unknown error"
    });
});

// ===============================
// FALLBACK HELPERS
// ===============================
function basicTextReply(prompt) {
    // Extract simple context if provided in our wrapping format
    let clean = prompt.replace(/<\|[^>]+\|>/g, '').replace(/\s+/g, ' ').trim();
    // If the prompt contains Author and Post lines, try to respond briefly
    const postMatch = clean.match(/Post:\s*([^]+)$/i);
    const post = postMatch ? postMatch[1].trim() : clean;
    let base = 'Thanks for sharing!';
    if (post) {
        const lower = post.toLowerCase();
        if (lower.includes('check out')) base = 'Sounds interesting — thanks for the link!';
        else if (lower.includes('help')) base = 'Happy to help—what part should we focus on?';
        else if (lower.includes('hi') || lower.includes('hello')) base = 'Hi! Looks great.';
        else if (lower.length > 0) base = 'Nice update—appreciate the details!';
    }
    // Cap at 140 chars
    return base.slice(0, 140);
}

module.exports = router;
