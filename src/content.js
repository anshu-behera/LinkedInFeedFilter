const SIMILARITY_THRESHOLD = 0.5;
const MAX_TEXT_LENGTH = 1800;

// --- Blur / Unblur ---

function blurPost(post, similarity) {
    if (post.dataset.liffBlurred === "true") return;
    post.dataset.liffBlurred = "true";

    if (window.getComputedStyle(post).position === "static") {
        post.style.position = "relative";
    }

    let contentLayer = post.querySelector(":scope > .liff-content-layer");
    if (!contentLayer) {
        contentLayer = document.createElement("div");
        contentLayer.className = "liff-content-layer";
        while (post.firstChild) {
            contentLayer.appendChild(post.firstChild);
        }
        post.appendChild(contentLayer);
    }

    contentLayer.style.filter = "blur(10px)";
    contentLayer.style.transition = "filter 180ms ease";

    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "liff-reveal-btn";
    reveal.title = `Show post (${similarity.toFixed(2)})`;
    reveal.setAttribute("aria-label", `Show post (${similarity.toFixed(2)})`);
    reveal.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" fill="none" stroke="#6b7280" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="#6b7280" stroke-width="2"/>
        </svg>
    `;
    reveal.style.cssText = [
        "position:absolute", "top:50%", "left:50%", "transform:translate(-50%,-50%)",
        "z-index:9999", "width:46px", "height:46px", "border-radius:9999px",
        "border:1px solid #666", "background:rgba(255,255,255,0.9)", "cursor:pointer"
    ].join(";");

    reveal.addEventListener("click", (e) => {
        e.stopPropagation();
        unblurPost(post);
    });

    post.appendChild(reveal);
}

function unblurPost(post) {
    const contentLayer = post.querySelector(":scope > .liff-content-layer");
    if (contentLayer) contentLayer.style.filter = "none";
    post.dataset.liffBlurred = "false";
    post.querySelector(":scope > .liff-reveal-btn")?.remove();
}

// --- Flag button ---

function injectFlagButton(post) {
    if (post.querySelector(".liff-flag-btn")) return;
    const menuBtn = post.querySelector('button:has(svg#overflow-web-ios-small)');
    if (!menuBtn) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "liff-flag-btn";
    btn.title = "Hide this post";
    btn.setAttribute("aria-label", "Hide this post");
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    `;
    btn.style.cssText = [
        "background:none", "border:none", "cursor:pointer", "padding:4px",
        "color:#666", "display:inline-flex", "align-items:center",
        "border-radius:4px", "vertical-align:middle", "opacity:0.7"
    ].join(";");

    btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; btn.style.background = "rgba(0,0,0,0.08)"; });
    btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.7"; btn.style.background = "none"; });

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const textEl = post.querySelector('[data-testid="expandable-text-box"]');
        const postText = (textEl?.innerText || "").trim().slice(0, MAX_TEXT_LENGTH);
        blurPost(post, 1.0);
        showToast(post, postText);
    });

    menuBtn.parentElement.insertBefore(btn, menuBtn);
}

// --- Toast ---

let activeToast = null;
let toastTimer = null;
let storeTimer = null;

function dismissToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (activeToast) { activeToast.remove(); activeToast = null; }
}

function cancelStoreTimer() {
    if (storeTimer) { clearTimeout(storeTimer); storeTimer = null; }
}

function showToast(post, postText) {
    dismissToast();

    const toast = document.createElement("div");
    toast.style.cssText = [
        "position:fixed", "bottom:24px", "left:50%", "transform:translateX(-50%)",
        "background:#1d1d1d", "color:#fff", "padding:10px 16px", "border-radius:8px",
        "display:flex", "align-items:center", "gap:10px", "z-index:999999",
        "font-size:14px", "font-family:sans-serif", "box-shadow:0 4px 12px rgba(0,0,0,0.4)",
        "white-space:nowrap"
    ].join(";");

    const label = document.createElement("span");
    label.textContent = "Post hidden.";

    const undoBtn = document.createElement("button");
    undoBtn.textContent = "Undo";
    undoBtn.style.cssText = "background:none;border:none;color:#7eb3ff;cursor:pointer;font-size:14px;padding:0;font-family:inherit;font-weight:600";
    undoBtn.addEventListener("click", () => {
        cancelStoreTimer();
        unblurPost(post);
        dismissToast();
    });

    const sep = document.createElement("span");
    sep.textContent = "·";
    sep.style.opacity = "0.4";

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add to Topic";
    addBtn.style.cssText = "background:none;border:none;color:#7eb3ff;cursor:pointer;font-size:14px;padding:0;font-family:inherit;font-weight:600";
    addBtn.addEventListener("click", () => {
        cancelStoreTimer();
        dismissToast();
        showTopicDialog(post, postText);
    });

    toast.appendChild(label);
    toast.appendChild(undoBtn);
    toast.appendChild(sep);
    toast.appendChild(addBtn);
    document.body.appendChild(toast);
    activeToast = toast;

    toastTimer = setTimeout(dismissToast, 5000);
    cancelStoreTimer();
    storeTimer = setTimeout(() => {
        chrome.runtime.sendMessage({ type: "add-post-without-topic", text: postText });
        storeTimer = null;
    }, 10000);
}

// --- Topic dialog ---

async function showTopicDialog(post, postText) {
    document.getElementById("liff-dialog-overlay")?.remove();

    const response = await chrome.runtime.sendMessage({ type: "get-topics" });
    const existingTopics = response?.topics ?? [];

    const overlay = document.createElement("div");
    overlay.id = "liff-dialog-overlay";
    overlay.style.cssText = [
        "position:fixed", "inset:0", "background:rgba(0,0,0,0.5)",
        "z-index:1000000", "display:flex", "align-items:center", "justify-content:center"
    ].join(";");

    const dialog = document.createElement("div");
    dialog.style.cssText = [
        "background:#fff", "border-radius:10px", "padding:20px",
        "width:360px", "max-height:80vh", "overflow-y:auto",
        "font-family:sans-serif", "box-shadow:0 8px 32px rgba(0,0,0,0.3)"
    ].join(";");

    const title = document.createElement("h3");
    title.textContent = "Add post to topic";
    title.style.cssText = "margin:0 0 14px;font-size:16px;color:#1d1d1d;font-weight:600;";
    dialog.appendChild(title);

    // Checkbox list
    const checkboxes = [];

    if (existingTopics.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No topics yet. Add one below.";
        empty.style.cssText = "color:#999;font-size:13px;margin:0 0 12px;";
        dialog.appendChild(empty);
    } else {
        for (const topic of existingTopics) {
            const label = document.createElement("label");
            label.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:14px;color:#1d1d1d;";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = topic.name;
            const countNote = topic.exampleCount > 0
                ? ` (${topic.exampleCount} example${topic.exampleCount === 1 ? "" : "s"})`
                : "";
            label.appendChild(cb);
            label.appendChild(document.createTextNode(topic.name + countNote));
            checkboxes.push(cb);
            dialog.appendChild(label);
        }
    }

    // New topic row
    const newTopicRow = document.createElement("div");
    newTopicRow.style.cssText = "display:flex;gap:6px;margin-top:10px;";

    const newTopicInput = document.createElement("input");
    newTopicInput.type = "text";
    newTopicInput.placeholder = "New topic name...";
    newTopicInput.style.cssText = "flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;outline:none;";

    const addTopicBtn = document.createElement("button");
    addTopicBtn.textContent = "Add";
    addTopicBtn.style.cssText = "padding:6px 12px;cursor:pointer;font-size:13px;border:1px solid #ccc;border-radius:4px;background:#f3f2ef;";

    addTopicBtn.addEventListener("click", () => {
        const name = newTopicInput.value.trim();
        if (!name || checkboxes.some(cb => cb.value === name)) return;

        const label = document.createElement("label");
        label.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:14px;color:#1d1d1d;";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = name;
        cb.checked = true;
        cb.dataset.isNew = "true";
        label.appendChild(cb);
        label.appendChild(document.createTextNode(name + " (new)"));
        checkboxes.push(cb);
        newTopicRow.parentElement.insertBefore(label, newTopicRow);
        newTopicInput.value = "";
    });

    newTopicInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addTopicBtn.click();
    });

    newTopicRow.appendChild(newTopicInput);
    newTopicRow.appendChild(addTopicBtn);
    dialog.appendChild(newTopicRow);

    // Action buttons
    const actionRow = document.createElement("div");
    actionRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:16px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:6px 14px;cursor:pointer;font-size:13px;border:1px solid #ccc;border-radius:4px;background:#fff;";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.cssText = "padding:6px 14px;cursor:pointer;font-size:13px;background:#0a66c2;color:#fff;border:none;border-radius:4px;";

    cancelBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    saveBtn.addEventListener("click", async () => {
        const checked = checkboxes.filter(cb => cb.checked);
        if (checked.length === 0) { overlay.remove(); return; }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        for (const cb of checked) {
            if (cb.dataset.isNew === "true") {
                await chrome.runtime.sendMessage({ type: "add-blocked-topic", topic: cb.value });
            }
            if (postText) {
                await chrome.runtime.sendMessage({ type: "add-example-to-topic", topicName: cb.value, text: postText });
            }
        }

        overlay.remove();
    });

    actionRow.appendChild(cancelBtn);
    actionRow.appendChild(saveBtn);
    dialog.appendChild(actionRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

// --- Score post (auto-blur) ---

function scorePost(post) {
    const textEl = post.querySelector('[data-testid="expandable-text-box"]');
    const text = (textEl?.innerText || "").trim();
    if (!text) return;

    chrome.runtime.sendMessage(
        { type: "score-post", text: text.slice(0, MAX_TEXT_LENGTH) },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("LinkedInFeedFilter score-post error:", chrome.runtime.lastError.message);
                return;
            }
            if (!response || typeof response.similarity !== "number") return;
            if (response.similarity >= SIMILARITY_THRESHOLD) {
                blurPost(post, response.similarity);
            }
        }
    );
}

// --- Scan ---

function scanFeedPosts() {
    const postHeaders = [...document.querySelectorAll("h2:has(> span + span[aria-hidden='true'])")];

    postHeaders.forEach((header) => {
        // Walk up to find the post container via the "Open control menu" button
        let post = header.parentElement;
        while (post && post.tagName !== "BODY") {
            if (post.querySelector('button:has(svg#overflow-web-ios-small)') && !post.classList.contains("liff-content-layer")) break;
            post = post.parentElement;
        }
        if (!post || post.tagName === "BODY") return;

        injectFlagButton(post);

        if (post.dataset.liffScanned === "true") return;
        post.dataset.liffScanned = "true";
        scorePost(post);
    });
}

scanFeedPosts();
new MutationObserver(scanFeedPosts).observe(document.body, {
    childList: true,
    subtree: true
});
