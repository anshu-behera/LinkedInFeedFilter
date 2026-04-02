import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const STORAGE_KEY = "liff_state_v2";
const HIDDEN_TOPIC_PREFIX = "__liff_hidden_";
const SIMILARITY_THRESHOLD = 0.5;

let extractorPromise;
// topics: Array<{ name: string, topicEmbedding: number[], examplePosts: Array<{ text: string, embedding: number[] }> }>
let topics = [];

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: { topics } });
}

async function loadState() {
  // Try v2 first
  const v2data = await chrome.storage.local.get(STORAGE_KEY);
  if (v2data[STORAGE_KEY]) {
    topics = Array.isArray(v2data[STORAGE_KEY].topics) ? v2data[STORAGE_KEY].topics : [];
    return;
  }

  // Migrate from v1
  const v1data = await chrome.storage.local.get("liff_state_v1");
  const v1 = v1data["liff_state_v1"];
  if (v1 && Array.isArray(v1.blockedTopics)) {
    topics = v1.blockedTopics.map((name, i) => ({
      name,
      topicEmbedding: Array.isArray(v1.blockedEmbeddings) ? (v1.blockedEmbeddings[i] ?? []) : [],
      examplePosts: []
    }));
    await saveState();
  }
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return extractorPromise;
}

async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

function computeCentroid(embeddings) {
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }
  return centroid;
}

function scoreTopic(postEmbedding, topic) {
  const topicSim = cosineSimilarity(postEmbedding, topic.topicEmbedding);
  if (topic.examplePosts.length === 0) return topicSim;

  const centroid = computeCentroid(topic.examplePosts.map(ex => ex.embedding));
  return cosineSimilarity(postEmbedding, centroid);
}

async function addBlockedTopic(name) {
  const normalized = (name || "").trim();
  if (!normalized) throw new Error("Empty topic");
  if (topics.some(t => t.name === normalized)) return;

  const topicEmbedding = await embedText(normalized);
  topics.push({ name: normalized, topicEmbedding, examplePosts: [] });
  await saveState();
}

async function removeBlockedTopic(name) {
  const idx = topics.findIndex(t => t.name === name);
  if (idx === -1) return;
  topics.splice(idx, 1);
  await saveState();
}

async function storeTopiclessPost(text) {
  const embedding = await embedText(text);
  const matching = topics.filter(t => scoreTopic(embedding, t) >= SIMILARITY_THRESHOLD);

  if (matching.length > 0) {
    let changed = false;
    for (const t of matching) {
      if (!t.examplePosts.some(p => p.text === text)) {
        t.examplePosts.push({ text, embedding });
        changed = true;
      }
    }
    if (changed) await saveState();
  } else {
    const name = HIDDEN_TOPIC_PREFIX + crypto.randomUUID();
    topics.push({ name, topicEmbedding: embedding, examplePosts: [{ text, embedding }] });
    await saveState();
  }
}

async function addExampleToTopic(topicName, text) {
  const topic = topics.find(t => t.name === topicName);
  if (!topic) throw new Error(`Topic not found: "${topicName}"`);
  const normalized = (text || "").trim();
  if (!normalized) throw new Error("Empty example text");
  if (topic.examplePosts.some(p => p.text === normalized)) return;

  const embedding = await embedText(normalized);
  topic.examplePosts.push({ text: normalized, embedding });
  await saveState();
}

const initPromise = (async () => {
  await loadState();
  if (topics.length > 0) {
    await getExtractor();
  }
})();

async function ensureInitialized() {
  await initPromise;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "score-post") {
    (async () => {
      try {
        await ensureInitialized();

        if (topics.length === 0) {
          console.info("No blocked topics, skipping scoring");
          sendResponse({ similarity: -1 });
          return;
        }

        const embedding = await embedText(message.text || "");
        let maxSimilarity = -1;
        for (const topic of topics) {
          maxSimilarity = Math.max(maxSimilarity, scoreTopic(embedding, topic));
        }

        console.info("LinkedInFeedFilter score-post", { text: message.text.trim().slice(0, 100), similarity: maxSimilarity });

        sendResponse({ similarity: maxSimilarity });
      } catch (error) {
        console.error("LinkedInFeedFilter score-post error:", error);
        sendResponse({ similarity: -1, error: String(error) });
      }
    })();
    return true;
  }

  if (message.type === "get-topics") {
    (async () => {
      try {
        await ensureInitialized();
        sendResponse({
          topics: topics
            .filter(t => !t.name.startsWith(HIDDEN_TOPIC_PREFIX))
            .map(t => ({ name: t.name, exampleCount: t.examplePosts.length }))
        });
      } catch (e) {
        sendResponse({ topics: [] });
      }
    })();
    return true;
  }

  if (message.type === "add-blocked-topic") {
    (async () => {
      try {
        await ensureInitialized();
        await addBlockedTopic(message.topic);
        sendResponse({ ok: true, count: topics.length });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (message.type === "remove-blocked-topic") {
    (async () => {
      try {
        await ensureInitialized();
        await removeBlockedTopic(message.topic);
        sendResponse({ ok: true, count: topics.length });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (message.type === "add-example-to-topic") {
    (async () => {
      try {
        await ensureInitialized();
        await addExampleToTopic(message.topicName, message.text);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (message.type === "add-post-without-topic") {
    (async () => {
      try {
        await ensureInitialized();
        const text = (message.text || "").trim();
        if (text) await storeTopiclessPost(text);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  return false;
});