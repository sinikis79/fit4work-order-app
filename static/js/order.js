const CUSTOMER_STORAGE_KEY = "fit4work_customer_name";

const customerModal = document.getElementById("customer-modal");
const customerInput = document.getElementById("customer-name-input");
const customerNameDisplay = document.getElementById("customer-name-display");
const collapsedCustomerNameDisplay = document.getElementById("collapsed-customer-name-display");
const saveCustomerButton = document.getElementById("save-customer-button");
const changeCustomerButton = document.getElementById("change-customer-button");
const categoryTabs = document.getElementById("category-tabs");
const orderSection = document.getElementById("order-section");
const totalAmountLabel = document.getElementById("total-amount-label");
const collapsedTotalAmountLabel = document.getElementById("collapsed-total-amount-label");
const shippingStatusLabel = document.getElementById("shipping-status-label");
const collapsedShippingLabel = document.getElementById("collapsed-shipping-label");
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
let sheetScrollY = 0;
let previousTotalAmount = 0;

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

  if (customerNameDisplay) {
    customerNameDisplay.textContent = customerName || "입력 필요";
  }
  if (collapsedCustomerNameDisplay) {
    collapsedCustomerNameDisplay.textContent = customerName || "입력 필요";
  }
  if (orderSection) {
    orderSection.classList.toggle("is-locked", !hasCustomer);
    orderSection.setAttribute("aria-hidden", String(!hasCustomer));
  }
  if (customerInput) {
    customerInput.value = customerName;
  }

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

function parseQty(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || rawValue.startsWith("-")) {
    return 0;
  }

  const integerPart = rawValue.split(/[.．]/)[0];
  const digits = integerPart.replace(/\D/g, "");
  if (!digits) {
    return 0;
  }

  const qty = Number.parseInt(digits, 10);
  return Number.isFinite(qty) ? qty : 0;
}

function cleanQtyInputValue(value, allowBlank = false) {
  const rawValue = String(value ?? "").trim();
  if (allowBlank && rawValue === "") {
    return "";
  }
  if (rawValue.startsWith("-")) {
    return "0";
  }

  const integerPart = rawValue.split(/[.．]/)[0];
  const digits = integerPart.replace(/\D/g, "");
  if (allowBlank && digits === "") {
    return "";
  }

  return String(parseQty(digits));
}

function setQty(productCode, size, qty) {
  ensureCartProduct(productCode);
  const nextQty = parseQty(qty);
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

function updateProductPanel(productCode, skipInput = null) {
  const panel = getQuantityPanel(productCode);
  if (!panel) {
    return;
  }

  const activeSize = panel.dataset.activeSize;
  const unitPrice = Number(panel.dataset.price || 0);
  const qty = getQty(productCode, activeSize);
  const qtyInput = panel.querySelector("[data-active-qty]");

  if (qtyInput && qtyInput !== skipInput) {
    qtyInput.value = String(qty);
  }
  panel.querySelector("[data-line-total]").textContent = formatCurrency(unitPrice * qty);
}

function updateAllProductPanels(skipInput = null) {
  document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
    updateProductPanel(panel.dataset.productCode, skipInput);
  });
}

function refreshOrderViews({ skipInput = null, skipMiniOrderRender = false } = {}) {
  updateAllProductPanels(skipInput);
  renderSummary({ skipMiniOrderRender });
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

function renderSummary({ skipMiniOrderRender = false } = {}) {
  const { totalQty, totalAmount } = getTotals();
  const progress = Math.min(100, Math.round((totalAmount / freeShippingThreshold) * 100));
  const totalAmountText = formatCurrency(totalAmount);
  const remainingAmount = freeShippingThreshold - totalAmount;

  if (totalAmountLabel) {
    totalAmountLabel.textContent = totalAmountText;
  }
  if (collapsedTotalAmountLabel) {
    collapsedTotalAmountLabel.textContent = totalAmountText;
  }
  if (floatingTotalLabel) {
    floatingTotalLabel.textContent = totalAmountText;
  }
  if (selectedCountLabel) {
    selectedCountLabel.textContent = `주문내역 ${totalQty}개`;
  }
  if (shippingProgressBar) {
    shippingProgressBar.style.width = `${progress}%`;
  }

  if (totalAmount >= freeShippingThreshold) {
    if (shippingStatusLabel) {
      shippingStatusLabel.textContent = "무료배송 기준 충족";
    }
    if (collapsedShippingLabel) {
      collapsedShippingLabel.textContent = "무료배송 달성";
    }
  } else {
    if (shippingStatusLabel) {
      shippingStatusLabel.textContent = `무료배송까지 ${formatCurrency(remainingAmount)}`;
    }
    if (collapsedShippingLabel) {
      collapsedShippingLabel.textContent = `+${formatCurrency(remainingAmount)} 더 담으면 무료배송`;
    }
  }

  if (openConfirmButton) {
    openConfirmButton.disabled = isSubmittingOrder || totalQty === 0 || !getCustomerName();
  }

  if (totalAmount !== previousTotalAmount) {
    animateAmountChange();
    previousTotalAmount = totalAmount;
  }

  if (!skipMiniOrderRender && miniOrderSheet && !miniOrderSheet.classList.contains("is-hidden")) {
    renderMiniOrderSheet();
  }
}

function animateAmountChange() {
  [totalAmountLabel, collapsedTotalAmountLabel, floatingTotalLabel].forEach((element) => {
    if (!element) {
      return;
    }
    element.classList.remove("amount-pulse");
    void element.offsetWidth;
    element.classList.add("amount-pulse");
  });
}

function runStartupStep(label, callback) {
  try {
    callback();
  } catch (error) {
    console.error(`Order page startup failed during ${label}`, error);
  }
}

function ensureInitialCustomerModal() {
  if (!getCustomerName()) {
    openCustomerModal(true);
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
    customerInput?.focus();
    return;
  }

  const panel = button.closest("[data-quantity-panel]");
  const productCode = panel.dataset.productCode;
  const activeSize = panel.dataset.activeSize;
  const currentQty = getQty(productCode, activeSize);
  const nextQty = button.dataset.action === "increase" ? currentQty + 1 : currentQty - 1;

  setQty(productCode, activeSize, nextQty);
  refreshOrderViews();
}

function handleQtyInput(input) {
  if (!getCustomerName()) {
    customerInput?.focus();
    return;
  }

  const panel = input.closest("[data-quantity-panel]");
  if (!panel) {
    return;
  }

  const productCode = panel.dataset.productCode;
  const activeSize = panel.dataset.activeSize;
  const cleanedValue = cleanQtyInputValue(input.value, true);
  const qty = parseQty(cleanedValue);

  input.value = cleanedValue;
  setQty(productCode, activeSize, qty);
  updateProductPanel(productCode, input);
  renderSummary();
  if (!confirmModal.classList.contains("is-hidden")) {
    buildModal();
    updateConfirmSubmitState();
  }
}

function commitQtyInput(input) {
  const panel = input.closest("[data-quantity-panel]");
  if (!panel) {
    return;
  }

  const productCode = panel.dataset.productCode;
  const activeSize = panel.dataset.activeSize;
  const qty = parseQty(input.value);
  setQty(productCode, activeSize, qty);
  input.value = String(getQty(productCode, activeSize));
  refreshOrderViews({ skipInput: input });
}

function filterCategory(category) {
  document.querySelectorAll("[data-product-card]").forEach((card) => {
    const shouldShow = category === "전체" || card.dataset.category === category;
    card.classList.toggle("is-hidden", !shouldShow);
  });
}

function initializeCategoryTabs() {
  if (!categoryTabs) {
    return;
  }

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
  if (!confirmCustomerInput || !modalTotalQty || !modalTotalAmount || !modalItems) {
    return;
  }

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
  if (!miniOrderItems || !miniTotalQty || !miniTotalAmount) {
    return;
  }

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
    detail.className = "mini-order-detail";
    detail.textContent = `${item.product_code} / ${item.size} / ${item.qty}장`;
    info.append(title, detail);

    const controls = document.createElement("div");
    controls.className = "mini-order-controls";

    const minusButton = document.createElement("button");
    minusButton.type = "button";
    minusButton.className = "mini-qty-button";
    minusButton.dataset.miniAction = "decrease";
    minusButton.textContent = "-";

    const qtyInput = document.createElement("input");
    qtyInput.type = "text";
    qtyInput.inputMode = "numeric";
    qtyInput.pattern = "[0-9]*";
    qtyInput.autocomplete = "off";
    qtyInput.className = "mini-qty-input";
    qtyInput.dataset.miniQtyInput = "";
    qtyInput.value = String(item.qty);
    qtyInput.setAttribute("aria-label", `${item.product_name} ${item.size} 수량 직접 입력`);
    qtyInput.title = `${item.product_name} ${item.size} 수량 직접 입력`;

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

    controls.append(minusButton, qtyInput, plusButton, deleteButton);
    row.append(info, controls);
    miniOrderItems.appendChild(row);
  });
}

function blurActiveFormControl() {
  const activeElement = document.activeElement;
  if (activeElement?.matches?.("input, textarea, select")) {
    activeElement.blur();
  }
}

function resetOverlayScroll(overlay) {
  const scrollTargets = [
    overlay,
    overlay.querySelector(".modal-panel"),
    overlay.querySelector(".sheet-panel"),
    overlay.querySelector(".mini-order-items"),
  ].filter(Boolean);

  const reset = () => {
    scrollTargets.forEach((target) => {
      target.scrollTop = 0;
    });
  };

  reset();
  window.requestAnimationFrame(reset);
  window.setTimeout(reset, 0);
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  blurActiveFormControl();
  lockBodyScroll();
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  resetOverlayScroll(modal);
}

function closeModal(modal, { keepBodyLocked = false } = {}) {
  if (!modal) {
    return;
  }

  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  if (!keepBodyLocked) {
    unlockBodyScroll();
  }
}

function openCustomerModal(isRequired = false) {
  if (!customerModal) {
    return;
  }

  isCustomerModalRequired = isRequired;
  if (customerInput) {
    customerInput.value = isRequired ? "" : getCustomerName();
  }
  customerModal.classList.remove("is-hidden");
  customerModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => customerInput?.focus(), 50);
}

function closeCustomerModal() {
  if (!customerModal) {
    return;
  }

  customerModal.classList.add("is-hidden");
  customerModal.setAttribute("aria-hidden", "true");
}

function lockBodyScroll() {
  if (document.body.classList.contains("is-sheet-open")) {
    return;
  }

  sheetScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = "fixed";
  document.body.style.top = `-${sheetScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
  document.body.classList.add("is-sheet-open");
}

function unlockBodyScroll() {
  if (!document.body.classList.contains("is-sheet-open")) {
    return;
  }

  document.body.classList.remove("is-sheet-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  window.scrollTo(0, sheetScrollY);
}

function openSheet(sheet) {
  if (!sheet) {
    return;
  }

  blurActiveFormControl();
  renderMiniOrderSheet();
  lockBodyScroll();
  sheet.classList.remove("is-hidden");
  sheet.setAttribute("aria-hidden", "false");
  resetOverlayScroll(sheet);
}

function closeSheet(sheet) {
  if (!sheet) {
    return;
  }

  sheet.classList.add("is-hidden");
  sheet.setAttribute("aria-hidden", "true");
  unlockBodyScroll();
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

function handleMiniQtyInput(input) {
  const row = input.closest(".mini-order-item");
  if (!row) {
    return;
  }

  const productCode = row.dataset.productCode;
  const size = row.dataset.size;
  const cleanedValue = cleanQtyInputValue(input.value, true);
  const qty = parseQty(cleanedValue);

  input.value = cleanedValue;
  setQty(productCode, size, qty);

  const detail = row.querySelector(".mini-order-detail");
  if (detail) {
    detail.textContent = `${productCode} / ${size} / ${qty}장`;
  }

  updateAllProductPanels();
  renderSummary({ skipMiniOrderRender: true });
  if (!confirmModal.classList.contains("is-hidden")) {
    buildModal();
    updateConfirmSubmitState();
  }
}

function commitMiniQtyInput(input) {
  const row = input.closest(".mini-order-item");
  if (!row) {
    return;
  }

  const productCode = row.dataset.productCode;
  const size = row.dataset.size;
  const qty = parseQty(input.value);
  setQty(productCode, size, qty);

  if (qty === 0) {
    refreshOrderViews();
    return;
  }

  input.value = String(getQty(productCode, size));
  updateAllProductPanels();
  renderSummary({ skipMiniOrderRender: true });
}

function resetCustomer() {
  setCustomerName("");
  if (customerNameDisplay) {
    customerNameDisplay.textContent = "입력 필요";
  }
  if (collapsedCustomerNameDisplay) {
    collapsedCustomerNameDisplay.textContent = "입력 필요";
  }
  if (customerInput) {
    customerInput.value = "";
  }
  if (confirmCustomerInput) {
    confirmCustomerInput.value = "";
  }
  resetMemoInput();
  if (orderSection) {
    orderSection.classList.add("is-locked");
    orderSection.setAttribute("aria-hidden", "true");
  }
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
  if (!submitConfirmButton || !confirmCustomerInput) {
    return;
  }

  submitConfirmButton.disabled = isSubmittingOrder || !confirmCustomerInput.value.trim();
}

async function submitOrder() {
  if (isSubmittingOrder) {
    return;
  }
  if (!confirmCustomerInput || !submitConfirmButton) {
    alert("주문 확인 화면을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
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
  if (customerNameDisplay) {
    customerNameDisplay.textContent = customerName;
  }
  if (collapsedCustomerNameDisplay) {
    collapsedCustomerNameDisplay.textContent = customerName;
  }

  isSubmittingOrder = true;
  updateConfirmSubmitState();
  renderSummary();
  submitConfirmButton.classList.add("is-loading");
  submitConfirmButton.textContent = "주문 전송 중...";

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
      const message = Array.isArray(result.errors)
        ? `${result.errors.join(" ")} 잠시 후 다시 시도해주세요.`
        : "주문 전송에 실패했습니다. 잠시 후 다시 시도해주세요.";
      alert(message);
      return;
    }

    closeModal(confirmModal, { keepBodyLocked: true });
    if (completeOrderId) {
      completeOrderId.textContent = result.order_id || "-";
    }
    openModal(completeModal);
    resetCart();
    resetCustomer();
    resetMemoInput();
  } catch (error) {
    console.error("Order submit network error", error);
    alert("주문 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    isSubmittingOrder = false;
    submitConfirmButton.classList.remove("is-loading");
    submitConfirmButton.textContent = "주문 확정";
    updateConfirmSubmitState();
    renderSummary();
  }
}

saveCustomerButton?.addEventListener("click", () => {
  const name = customerInput?.value.trim() || "";
  if (!name) {
    customerInput?.focus();
    return;
  }

  setCustomerName(name);
  syncCustomerUI();
  renderSummary();
});

customerInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveCustomerButton?.click();
  }
});

changeCustomerButton?.addEventListener("click", () => {
  if (customerInput) {
    customerInput.value = getCustomerName();
  }
  openCustomerModal(false);
});

categoryTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) {
    return;
  }

  categoryTabs.querySelectorAll("[data-category]").forEach((tab) => {
    tab.classList.toggle("is-active", tab === button);
  });
  filterCategory(button.dataset.category);
});

orderSection?.addEventListener("click", (event) => {
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

orderSection?.addEventListener("input", (event) => {
  const qtyInput = event.target.closest("[data-active-qty]");
  if (qtyInput) {
    handleQtyInput(qtyInput);
  }
});

orderSection?.addEventListener("keydown", (event) => {
  const qtyInput = event.target.closest("[data-active-qty]");
  if (qtyInput && event.key === "Enter") {
    qtyInput.blur();
  }
});

orderSection?.addEventListener("focusout", (event) => {
  const qtyInput = event.target.closest("[data-active-qty]");
  if (qtyInput) {
    commitQtyInput(qtyInput);
  }
});

openConfirmButton?.addEventListener("click", () => {
  buildModal();
  updateConfirmSubmitState();
  openModal(confirmModal);
});

openMiniOrderButton?.addEventListener("click", () => openSheet(miniOrderSheet));
closeMiniOrderButton?.addEventListener("click", () => closeSheet(miniOrderSheet));
miniOrderSheet?.addEventListener("click", (event) => {
  const miniActionButton = event.target.closest("[data-mini-action]");
  if (miniActionButton) {
    handleMiniOrderAction(miniActionButton);
    return;
  }

  if (event.target.closest("[data-sheet-close]")) {
    closeSheet(miniOrderSheet);
  }
});

miniOrderSheet?.addEventListener("input", (event) => {
  const qtyInput = event.target.closest("[data-mini-qty-input]");
  if (qtyInput) {
    handleMiniQtyInput(qtyInput);
  }
});

miniOrderSheet?.addEventListener("keydown", (event) => {
  const qtyInput = event.target.closest("[data-mini-qty-input]");
  if (qtyInput && event.key === "Enter") {
    qtyInput.blur();
  }
});

miniOrderSheet?.addEventListener("focusout", (event) => {
  const qtyInput = event.target.closest("[data-mini-qty-input]");
  if (qtyInput) {
    commitMiniQtyInput(qtyInput);
  }
});

customerModal?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-customer-modal-backdrop]")) {
    return;
  }
  if (!isCustomerModalRequired) {
    closeCustomerModal();
  }
});

confirmModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-confirm-modal-backdrop]")) {
    closeModal(confirmModal);
  }
});

confirmCustomerInput?.addEventListener("input", updateConfirmSubmitState);
closeConfirmButton?.addEventListener("click", () => {
  closeModal(confirmModal, { keepBodyLocked: true });
  openSheet(miniOrderSheet);
});
submitConfirmButton?.addEventListener("click", submitOrder);
completeCloseButton?.addEventListener("click", () => {
  closeModal(completeModal);
  syncCustomerUI();
});

runStartupStep("storage reset", clearStoredCustomerName);
runStartupStep("customer modal initialization", syncCustomerUI);
runStartupStep("category tab initialization", initializeCategoryTabs);
runStartupStep("product panel initialization", () => {
  document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
    updateProductPanel(panel.dataset.productCode);
  });
});
runStartupStep("summary initialization", renderSummary);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    runStartupStep("post-DOM customer modal check", ensureInitialCustomerModal);
  });
} else {
  runStartupStep("post-DOM customer modal check", ensureInitialCustomerModal);
}
