import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractorPromise;
let blockedEmbeddings = [];

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}
let a = [1, 1, 1]
let b = [1, 1, 1]
cosineSimilarity(a,b)

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }

  return extractorPromise;
}

async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true
  });

  return Array.from(output.data);
}

async function initializeBlockedTopics(topics) {
  blockedEmbeddings = [];

  for (const topic of topics) {
    blockedEmbeddings.push(await embedText(topic));
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "init-model") {
    initializeBlockedTopics(message.blockedTopics || [])
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("LinkedInFeedFilter init-model error:", error);
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  }

  if (message.type === "score-post") {
    (async () => {
      try {
        if (blockedEmbeddings.length === 0) {
          sendResponse({ similarity: -1 });
          return;
        }

        const embedding = await embedText(message.text || "");

        let maxSimilarity = -1;
        for (const blockedEmbedding of blockedEmbeddings) {
          maxSimilarity = Math.max(maxSimilarity, cosineSimilarity(embedding, blockedEmbedding));
        }

        sendResponse({ similarity: maxSimilarity });
      } catch (error) {
        console.error("LinkedInFeedFilter score-post error:", error);
        sendResponse({ similarity: -1, error: String(error) });
      }
    })();

    return true;
  }

  return false;
});