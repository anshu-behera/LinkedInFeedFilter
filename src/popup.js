async function getTopics() {
  const response = await chrome.runtime.sendMessage({ type: "get-topics" });
  return response?.topics ?? [];
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = isError ? "#c00" : "#666";
}

function renderTopics(topics) {
  const list = document.getElementById("topic-list");
  list.innerHTML = "";

  if (topics.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No blocked topics yet.";
    list.appendChild(li);
    return;
  }

  for (const topic of topics) {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = topic.name;

    const countSpan = document.createElement("span");
    countSpan.className = "example-count";
    countSpan.textContent = topic.exampleCount > 0
      ? `${topic.exampleCount} example${topic.exampleCount === 1 ? "" : "s"}`
      : "no examples";

    const btn = document.createElement("button");
    btn.className = "remove";
    btn.textContent = "×";
    btn.title = "Remove";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      setStatus("Removing...");
      const response = await chrome.runtime.sendMessage({ type: "remove-blocked-topic", topic: topic.name });
      if (response?.ok) {
        renderTopics(await getTopics());
        setStatus(response.count > 0 ? `${response.count} topic${response.count === 1 ? "" : "s"} blocked.` : "");
      } else {
        setStatus(response?.error || "Failed to remove.", true);
        btn.disabled = false;
      }
    });

    li.appendChild(nameSpan);
    li.appendChild(countSpan);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

document.getElementById("add-btn").addEventListener("click", async () => {
  const input = document.getElementById("new-topic");
  const topic = input.value.trim();
  if (!topic) return;

  const addBtn = document.getElementById("add-btn");
  addBtn.disabled = true;
  setStatus("Adding (embedding may take a moment)...");

  const response = await chrome.runtime.sendMessage({ type: "add-blocked-topic", topic });
  addBtn.disabled = false;

  if (response?.ok) {
    input.value = "";
    renderTopics(await getTopics());
    setStatus(`${response.count} topic${response.count === 1 ? "" : "s"} blocked.`);
  } else {
    setStatus(response?.error || "Failed to add topic.", true);
  }
});

document.getElementById("new-topic").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("add-btn").click();
});

getTopics().then(renderTopics);