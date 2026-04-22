const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-site-nav]");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll("[data-form-status]").forEach((node) => {
  node.hidden = false;
});

document.querySelectorAll("form[data-api-endpoint]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    const endpoint = form.getAttribute("data-api-endpoint");
    if (!endpoint) {
      return;
    }

    event.preventDefault();

    const statusNode = form.querySelector("[data-form-status]");
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (statusNode) {
      statusNode.hidden = false;
      statusNode.textContent = "Submitting...";
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Submission failed.");
      }

      window.location.href = payload.redirectTo || form.dataset.successRedirect || "/";
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = `${error.message} Falling back to standard submission...`;
      }
      form.submit();
      return;
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
});
