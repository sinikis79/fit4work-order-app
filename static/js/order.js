const CUSTOMER_STORAGE_KEY = "fit4work_customer_name";

const customerGate = document.getElementById("customer-gate");
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
const openConfirmButton = document.getElementById("open-confirm-button");
const confirmModal = document.getElementById("confirm-modal");
const modalCustomerName = document.getElementById("modal-customer-name");
const modalItems = document.getElementById("modal-items");
const modalTotalQty = document.getElementById("modal-total-qty");
const modalTotalAmount = document.getElementById("modal-total-amount");
const closeConfirmButton = document.getElementById("close-confirm-button");
const submitConfirmButton = document.getElementById("submit-confirm-button");
const completeModal = document.getElementById("complete-modal");
const completeOrderId = document.getElementById("complete-order-id");
const completeCloseButton = document.getElementById("complete-close-button");

const freeShippingThreshold = Number(document.body.dataset.freeShippingThreshold || 100000);
const cart = {};

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function getCustomerName() {
  return localStorage.getItem(CUSTOMER_STORAGE_KEY)?.trim() || "";
}

function setCustomerName(name) {
  localStorage.setItem(CUSTOMER_STORAGE_KEY, name.trim());
}

function syncCustomerUI() {
  const customerName = getCustomerName();
  const hasCustomer = Boolean(customerName);

  customerNameDisplay.textContent = customerName || "입력 필요";
  customerGate.classList.toggle("is-hidden", hasCustomer);
  orderSection.classList.toggle("is-locked", !hasCustomer);
  orderSection.setAttribute("aria-hidden", String(!hasCustomer));
  customerInput.value = customerName;
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
  cart[productCode][size] = Math.max(0, qty);
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

  openConfirmButton.disabled = totalQty === 0 || !getCustomerName();
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

function buildModal() {
  const { items, totalQty, totalAmount } = getTotals();
  modalCustomerName.textContent = getCustomerName();
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

function openModal(modal) {
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
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

async function submitOrder() {
  const { items, totalQty, totalAmount } = getTotals();

  submitConfirmButton.disabled = true;
  submitConfirmButton.textContent = "전송 중...";

  try {
    const response = await fetch("/submit_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_name: getCustomerName(),
        items: items.map((item) => ({
          product_code: item.product_code,
          size: item.size,
          qty: item.qty,
        })),
        total_qty: totalQty,
        total_amount: totalAmount,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      const message = Array.isArray(result.errors) ? result.errors.join(" ") : "주문 전송에 실패했습니다.";
      alert(message);
      return;
    }

    closeModal(confirmModal);
    completeOrderId.textContent = result.order_id || "-";
    openModal(completeModal);
    resetCart();
  } catch (_error) {
    alert("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    submitConfirmButton.disabled = false;
    submitConfirmButton.textContent = "주문 확정";
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
  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  syncCustomerUI();
  renderSummary();
  customerInput.focus();
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
  openModal(confirmModal);
});

closeConfirmButton.addEventListener("click", () => closeModal(confirmModal));
submitConfirmButton.addEventListener("click", submitOrder);
completeCloseButton.addEventListener("click", () => closeModal(completeModal));

syncCustomerUI();
document.querySelectorAll("[data-quantity-panel]").forEach((panel) => {
  updateProductPanel(panel.dataset.productCode);
});
renderSummary();
