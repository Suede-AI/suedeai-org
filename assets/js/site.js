const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-site-nav]");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll("form[data-api-endpoint]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    const endpoint = form.getAttribute("data-api-endpoint");
    if (!endpoint) {
      return;
    }

    event.preventDefault();

    const statusNode = form.querySelector("[data-form-status]");
    const submitButton = form.querySelector('button[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (statusNode) {
      statusNode.hidden = false;
      statusNode.textContent = "Submitting...";
    }

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = `${error.message} Retrying with a standard submission...`;
      }
      const fallbackAction = form.getAttribute("data-fallback-action");
      if (fallbackAction) {
        form.setAttribute("action", fallbackAction);
      }
      form.submit();
      return;
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      window.location.href = result.redirectTo || form.dataset.successRedirect || "/";
      return;
    }

    if (response.status >= 500) {
      if (statusNode) {
        statusNode.textContent = `${result.error || "Submission failed."} Retrying with a standard submission...`;
      }
      const fallbackAction = form.getAttribute("data-fallback-action");
      if (fallbackAction) {
        form.setAttribute("action", fallbackAction);
      }
      form.submit();
      return;
    }

    if (statusNode) {
      statusNode.textContent = result.error || "Submission failed.";
    }
    if (submitButton) {
      submitButton.disabled = false;
    }
  });
});
