const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-site-nav]");

if (toggle && nav) {
  const closeNav = () => {
    if (!nav.classList.contains("is-open")) {
      return;
    }
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      closeNav();
      toggle.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && !toggle.contains(event.target)) {
      closeNav();
    }
  });

  // The nav only renders below 980px. Rotating or resizing past that leaves
  // is-open as stale state on a layout that no longer uses it.
  window.matchMedia("(min-width: 981px)").addEventListener("change", closeNav);
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

    // The status node carries role="status" aria-live="polite" in the markup so
    // the region is registered at page load. Creating or unhiding a live region
    // in the same task that writes to it is not announced by NVDA, JAWS or
    // VoiceOver, so this only ever writes text.
    const announce = (message) => {
      if (!statusNode) {
        return;
      }
      statusNode.textContent = message;
    };

    // `disabled` removes the button from the tab order and the accessibility
    // tree while it still holds focus, dropping focus to <body>. aria-disabled
    // keeps it addressable; the re-entry guard below stops the double submit.
    const setBusy = (busy) => {
      if (!submitButton) {
        return;
      }
      submitButton.setAttribute("aria-disabled", String(busy));
      submitButton.classList.toggle("is-busy", busy);
    };

    if (form.dataset.submitting === "true") {
      return;
    }
    form.dataset.submitting = "true";
    setBusy(true);
    announce("Submitting...");

    const submitNatively = () => {
      const fallbackAction = form.getAttribute("data-fallback-action");
      if (fallbackAction) {
        form.setAttribute("action", fallbackAction);
      }
      // Called off the prototype: a control named "submit" shadows the method
      // on the form element itself, and this runs inside a failure path where
      // the resulting TypeError would strand the user on "Retrying...".
      HTMLFormElement.prototype.submit.call(form);
    };

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
    } catch {
      // Engine-specific text like "Failed to fetch" means nothing to a user.
      announce("Network problem. Retrying with a standard submission...");
      submitNatively();
      return;
    }

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      window.location.href = result.redirectTo || form.dataset.successRedirect || "/";
      return;
    }

    if (response.status >= 500) {
      announce(`${result.error || "Submission failed."} Retrying with a standard submission...`);
      submitNatively();
      return;
    }

    announce(result.error || "Submission failed.");
    form.dataset.submitting = "false";
    setBusy(false);
    // A polite update can be dropped if speech is already queued, and nothing
    // else returns the user to the form. Moving focus guarantees the failure
    // is read and puts the user back where they can fix it.
    statusNode?.focus();
  });
});
