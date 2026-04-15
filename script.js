/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

const workerURL = "https://loreal.wagnercp.workers.dev/";

/* Keep track of selected products and chat history */
let selectedProducts = [];
let currentProducts = [];
let conversationHistory = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML =
  '<div class="placeholder-message">Select a category to view products</div>';

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Return true when a product is already selected */
function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Add one message bubble to the chat window */
function addChatMessage(role, message) {
  const messageElement = document.createElement("div");
  messageElement.className = "chat-message " + role;
  messageElement.textContent = message;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

/* Show a loading message while waiting for the worker */
function showLoadingMessage() {
  const loadingElement = document.createElement("div");
  loadingElement.className = "chat-message assistant loading-message";
  loadingElement.textContent = "Thinking...";
  chatWindow.appendChild(loadingElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return loadingElement;
}

/* Show a starter message in the chat window */
function showWelcomeMessage() {
  chatWindow.innerHTML = "";
  addChatMessage(
    "assistant",
    "Hi, I can help you build a routine or answer questions about the products you selected."
  );
}

/* Build a clean JSON array with only the fields we want to send to the worker */
function buildSelectedProductsPayload() {
  return selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

/* Create the messages that will be sent to the worker */
function buildWorkerMessages(userMessage) {
  const selectedProductsPayload = buildSelectedProductsPayload();
  let systemMessage;

  if (selectedProductsPayload.length > 0) {
    systemMessage =
      "You are a helpful beauty advisor. Use the selected products below when possible, and keep the answer beginner-friendly. Selected products: " +
      JSON.stringify(selectedProductsPayload, null, 2);
  } else {
    systemMessage =
      "You are a helpful beauty advisor. Keep the answer beginner-friendly and practical.";
  }

  const messages = [{ role: "system", content: systemMessage }];

  for (const item of conversationHistory) {
    messages.push(item);
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

/* Read the response text from the worker, no matter which shape it returns */
function getWorkerMessageContent(data) {
  if (data && data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }

  if (data && data.message && data.message.content) {
    return data.message.content;
  }

  if (data && data.content) {
    return data.content;
  }

  if (data && data.response) {
    return data.response;
  }

  return "Sorry, I could not generate a response.";
}

/* Send a chat request to the Cloudflare Worker */
async function sendChatRequest(userMessage) {
  const response = await fetch(workerURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: buildWorkerMessages(userMessage),
    }),
  });

  if (!response.ok) {
    throw new Error("Worker request failed with status " + response.status);
  }

  const rawText = await response.text();

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return { content: rawText };
  }
}

/* Ask the AI assistant and show the answer in the chat window */
async function askAssistant(userMessage) {
  addChatMessage("user", userMessage);

  const loadingMessage = showLoadingMessage();
  sendBtn.disabled = true;
  userInput.disabled = true;

  try {
    const data = await sendChatRequest(userMessage);
    const assistantMessage = getWorkerMessageContent(data);

    conversationHistory.push({ role: "user", content: userMessage });
    conversationHistory.push({ role: "assistant", content: assistantMessage });

    loadingMessage.remove();
    addChatMessage("assistant", assistantMessage);
  } catch (error) {
    loadingMessage.remove();
    addChatMessage("assistant", "Sorry, something went wrong: " + error.message);
  } finally {
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  productsContainer.innerHTML = products
    .map((product) => {
      const selectedClass = isProductSelected(product.id) ? " selected" : "";

      return (
        '<div class="product-card' +
        selectedClass +
        '" data-id="' +
        product.id +
        '">' +
        '<img src="' +
        product.image +
        '" alt="' +
        product.name +
        '">' +
        '<div class="product-info">' +
        "<h3>" +
        product.name +
        "</h3>" +
        "<p>" +
        product.brand +
        "</p>" +
        "</div>" +
        '<div class="product-actions">' +
        '<button class="more-info-btn" data-product-id="' +
        product.id +
        '" type="button">ⓘ</button>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  /* Add click behavior after cards are rendered */
  const cards = document.querySelectorAll(".product-card");
  cards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".more-info-btn")) {
        return;
      }

      const productId = Number(card.dataset.id);
      toggleSelectedProduct(productId, products);
    });
  });

  /* Add click behavior to more info buttons */
  const moreInfoBtns = document.querySelectorAll(".more-info-btn");
  moreInfoBtns.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      const productId = Number(button.dataset.productId);
      const product = products.find((item) => item.id === productId);

      if (product) {
        openProductModal(product);
      }
    });
  });
}

/* Add or remove product from selectedProducts */
function toggleSelectedProduct(productId, products) {
  const alreadySelected = isProductSelected(productId);

  if (alreadySelected) {
    selectedProducts = selectedProducts.filter(
      (product) => product.id !== productId
    );
  } else {
    const productToAdd = products.find((product) => product.id === productId);
    if (productToAdd) {
      selectedProducts.push(productToAdd);
    }
  }

  displayProducts(products);
  renderSelectedProducts();
}

/* Open product modal with description */
function openProductModal(product) {
  let modal = document.getElementById("productModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "productModal";
    modal.className = "product-modal";
    modal.innerHTML =
      '<div class="modal-content">' +
      '<button class="modal-close" aria-label="Close">&times;</button>' +
      '<div class="modal-body">' +
      '<h2 id="modalProductName"></h2>' +
      '<p class="modal-brand" id="modalProductBrand"></p>' +
      '<p id="modalProductDescription"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector(".modal-close");
    closeBtn.addEventListener("click", closeProductModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeProductModal();
      }
    });
  }

  document.getElementById("modalProductName").textContent = product.name;
  document.getElementById("modalProductBrand").textContent = product.brand;
  document.getElementById("modalProductDescription").textContent =
    product.description;

  modal.classList.add("active");
}

/* Close product modal */
function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

/* Show selected products in the Selected Products section */
function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="placeholder-message">No products selected yet</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map((product) => {
      return (
        '<button class="selected-pill remove-selected-btn" data-id="' +
        product.id +
        '" type="button" aria-label="Remove ' +
        product.name +
        '">' +
        product.name +
        " x" +
        "</button>"
      );
    })
    .join("");

  const removeButtons = document.querySelectorAll(".remove-selected-btn");
  removeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = Number(button.dataset.id);
      removeSelectedProduct(productId);
    });
  });
}

/* Remove a selected product directly from selected list */
function removeSelectedProduct(productId) {
  selectedProducts = selectedProducts.filter(
    (product) => product.id !== productId
  );

  if (currentProducts.length > 0) {
    displayProducts(currentProducts);
  }

  renderSelectedProducts();
}

/* Send selected products to the worker and show the generated routine */
async function generateRoutineFromSelectedProducts() {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = "";
    addChatMessage(
      "assistant",
      "Please select at least one product, then click Generate Routine."
    );
    return;
  }

  const selectedProductsPayload = buildSelectedProductsPayload();
  const prompt =
    "Create a step-by-step skincare or beauty routine using this selected product data:\n\n" +
    JSON.stringify(selectedProductsPayload, null, 2) +
    "\n\nExplain when to use each product (morning or night). Keep it beginner-friendly.";

  chatWindow.innerHTML = "";
  const loadingMessage = showLoadingMessage();
  generateRoutineBtn.disabled = true;
  sendBtn.disabled = true;

  try {
    const data = await sendChatRequest(prompt);
    const routine = getWorkerMessageContent(data);

    if (!routine) {
      throw new Error("No routine text was returned from the worker.");
    }

    loadingMessage.remove();
    conversationHistory.push({
      role: "user",
      content: "Generate a routine from my selected products.",
    });
    conversationHistory.push({ role: "assistant", content: routine });
    addChatMessage("assistant", routine);
  } catch (error) {
    loadingMessage.remove();
    addChatMessage("assistant", "Sorry, something went wrong: " + error.message);
  } finally {
    generateRoutineBtn.disabled = false;
    sendBtn.disabled = false;
  }
}

/* Handle Generate Routine button click */
generateRoutineBtn.addEventListener("click", async () => {
  await generateRoutineFromSelectedProducts();
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (event) => {
  const products = await loadProducts();
  const selectedCategory = event.target.value;

  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = userInput.value.trim();
  if (!message) {
    return;
  }

  await askAssistant(message);
});

renderSelectedProducts();
showWelcomeMessage();
