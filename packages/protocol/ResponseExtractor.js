// ============================================================
// 🔍 ResponseExtractor - 回應信封擷取與清理 (v9.2.1 MutationObserver 版)
// ============================================================
const { TIMINGS, LIMITS } = require('../../src/core/constants');

class ResponseExtractor {
    /**
     * 在瀏覽器內等待 AI 回應信封完成
     * (此函式會傳入 page.evaluate 在瀏覽器上下文中執行)
     *
     * @param {import('playwright').Page} page - Playwright 頁面實例
     * @param {string} selector - 回應氣泡的 CSS Selector
     * @param {string} startTag - 信封開始標籤
     * @param {string} endTag - 信封結束標籤
     * @param {string} baseline - 發送前的基準文字 (用於排除舊回應)
     * @returns {Promise<{status: string, text: string}>}
     */
    static async waitForResponse(page, selector, startTag, endTag, baseline) {
        const stableComplete = LIMITS.STABLE_THRESHOLD_COMPLETE;
        const stableThinking = LIMITS.STABLE_THRESHOLD_THINKING;
        const pollInterval = TIMINGS.POLL_INTERVAL;
        const timeout = TIMINGS.TIMEOUT;

        return page.evaluate(
            async ({ sel, sTag, eTag, oldText, _stableComplete, _stableThinking, _pollInterval, _timeout }) => {
                return new Promise((resolve) => {
                    let stableCount = 0;
                    let lastCheckText = "";
                    let resolved = false;

                    let observer = null;
                    let intervalId = null;
                    let timeoutId = null;
                    let debounceId = null;

                    const cleanup = () => {
                        if (observer) observer.disconnect();
                        if (intervalId) clearInterval(intervalId);
                        if (timeoutId) clearTimeout(timeoutId);
                        if (debounceId) clearTimeout(debounceId);
                    };

                    const complete = (result) => {
                        if (resolved) return;
                        resolved = true;
                        cleanup();
                        resolve(result);
                    };

                    const collectAttachments = (container) => {
                        const attachments = [];
                        if (!container) return attachments;

                        container.querySelectorAll('img').forEach((img) => {
                            if (img.src && img.src.startsWith('http')) {
                                if (img.src.toLowerCase().includes('.svg')) return;
                                attachments.push({ url: img.src, mimeType: 'image/png' });
                            }
                        });

                        container.querySelectorAll('a').forEach((a) => {
                            const href = a.href || "";
                            if (!href || !href.startsWith('http')) return;

                            const isDownload = a.hasAttribute('download');
                            const hasFileExt = /\.(pdf|docx|xlsx|txt|zip|md|js|py)$/i.test(href);
                            const isGoogleContent = href.includes('googleusercontent.com') || href.includes('blob:');

                            if (isDownload || hasFileExt || isGoogleContent) {
                                let mime = 'application/octet-stream';
                                if (href.endsWith('.pdf')) mime = 'application/pdf';
                                else if (href.endsWith('.md')) mime = 'text/markdown';
                                else if (href.endsWith('.txt')) mime = 'text/plain';
                                attachments.push({ url: href, mimeType: mime });
                            }
                        });

                        return attachments;
                    };

                    const getLatestContainer = () => {
                        const bubbles = document.querySelectorAll(sel);
                        if (bubbles.length === 0) return null;
                        const currentLastBubble = bubbles[bubbles.length - 1];
                        return currentLastBubble.closest('response-container') ||
                            currentLastBubble.closest('pending-request') ||
                            currentLastBubble.closest('.conversation-container') ||
                            currentLastBubble.closest('model-response') ||
                            currentLastBubble.closest('.markdown') ||
                            currentLastBubble.closest('.model-response-text') ||
                            currentLastBubble.parentElement ||
                            currentLastBubble;
                    };

                    const evaluateNow = () => {
                        if (resolved) return;
                        const container = getLatestContainer();
                        if (!container) return;

                        const rawText = container.innerText || "";
                        const startIndex = rawText.indexOf(sTag);
                        const endIndex = rawText.indexOf(eTag);
                        const attachments = collectAttachments(container);

                        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                            const content = rawText.substring(startIndex + sTag.length, endIndex).trim();
                            complete({ status: 'ENVELOPE_COMPLETE', text: content, attachments });
                            return;
                        }

                        if (rawText === lastCheckText) stableCount++;
                        else stableCount = 0;
                        lastCheckText = rawText;

                        if (startIndex !== -1) {
                            if (stableCount > _stableComplete) {
                                const content = rawText.substring(startIndex + sTag.length).trim();
                                complete({ status: 'ENVELOPE_TRUNCATED', text: content, attachments });
                            }
                            return;
                        }

                        if (rawText !== oldText && !rawText.includes('SYSTEM: Please WRAP')) {
                            if (stableCount > _stableThinking) {
                                complete({ status: 'FALLBACK_DIFF', text: rawText, attachments });
                            }
                        }
                    };

                    const scheduleEvaluate = () => {
                        if (resolved) return;
                        if (debounceId) clearTimeout(debounceId);
                        debounceId = setTimeout(evaluateNow, 40);
                    };

                    timeoutId = setTimeout(() => {
                        complete({ status: 'TIMEOUT', text: '', attachments: [] });
                    }, _timeout);

                    observer = new MutationObserver(scheduleEvaluate);
                    const observationRoot = document.body || document.documentElement;
                    observer.observe(observationRoot, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                    });

                    intervalId = setInterval(evaluateNow, _pollInterval);
                    evaluateNow();
                });
            },
            {
                sel: selector,
                sTag: startTag,
                eTag: endTag,
                oldText: baseline,
                _stableComplete: stableComplete,
                _stableThinking: stableThinking,
                _pollInterval: pollInterval,
                _timeout: timeout
            }
        );
    }

    /**
     * 清理回應文字中的信封標籤和系統雜訊
     * @param {string} rawText - 原始回應文字
     * @param {string} startTag - 信封開始標籤
     * @param {string} endTag - 信封結束標籤
     * @returns {string} 清理後的文字
     */
    static cleanResponse(rawText, startTag, endTag) {
        return rawText
            .replace(startTag, '')
            .replace(endTag, '')
            .replace(/\[SYSTEM: Please WRAP.*?\]/, '')
            .trim();
    }
}

module.exports = ResponseExtractor;
