const CUSTOMER_STORAGE_KEY = "fit4work_customer_name";

const customerModal = document.getElementById("customer-modal");
const customerInput = document.getElementById("customer-name-input");
const customerNameDisplay = document.getElementById("customer-name-display");
const saveCustomerButton = document.getElementById("save-customer-button");
const changeCustomerButton = document.getElementById("change-customer-button");
const categoryTabs = document.getElementById("category-tabs");
const orderSection = document.getElementById("order-section");
const totalAmountLabel = document.getElementById("total-amount-label");
const shippingStatusLabel = document.getElementById("shipping-status-label");
const shippingProgressBar = document.getElementById("shipping-progress-bar");
const selectedCountLabel = document.getElementById("selected-count-label");
const floatingTotalLabel = document.getElementById("floating-total-label");
const openMiniOrderButton = document.getElementById("open-mini-order-button");
const openConfirmButton = document.getElementById("open-confirm-button");
const confirmModal = document.getElementById("confirm-modal");
const confirmCustomerInput = document.getElementById("confirm-customer-input");
const confirmMemoInput = document.getElementById("confirm-memo-input");
const modalItems = document.getElementById("modal-items");
const modalTotalQty = document.getElementById("modal-total-qty");
const modalTotalAmount = document.getElementById("modal-total-amount");
const closeConfirmButton = document.getElementById("close-confirm-button");
const submitConfirmButton = document.getElementById("submit-confirm-button");
const completeModal = document.getElementById("complete-modal");
const completeOrderId = document.getElementById("complete-order-id");
const completeCloseButton = document.getElementById("complete-close-button");
const miniOrderSheet = document.getElementById("mini-order-sheet");
const closeMiniOrderButton = document.getElementById("close-mini-order-button");
const miniOrderItems = document.getElementById("mini-order-items");
const miniTotalQty = document.getElementById("mini-total-qty");
const miniTotalAmount = document.getElementById("mini-total-amount");

const freeShippingThreshold = Number(document.body.dataset.freeShippingThreshold || 100000);
const cart = {};
let currentCustomerName = "";
let isCustomerModalRequired = true;
let isSubmittingOrder = false;

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function clearStoredCustomerName() {
  try {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  } catch (_error) {
    // Some browsers can block storage access; ordering should still work.
  }
}

function getCustomerName() {
  return currentCustomerName.trim();
}

function setCustomerName(name) {
  currentCustomerName = name.trim();
  clearStoredCustomerName();
}

function syncCustomerUI() {
  const customerName = getCustomerName();
  const hasCustomer = Boolean(customerName);

  customerNameDisplay.textContent = customerName || "입력 필요";
  orderSection.classList.toggle("is-locked", !hasCustomer);
  orderSection.setAttribute("aria-hidden", String(!hasCustomer));
  customerInput.value = customerName;

  if (!hasCustomer) {
    openCustomerModal(true);
  } else {
    closeCustomerModal();
  }
}

function ensureCartProduct(productCode) {
  if (!cart[productCode]) {
    cart[productCode] = {};
  }
}

function getQty(productCode, size) {
  return Number(cart?.[productCode]?.[size] || 0);
}

function setQty(productCode, size, qty) {
  ensureCartProduct(productCode);
  const nextQty = Math.max(0, qty);
  if (nextQty === 0) {
    delete cart[productCode][size];
    if (Object.keys(cart[productCode]).length === 0) {
      delete cart[productCode];
    }
    return;
  }
  cart[productCode][size] = nextQty;
}

function getProductCard(productCode) {
  return document.querySelector(`[data-product-card][data-product-code="${cssEscape(productCode)}"]`);
}

function getQuantityPanel(productCode) {
  return document.querySelector(`[data-quantity-panel][data-product-code="${cssEscape(productCode)}"]`);
}

function updateProductPanel(productCode) {
  const panel = getQuantityPanel(productCode);
  if (!panel) {
    return;
  }

  const activeSize = panel.dataset.activeSize;
  const unitPrice = Number(panel.dataset.price || 0);
  const qty = getQty(productCode, activeSize);

  panel.querySelector("[data-active-qty]").textContent = String(qty);
  panel.querySelector("[data-line-total]").textContent = formatCurrency(unitPrice * qty);
}

function updateAllProductPanels() {
  document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
    updateProductPanel(panel.dataset.productCode);
  });
}

function refreshOrderViews() {
  updateAllProductPanels();
  renderSummary();
  if (!confirmModal.classList.contains("is-hidden")) {
    buildModal();
    updateConfirmSubmitState();
  }
}

function getCartItems() {
  const items = [];
  document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
    const productCode = panel.dataset.productCode;
    const productName = panel.dataset.productName;
    const unitPrice = Number(panel.dataset.price || 0);

    Object.entries(cart[productCode] || {}).forEach(([size, qty]) => {
      if (qty <= 0) {
        return;
      }

      items.push({
        product_code: productCode,
        product_name: productName,
        size,
        qty,
        unit_price: unitPrice,
        line_total: unitPrice * qty,
      });
    });
  });

  return items;
}

function getTotals() {
  const items = getCartItems();
  return {
    items,
    totalQty: items.reduce((sum, item) => sum + item.qty, 0),
    totalAmount: items.reduce((sum, item) => sum + item.line_total, 0),
  };
}

function renderSummary() {
  const { totalQty, totalAmount } = getTotals();
  const progress = Math.min(100, Math.round((totalAmount / freeShippingThreshold) * 100));

  totalAmountLabel.textContent = formatCurrency(totalAmount);
  floatingTotalLabel.textContent = formatCurrency(totalAmount);
  selectedCountLabel.textContent = `선택 상품 ${totalQty}개`;
  shippingProgressBar.style.width = `${progress}%`;

  if (totalAmount >= freeShippingThreshold) {
    shippingStatusLabel.textContent = "무료배송 기준 충족";
  } else {
    shippingStatusLabel.textContent = `무료배송까지 ${formatCurrency(freeShippingThreshold - totalAmount)}`;
  }

  openConfirmButton.disabled = isSubmittingOrder || totalQty === 0 || !getCustomerName();

  if (!miniOrderSheet.classList.contains("is-hidden")) {
    renderMiniOrderSheet();
  }
}

function handleSizeClick(button) {
  const productCode = button.dataset.productCode;
  const size = button.dataset.size;
  const panel = getQuantityPanel(productCode);
  const card = getProductCard(productCode);

  if (!panel || !card) {
    return;
  }

  panel.dataset.activeSize = size;
  card.querySelectorAll("[data-size-button]").forEach((sizeButton) => {
    sizeButton.classList.toggle("is-active", sizeButton.dataset.size === size);
  });
  updateProductPanel(productCode);
}

function handleQtyClick(button) {
  if (!getCustomerName()) {
    customerInput.focus();
    return;
  }

  const panel = button.closest("[data-quantity-panel]");
  const productCode = panel.dataset.productCode;
  const activeSize = panel.dataset.activeSize;
  const currentQty = getQty(productCode, activeSize);
  const nextQty = button.dataset.action === "increase" ? currentQty + 1 : currentQty - 1;

  setQty(productCode, activeSize, nextQty);
  updateProductPanel(productCode);
  renderSummary();
}

function filterCategory(category) {
  document.querySelectorAll("[data-product-card]").forEach((card) => {
    const shouldShow = category === "전체" || card.dataset.category === category;
    card.classList.toggle("is-hidden", !shouldShow);
  });
}

function initializeCategoryTabs() {
  const defaultTab = categoryTabs.querySelector('[data-category="전체"]');
  if (!defaultTab) {
    return;
  }

  categoryTabs.querySelectorAll("[data-category]").forEach((tab) => {
    tab.classList.toggle("is-active", tab === defaultTab);
  });
  filterCategory("전체");
}

function buildModal() {
  const { items, totalQty, totalAmount } = getTotals();
  confirmCustomerInput.value = getCustomerName();
  if (confirmMemoInput) {
    confirmMemoInput.value = confirmMemoInput.value || "";
  }
  modalTotalQty.textContent = `${totalQty}장`;
  modalTotalAmount.textContent = formatCurrency(totalAmount);
  modalItems.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "modal-item";

    const title = document.createElement("div");
    title.className = "modal-item-title";
    title.textContent = item.product_name;

    const detail = document.createElement("div");
    detail.className = "modal-item-detail";
    detail.textContent = `${item.product_code} / ${item.size} / ${item.qty}장 / ${formatCurrency(item.line_total)}`;

    row.append(title, detail);
    modalItems.appendChild(row);
  });
}

function renderMiniOrderSheet() {
  const { items, totalQty, totalAmount } = getTotals();
  miniOrderItems.innerHTML = "";
  miniTotalQty.textContent = `${totalQty}장`;
  miniTotalAmount.textContent = formatCurrency(totalAmount);

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-order-empty";
    empty.textContent = "선택한 상품이 없습니다.";
    miniOrderItems.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "mini-order-item";
    row.dataset.productCode = item.product_code;
    row.dataset.size = item.size;

    const info = document.createElement("div");
    info.className = "mini-order-info";

    const title = document.createElement("strong");
    title.textContent = item.product_name;

    const detail = document.createElement("span");
    detail.textContent = `${item.product_code} / ${item.size} / ${item.qty}장`;
    info.append(title, detail);

    const controls = document.createElement("div");
    controls.className = "mini-order-controls";

    const minusButton = document.createElement("button");
    minusButton.type = "button";
    minusButton.className = "mini-qty-button";
    minusButton.dataset.miniAction = "decrease";
    minusButton.textContent = "-";

    const qtyValue = document.createElement("strong");
    qtyValue.className = "mini-qty-value";
    qtyValue.textContent = String(item.qty);

    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.className = "mini-qty-button";
    plusButton.dataset.miniAction = "increase";
    plusButton.textContent = "+";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "mini-delete-button";
    deleteButton.dataset.miniAction = "delete";
    deleteButton.textContent = "삭제";

    controls.append(minusButton, qtyValue, plusButton, deleteButton);
    row.append(info, controls);
    miniOrderItems.appendChild(row);
  });
}

function openModal(modal) {
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
}

function openCustomerModal(isRequired = false) {
  isCustomerModalRequired = isRequired;
  customerInput.value = isRequired ? "" : getCustomerName();
  customerModal.classList.remove("is-hidden");
  customerModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => customerInput.focus(), 50);
}

function closeCustomerModal() {
  customerModal.classList.add("is-hidden");
  customerModal.setAttribute("aria-hidden", "true");
}

function openSheet(sheet) {
  renderMiniOrderSheet();
  sheet.classList.remove("is-hidden");
  sheet.setAttribute("aria-hidden", "false");
}

function closeSheet(sheet) {
  sheet.classList.add("is-hidden");
  sheet.setAttribute("aria-hidden", "true");
}

function resetCart() {
  Object.keys(cart).forEach((productCode) => {
    delete cart[productCode];
  });

  document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
    updateProductPanel(panel.dataset.productCode);
  });
  renderSummary();
}

function handleMiniOrderAction(button) {
  const row = button.closest(".mini-order-item");
  if (!row) {
    return;
  }

  const productCode = row.dataset.productCode;
  const size = row.dataset.size;
  const currentQty = getQty(productCode, size);

  if (button.dataset.miniAction === "increase") {
    setQty(productCode, size, currentQty + 1);
  }

  if (button.dataset.miniAction === "decrease") {
    setQty(productCode, size, currentQty - 1);
  }

  if (button.dataset.miniAction === "delete") {
    setQty(productCode, size, 0);
  }

  refreshOrderViews();
}

function resetCustomer() {
  setCustomerName("");
  customerNameDisplay.textContent = "입력 필요";
  customerInput.value = "";
  confirmCustomerInput.value = "";
  resetMemoInput();
  orderSection.classList.add("is-locked");
  orderSection.setAttribute("aria-hidden", "true");
}

function getMemoValue() {
  return confirmMemoInput?.value.trim() || "";
}

function resetMemoInput() {
  if (confirmMemoInput) {
    confirmMemoInput.value = "";
  }
}

function updateConfirmSubmitState() {
  submitConfirmButton.disabled = isSubmittingOrder || !confirmCustomerInput.value.trim();
}

async function submitOrder() {
  if (isSubmittingOrder) {
    return;
  }

  const { items, totalQty, totalAmount } = getTotals();
  const customerName = confirmCustomerInput.value.trim();
  const memo = getMemoValue();

  if (!customerName) {
    confirmCustomerInput.focus();
    updateConfirmSubmitState();
    return;
  }

  if (items.length === 0 || totalQty <= 0) {
    closeModal(confirmModal);
    openSheet(miniOrderSheet);
    renderSummary();
    return;
  }

  setCustomerName(customerName);
  customerNameDisplay.textContent = customerName;

  isSubmittingOrder = true;
  updateConfirmSubmitState();
  renderSummary();
  submitConfirmButton.textContent = "전송 중...";

  try {
    const response = await fetch("/submit_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_name: customerName,
        items: items.map((item) => ({
          product_code: item.product_code,
          size: item.size,
          qty: item.qty,
        })),
        total_qty: totalQty,
        total_amount: totalAmount,
        memo,
      }),
    });

    const responseText = await response.text();
    let result = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (_error) {
      console.error("Order submit response is not JSON", {
        status: response.status,
        responseText,
      });
    }

    if (!response.ok || !result.ok) {
      console.error("Order submit failed", {
        status: response.status,
        responseText,
        result,
      });
      const message = Array.isArray(result.errors) ? result.errors.join(" ") : "주문 전송에 실패했습니다.";
      alert(message);
      return;
    }

    closeModal(confirmModal);
    completeOrderId.textContent = result.order_id || "-";
    openModal(completeModal);
    resetCart();
    resetCustomer();
    resetMemoInput();
  } catch (error) {
    console.error("Order submit network error", error);
    alert("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    isSubmittingOrder = false;
    submitConfirmButton.textContent = "주문 확정";
    updateConfirmSubmitState();
    renderSummary();
  }
}

saveCustomerButton.addEventListener("click", () => {
  const name = customerInput.value.trim();
  if (!name) {
    customerInput.focus();
    return;
  }

  setCustomerName(name);
  syncCustomerUI();
  renderSummary();
});

customerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveCustomerButton.click();
  }
});

changeCustomerButton.addEventListener("click", () => {
  customerInput.value = getCustomerName();
  openCustomerModal(false);
});

categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) {
    return;
  }

  categoryTabs.querySelectorAll("[data-category]").forEach((tab) => {
    tab.classList.toggle("is-active", tab === button);
  });
  filterCategory(button.dataset.category);
});

orderSection.addEventListener("click", (event) => {
  const sizeButton = event.target.closest("[data-size-button]");
  if (sizeButton) {
    handleSizeClick(sizeButton);
    return;
  }

  const qtyButton = event.target.closest("[data-action]");
  if (qtyButton) {
    handleQtyClick(qtyButton);
  }
});

openConfirmButton.addEventListener("click", () => {
  buildModal();
  updateConfirmSubmitState();
  openModal(confirmModal);
});

openMiniOrderButton.addEventListener("click", () => openSheet(miniOrderSheet));
closeMiniOrderButton.addEventListener("click", () => closeSheet(miniOrderSheet));
miniOrderSheet.addEventListener("click", (event) => {
  const miniActionButton = event.target.closest("[data-mini-action]");
  if (miniActionButton) {
    handleMiniOrderAction(miniActionButton);
    return;
  }

  if (event.target.closest("[data-sheet-close]")) {
    closeSheet(miniOrderSheet);
  }
});

customerModal.addEventListener("click", (event) => {
  if (!event.target.closest("[data-customer-modal-backdrop]")) {
    return;
  }
  if (!isCustomerModalRequired) {
    closeCustomerModal();
  }
});

confirmModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-confirm-modal-backdrop]")) {
    closeModal(confirmModal);
  }
});

confirmCustomerInput.addEventListener("input", updateConfirmSubmitState);
closeConfirmButton.addEventListener("click", () => {
  closeModal(confirmModal);
  openSheet(miniOrderSheet);
});
submitConfirmButton.addEventListener("click", submitOrder);
completeCloseButton.addEventListener("click", () => {
  closeModal(completeModal);
  syncCustomerUI();
});

clearStoredCustomerName();
syncCustomerUI();
initializeCategoryTabs();
document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
  updateProductPanel(panel.dataset.productCode);
});
renderSummary();
