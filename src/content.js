const BLOCKED_TOPICS = [
    "job opening announcement",
    "we are hiring",
    "recruiter outreach",
    "urgent hiring requirement",
    "artificial intelligence"
];

const SIMILARITY_THRESHOLD = 0.5;
const MAX_TEXT_LENGTH = 1800;

chrome.runtime.sendMessage({
    type: "init-model",
    blockedTopics: BLOCKED_TOPICS
});

function blurPost(post, similarity) {
    if (post.dataset.liffBlurred === "true") {
        return;
    }

    post.dataset.liffBlurred = "true";
    console.log("Deleting post", post.innerText || '');
    post.style.display = "none"
    // post.style.filter = "blur(10px)";
    // post.style.transition = "filter 180ms ease";
    //
    // const reveal = document.createElement("button");
    // reveal.type = "button";
    // reveal.textContent = `Show post (${similarity.toFixed(2)})`;
    // reveal.style.position = "absolute";
    // reveal.style.top = "12px";
    // reveal.style.right = "12px";
    // reveal.style.zIndex = "9999";
    // reveal.style.padding = "6px 10px";
    // reveal.style.border = "1px solid #666";
    // reveal.style.borderRadius = "8px";
    // reveal.style.background = "#fff";
    // reveal.style.cursor = "pointer";

    if (window.getComputedStyle(post).position === "static") {
        post.style.position = "relative";
    }

    reveal.addEventListener("click", (event) => {
        event.stopPropagation();
        post.style.filter = "none";
        post.dataset.liffBlurred = "false";
        reveal.remove();
    });

    post.appendChild(reveal);
}

function scorePost(post) {
    const text = (post.innerText || "").trim();
    if (!text) {
        return;
    }

    chrome.runtime.sendMessage(
        {
            type: "score-post",
            text: text.slice(0, MAX_TEXT_LENGTH)
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("LinkedInFeedFilter score-post error:", chrome.runtime.lastError.message);
                return;
            }

            if (!response || typeof response.similarity !== "number") {
                return;
            }

            if (response.similarity >= SIMILARITY_THRESHOLD) {
                blurPost(post, response.similarity);
            }
        }
    );
}

function scanFeedPosts() {
    const posts = document.querySelectorAll("div.feed-shared-update-v2");

    posts.forEach((post) => {
        if (post.dataset.liffScanned === "true") {
            return;
        }

        post.dataset.liffScanned = "true";
        scorePost(post);
    });
}

scanFeedPosts();
new MutationObserver(scanFeedPosts).observe(document.body, {
    childList: true,
    subtree: true
});